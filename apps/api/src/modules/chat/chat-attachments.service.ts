import type { Logger } from '@mr/logger'

import {
  CHAT_MAX_FILES_PER_MESSAGE,
  extensionForMimeType,
  isAllowedChatAttachmentMimeType,
  AttachmentPurpose,
  type AllowedAttachmentMimeType,
} from '@mr/shared'
import { randomUUID } from 'node:crypto'

import {
  alignFileNameExtension,
  processUploadFile,
  writeStoredFile,
} from '../../core/attachments/attachment-upload-pipeline.js'
import { UnsupportedMediaTypeError, ValidationError } from '../../core/errors/domain-errors.js'
import type { UploadFile } from '../../core/http/upload-files.js'

import {
  buildChatAttachmentStoragePath,
  sanitizeUploadFileName,
  type StorageService,
} from '../../infrastructure/storage/storage.interface.js'
import type { ChatRepository, NewChatAttachmentRow } from './chat.repository.js'

/** A file that has passed every check and is ready to be written — but is not written yet. */
export interface PreparedChatFile {
  readonly fileName: string
  readonly storedData: Buffer
  readonly storedMime: AllowedAttachmentMimeType
  readonly contentSha256: string
  readonly optimized: Awaited<ReturnType<typeof processUploadFile>>['optimized']
}

export interface StoredChatFiles {
  /** How many made it to storage and to a row. */
  readonly stored: number
  /** How many were lost writing them. Zero on every ordinary send. */
  readonly failed: number
}

/**
 * Files sent inside a chat message.
 *
 * Its own service rather than a branch in `AttachmentsService`, for the same reason the portal
 * submissions have one: that service authorises by `attachments.*` permissions and by a claim, and
 * the chat has neither. A serviser holds no `attachments.*` at all and still belongs in the room.
 */
export class ChatAttachmentsService {
  constructor(
    private readonly repo: ChatRepository,
    private readonly storage: StorageService,
    private readonly logger: Logger,
  ) {}

  /**
   * Everything that can refuse a file happens here, in memory, BEFORE the message row exists.
   *
   * That order is the whole retry story: a repeated `clientMsgId` finds the message already
   * stored, drops these bytes and writes nothing — so a retry can never leave an object on the
   * disk with no row to find it by.
   */
  async prepare(files: readonly UploadFile[]): Promise<PreparedChatFile[]> {
    if (files.length > CHAT_MAX_FILES_PER_MESSAGE) {
      throw new ValidationError(`A message may carry at most ${CHAT_MAX_FILES_PER_MESSAGE} files`)
    }

    const prepared: PreparedChatFile[] = []
    for (const file of files) {
      const processed = await processUploadFile(file)

      // The shared pipeline also recognises video, Word and Excel. The chat takes photos and PDF.
      if (!isAllowedChatAttachmentMimeType(processed.storedMime)) {
        throw new UnsupportedMediaTypeError('A message may carry photos and PDF files only')
      }

      prepared.push({
        fileName: alignFileNameExtension(
          sanitizeUploadFileName(file.fileName),
          processed.storedMime,
        ),
        storedData: processed.storedData,
        storedMime: processed.storedMime,
        contentSha256: processed.contentSha256,
        optimized: processed.optimized,
      })
    }

    return prepared
  }

  /**
   * Removes a whole room's bytes from storage.
   *
   * ⚠ Called BEFORE the conversation row is deleted, because the attachment rows cascade with it
   * and then nothing names these objects. A failure on one file is logged with its path and does
   * NOT stop the erase: an object left behind costs disk, a half-erased room costs a promise.
   */
  async eraseStoredFiles(conversationId: string): Promise<void> {
    const paths = await this.repo.listChatAttachmentPaths(conversationId)

    for (const path of paths) {
      try {
        await this.storage.delete(path)
      } catch (error) {
        this.logger.error({ err: error, path }, 'chat attachment could not be erased')
      }
    }
  }

  /** The bytes themselves. Streamed, never buffered — a photo is not a JSON payload. */
  async openStream(
    storagePath: string,
  ): Promise<{ stream: ReadableStream<Uint8Array>; size: number }> {
    return this.storage.readStream(storagePath)
  }

  /**
   * Writes the bytes, then the rows — only ever called once the message is known to be new.
   *
   * A file that cannot be written is counted rather than thrown: the words are already posted, and
   * taking the whole message down over one lost photo would lose the sentence too. The caller
   * reports the count so the screen can offer to send the missing ones again.
   */
  async store(
    conversationId: string,
    messageId: string,
    prepared: readonly PreparedChatFile[],
  ): Promise<StoredChatFiles> {
    const rows: NewChatAttachmentRow[] = []
    let failed = 0

    for (const file of prepared) {
      const attachmentId = randomUUID()
      const storagePath = buildChatAttachmentStoragePath({
        conversationId,
        attachmentId,
        extension: extensionForMimeType(file.storedMime),
      })

      try {
        const written = await writeStoredFile(this.storage, {
          storagePath,
          storedData: file.storedData,
          storedMime: file.storedMime,
          optimized: file.optimized,
        })

        rows.push({
          id: attachmentId,
          chatMessageId: messageId,
          fileName: file.fileName,
          storagePath,
          mimeType: file.storedMime,
          fileSizeBytes: file.storedData.byteLength,
          contentSha256: file.contentSha256,
          width: written.width,
          height: written.height,
          thumbnailPath: written.thumbnailPath,
          purpose: AttachmentPurpose.ChatAttachment,
        })
      } catch (error) {
        failed += 1
        this.logger.error({ err: error, storagePath }, 'chat attachment could not be stored')
      }
    }

    if (rows.length > 0) {
      await this.repo.insertChatAttachments(rows)
    }

    return { stored: rows.length, failed }
  }
}
