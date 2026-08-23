import { ChatConversationListResponseSchema, ClaimKind } from '@mr/shared'
import { z } from 'zod'

export {
  ChatMarkReadInputSchema,
  ChatMessagesQuerySchema,
  ChatSendInputSchema,
  type ChatConversationListItem,
  type ChatSendInput,
  type ChatMessage,
  type ChatMessagesPage,
  type ChatMessagesQuery,
} from '@mr/shared'

export type ChatConversationListResponse = z.infer<typeof ChatConversationListResponseSchema>

export const ChatConversationIdParamSchema = z.object({
  id: z.string().uuid(),
})

/** Which claim's thread. The kind is in the path because the two families are two tables. */
export const ChatClaimThreadParamSchema = z.object({
  kind: z.enum([ClaimKind.Emotive, ClaimKind.Domace]),
  id: z.string().uuid(),
})

/** Who is asking. Same shape the claim modules use — an id and the permissions of the session. */
export interface ChatActor {
  id: string
  permissions: readonly string[]
}
