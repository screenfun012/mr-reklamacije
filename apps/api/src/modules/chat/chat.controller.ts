import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import type { MRSessionUser } from '../../core/auth/session-types.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import {
  ChatConversationIdParamSchema,
  ChatMessagesQuerySchema,
  ChatSendInputSchema,
  type ChatActor,
} from './chat.validators.js'

function toActor(c: Context): ChatActor {
  const user: MRSessionUser | null = c.get('user')
  if (user === null) {
    throw new UnauthorizedError()
  }
  return { id: user.id, permissions: user.permissions }
}

export function createChatController(container: Container): {
  listConversations: (c: Context) => Promise<Response>
  listMessages: (c: Context) => Promise<Response>
  sendMessage: (c: Context) => Promise<Response>
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
  }
}
