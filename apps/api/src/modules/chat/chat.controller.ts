import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import type { MRSessionUser } from '../../core/auth/session-types.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import {
  ChatClaimThreadParamSchema,
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

export function createChatController(container: Container): {
  listConversations: (c: Context) => Promise<Response>
  listMessages: (c: Context) => Promise<Response>
  sendMessage: (c: Context) => Promise<Response>
  markRead: (c: Context) => Promise<Response>
  openClaimThread: (c: Context) => Promise<Response>
  editMessage: (c: Context) => Promise<Response>
  deleteMessage: (c: Context) => Promise<Response>
  mute: (c: Context) => Promise<Response>
  unmute: (c: Context) => Promise<Response>
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

    listMessages: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse(c.req.param())
      const query = ChatMessagesQuerySchema.parse(c.req.query())
      const page = await container.chatService.listMessages(id, query, toActor(c))
      return c.json(page)
    },

    sendMessage: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse(c.req.param())
      const input = ChatSendInputSchema.parse(await c.req.json())
      const { message, created } = await container.chatService.send(id, input, toActor(c))
      // 200 says "this one was already here" — the retry is answered, not counted twice.
      return c.json(message, created ? 201 : 200)
    },

    markRead: async (c: Context) => {
      const { id } = ChatConversationIdParamSchema.parse(c.req.param())
      const { lastSeq } = ChatMarkReadInputSchema.parse(await c.req.json())
      await container.chatService.markRead(id, lastSeq, toActor(c))
      return c.body(null, 204)
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
