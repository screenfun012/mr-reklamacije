import { ChatConversationListResponseSchema } from '@mr/shared'
import { z } from 'zod'

export {
  ChatMessagesQuerySchema,
  type ChatConversationListItem,
  type ChatMessage,
  type ChatMessagesPage,
  type ChatMessagesQuery,
} from '@mr/shared'

export type ChatConversationListResponse = z.infer<typeof ChatConversationListResponseSchema>

export const ChatConversationIdParamSchema = z.object({
  id: z.string().uuid(),
})

/** Who is asking. Same shape the claim modules use — an id and the permissions of the session. */
export interface ChatActor {
  id: string
  permissions: readonly string[]
}
