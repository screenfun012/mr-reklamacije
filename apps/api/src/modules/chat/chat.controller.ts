import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import type { MRSessionUser } from '../../core/auth/session-types.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import {
  parseAttachmentDownloadRequest,
  serveCachedAttachmentDownload,
} from '../../core/http/attachment-download.js'
import { readUploadFiles } from '../../core/http/upload-files.js'
import type { PreparedChatFile } from './chat-attachments.service.js'
import {
  ChatClaimThreadParamSchema,
  ChatAttachmentIdParamSchema,
  ChatChannelInputSchema,
  ChatMemberParamSchema,
  ChatMembersInputSchema,
  ChatConversationIdParamSchema,
  ChatEditInputSchema,
  ChatMarkReadInputSchema,
  ChatMessageIdParamSchema,
  ChatMessagesQuerySchema,
  ChatSendInputSchema,
  type ChatActor,
} from './chat.validators.js'

function toActor(c: Context): ChatActor {
  const user: MRSessionUser | null = c.get('user')
  if (user === null) {
    throw new UnauthorizedError()
  }
  return { id: user.id, permissions: user.permissions, roles: user.roles }
}

/**
 * The non-file half of a multipart send, shaped so the same Zod schema parses both transports.
 * A missing field stays missing rather than becoming an empty string — `quoteOf` is optional and
 * an empty string is not a uuid.
 */
function readSendFields(formData: FormData): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  for (const key of ['clientMsgId', 'body', 'quoteOf']) {
    const value = formData.get(key)
    if (typeof value === 'string' && (key !== 'quoteOf' || value.length > 0)) {
      fields[key] = value
    }
  }
  return fields
}

