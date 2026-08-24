import { m } from '@mr/i18n'
import { buildChatAttachmentUrl, formatAttachmentFileSize, type ChatAttachment } from '@mr/shared'
import { Download } from 'lucide-react'
import { useState } from 'react'

import { CHAT_TILE_CLASSES } from './composer-attachments'

/**
 * The document pill, read from the prototype (`cet-prototip.dc.html` L129) down to the comma:
 * 9px/12px padding, gap 9, radius 9, the inset background and the hairline, and a red type badge
 * at 700 8px mono with .1em tracking inside a 40%-opacity red border.
 */
const DOCUMENT_PILL_CLASSES =
  'inline-flex max-w-full cursor-pointer items-center gap-[9px] self-start rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 py-[9px] transition-colors hover:border-mri-text2'

const DOCUMENT_BADGE_CLASSES =
  'flex-none rounded-[4px] border border-mri-red/40 px-[5px] py-[2px] font-mono text-[8px] font-bold tracking-[0.1em] text-mri-redh'

export interface MessageAttachmentsProps {
  conversationId: string
  attachments: readonly ChatAttachment[]
  onOpenImage: (attachmentId: string) => void
}

/**
 * The files under a message: photos as a row of tiles, everything else as a pill.
 *
 * ⚠ The tile is a FIXED 104×74. The list auto-scrolls once per new row (`message-list.tsx`), so a
 * picture that finishes loading afterwards and then decides its own height grows the bubble UNDER
 * the reader and strands them above the newest message. A fixed box cannot do that.
 */
export function MessageAttachments({
  conversationId,
  attachments,
  onOpenImage,
}: MessageAttachmentsProps): React.ReactElement | null {
  if (attachments.length === 0) {
    return null
  }

  const images = attachments.filter((file) => file.mimeType.startsWith('image/'))
  const documents = attachments.filter((file) => !file.mimeType.startsWith('image/'))

  return (
    <span className="flex flex-col gap-[7px]">
      {images.length === 0 ? null : (
        <span className="flex flex-wrap gap-[7px]">
          {images.map((file) => (
            <ImageTile
              key={file.id}
              conversationId={conversationId}
              attachment={file}
              onOpen={() => onOpenImage(file.id)}
            />
          ))}
        </span>
      )}
      {documents.map((file) => (
        <DocumentPill key={file.id} conversationId={conversationId} attachment={file} />
      ))}
    </span>
  )
}

function ImageTile({
  conversationId,
  attachment,
  onOpen,
}: {
  conversationId: string
  attachment: ChatAttachment
  onOpen: () => void
}): React.ReactElement {
  /**
   * Try the picture first, fall back to the name only when the browser actually fails.
   *
   * ⚠ NOT gated on whether a thumbnail exists: the download route already falls back to the
   * original when there is none, so a small photo — one under the thumbnail size, which never gets
   * one — would have shown its file name while the very same bytes drew fine in the viewer.
   * Measured exactly that way in the browser on 2026-08-24. The wire stopped carrying that flag
   * for the same reason: nothing could act on it.
   *
   * HEIC is the one case refused up front: nothing here can decode it, so there is no thumbnail
   * AND the original is a file the browser cannot draw either — trying it would fetch several
   * megabytes to arrive at the same fallback.
   */
  const [broken, setBroken] = useState(attachment.mimeType === 'image/heic')

  return (
    <button
      type="button"
      onClick={onOpen}
      title={attachment.fileName}
      className={`${CHAT_TILE_CLASSES} cursor-pointer transition-colors hover:border-mri-text2`}
    >
      {broken ? (
        <span className="px-2 text-center font-mono text-[9px] font-medium text-mri-text2">
          {attachment.fileName}
        </span>
      ) : (
        <img
          src={buildChatAttachmentUrl(conversationId, attachment.id, { variant: 'thumbnail' })}
          alt={attachment.fileName}
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      )}
    </button>
  )
}

function DocumentPill({
  conversationId,
  attachment,
}: {
  conversationId: string
  attachment: ChatAttachment
}): React.ReactElement {
  return (
    <a
      href={buildChatAttachmentUrl(conversationId, attachment.id, { disposition: 'attachment' })}
      className={DOCUMENT_PILL_CLASSES}
    >
      <span className={DOCUMENT_BADGE_CLASSES}>{badgeOf(attachment.mimeType)}</span>
      <span className="min-w-0 leading-[1.3]">
        <span className="block truncate text-[12px] font-bold">{attachment.fileName}</span>
        <span className="block font-mono text-[9px] font-medium text-mri-text2">
          {formatAttachmentFileSize(attachment.fileSizeBytes)}
        </span>
      </span>
      <Download aria-hidden="true" className="size-[13px] flex-none text-mri-text2" />
      <span className="sr-only">{m.chat_attachment_download()}</span>
    </a>
  )
}

/** Three letters at most — the badge is 8px mono in a 40px box. */
function badgeOf(mimeType: string): string {
  if (mimeType === 'application/pdf') {
    return 'PDF'
  }
  const tail = mimeType.split('/').at(-1) ?? 'FILE'
  return tail.slice(0, 3).toUpperCase()
}