export function createChatController(container: Container): {
  listConversations: (c: Context) => Promise<Response>
  listMessages: (c: Context) => Promise<Response>
  listPeople: (c: Context) => Promise<Response>
  deleteConversation: (c: Context) => Promise<Response>
  sendMessage: (c: Context) => Promise<Response>
  markRead: (c: Context) => Promise<Response>
  findClaimThread: (c: Context) => Promise<Response>
  openClaimThread: (c: Context) => Promise<Response>
  editMessage: (c: Context) => Promise<Response>
  deleteMessage: (c: Context) => Promise<Response>
  mute: (c: Context) => Promise<Response>
  unmute: (c: Context) => Promise<Response>
  listPins: (c: Context) => Promise<Response>
  createChannel: (c: Context) => Promise<Response>
  renameChannel: (c: Context) => Promise<Response>
  listMembers: (c: Context) => Promise<Response>
  addMembers: (c: Context) => Promise<Response>
  removeMember: (c: Context) => Promise<Response>
  listAttachments: (c: Context) => Promise<Response>
  downloadAttachment: (c: Context) => Promise<Response>
  pin: (c: Context) => Promise<Response>
  unpin: (c: Context) => Promise<Response>
  react: (c: Context) => Promise<Response>
  unreact: (c: Context) => Promise<Response>
} {
  return {
    listConversations: async (c: Context) => {
      const result = await container.chatService.listConversations(toActor(c))
      return c.json(result)
    },

    deleteConversation: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse({ id: c.req.param('id') })
      await container.chatService.deleteConversation(id, toActor(c))
      return c.body(null, 204)
    },

    listPeople: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse({ id: c.req.param('id') })
      const result = await container.chatService.listPeople(id, toActor(c))
      return c.json(result)
    },

    listMessages: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse(c.req.param())
      const query = ChatMessagesQuerySchema.parse(c.req.query())
      const page = await container.chatService.listMessages(id, query, toActor(c))
      return c.json(page)
    },

    /**
     * Two shapes, one route: JSON for words alone, multipart when the message carries files.
     *
     * One route rather than an upload-then-send pair so the `clientMsgId` that already makes a
     * retried message land exactly once covers its photos too — and so there is never a state
     * called "uploaded but never sent" to clean up after.
     */
    sendMessage: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse(c.req.param())
      const isMultipart = (c.req.header('content-type') ?? '')
        .toLowerCase()
        .startsWith('multipart/form-data')

      let input
      let files: PreparedChatFile[] = []
      if (isMultipart) {
        const formData = await c.req.formData()
        input = ChatSendInputSchema.parse(readSendFields(formData))
        files = await container.chatAttachmentsService.prepare(await readUploadFiles(formData))
      } else {
        input = ChatSendInputSchema.parse(await c.req.json())
      }

      const { message, created, partialFiles } = await container.chatService.send(
        id,
        input,
        toActor(c),
        files,
      )
      // 200 says "this one was already here" — the retry is answered, not counted twice.
      return c.json({ ...message, partialFiles }, created ? 201 : 200)
    },

    createChannel: async (c: Context) => {
      const { name } = ChatChannelInputSchema.parse(await c.req.json())
      const conversation = await container.chatService.createChannel(name, toActor(c))
      return c.json(conversation, 201)
    },

    renameChannel: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse({ id: c.req.param('id') })
      const { name } = ChatChannelInputSchema.parse(await c.req.json())
      const conversation = await container.chatService.renameChannel(id, name, toActor(c))
      return c.json(conversation)
    },

    listMembers: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse({ id: c.req.param('id') })
      const result = await container.chatService.listMembers(id, toActor(c))
      return c.json(result)
    },

    addMembers: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse({ id: c.req.param('id') })
      const { userIds } = ChatMembersInputSchema.parse(await c.req.json())
      await container.chatService.addMembers(id, userIds, toActor(c))
      return c.body(null, 204)
    },

    removeMember: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse({ id: c.req.param('id') })
      const raw = c.req.param('userId')
      // „me" is how somebody walks out of a room without knowing their own id.
      const actor = toActor(c)
      const { userId } = ChatMemberParamSchema.parse({ userId: raw === 'me' ? actor.id : raw })
      await container.chatService.removeMember(id, userId, actor)
      return c.body(null, 204)
    },

    listAttachments: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse({ id: c.req.param('id') })
      const result = await container.chatService.listAttachments(id, toActor(c))
      return c.json(result)
    },

    downloadAttachment: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse({ id: c.req.param('id') })
      const { attachmentId } = ChatAttachmentIdParamSchema.parse({
        attachmentId: c.req.param('attachmentId'),
      })
      const { variant, disposition } = parseAttachmentDownloadRequest(c)

      const meta = await container.chatService.attachmentDownloadMeta(
        id,
        attachmentId,
        toActor(c),
        variant,
      )

      return serveCachedAttachmentDownload(c, meta, {
        disposition,
        openStream: (storagePath) => container.chatAttachmentsService.openStream(storagePath),
      })
    },

    markRead: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse(c.req.param())
      const { lastSeq } = ChatMarkReadInputSchema.parse(await c.req.json())
      await container.chatService.markRead(id, lastSeq, toActor(c))
      return c.body(null, 204)
    },

    findClaimThread: async (c: Context) => {
      const { kind, id } = ChatClaimThreadParamSchema.parse(c.req.param())
      const lookup = await container.chatService.findThreadForClaim(kind, id, toActor(c))
      return c.json(lookup)
    },

    openClaimThread: async (c: Context) => {
      const { kind, id } = ChatClaimThreadParamSchema.parse(c.req.param())
      const { conversation, created } = await container.chatService.threadForClaim(
        kind,
        id,
        toActor(c),
      )
      // 200 says the thread was already there — opening it twice opens the same room.
      return c.json(conversation, created ? 201 : 200)
    },

    editMessage: async (c: Context) => {
      const { id } = ChatMessageIdParamSchema.parse(c.req.param())
      const { body } = ChatEditInputSchema.parse(await c.req.json())
      const message = await container.chatService.editMessage(id, body, toActor(c))
      return c.json(message)
    },

    /**
     * 204 for everything below: what changed is one row the client already knows the shape of, and
     * a body would only be a copy of what it just asked for. A tick and a pin are exactly the small
     * actions CLAUDE.md allows an optimistic update for.
     */
    deleteMessage: async (c: Context) => {
      const { id } = ChatMessageIdParamSchema.parse(c.req.param())
      await container.chatService.deleteMessage(id, toActor(c))
      return c.body(null, 204)
    },

    mute: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse(c.req.param())
      await container.chatService.mute(id, toActor(c))
      return c.body(null, 204)
    },

    unmute: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse(c.req.param())
      await container.chatService.unmute(id, toActor(c))
      return c.body(null, 204)
    },

    listPins: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse(c.req.param())
      const items = await container.chatService.listPins(id, toActor(c))
      return c.json({ items })
    },

    pin: async (c: Context) => {
      const { id } = ChatMessageIdParamSchema.parse(c.req.param())
      await container.chatService.pin(id, toActor(c))
      return c.body(null, 204)
    },

    unpin: async (c: Context) => {
      const { id } = ChatMessageIdParamSchema.parse(c.req.param())
      await container.chatService.unpin(id, toActor(c))
      return c.body(null, 204)
    },

    react: async (c: Context) => {
      const { id } = ChatMessageIdParamSchema.parse(c.req.param())
      await container.chatService.react(id, toActor(c))
      return c.body(null, 204)
    },

    unreact: async (c: Context) => {
      const { id } = ChatMessageIdParamSchema.parse(c.req.param())
      await container.chatService.unreact(id, toActor(c))
      return c.body(null, 204)
    },
  }
}
