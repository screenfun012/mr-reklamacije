import { ChatConversationListResponseSchema, ClaimKind } from '@mr/shared'
import { z } from 'zod'

export {
  ChatChannelCreateInputSchema,
  ChatChannelManagementQuerySchema,
  ChatEditInputSchema,
  ChatMarkReadInputSchema,
  ChatMessagesQuerySchema,
  ChatSendInputSchema,
  type ChatChannelCreateInput,
  type ChatChannelManagementListResponse,
  type ChatChannelManagementQuery,
  type ChatConversationListItem,
  type ChatClaimThreadLookup,
  type ChatMembersResponse,
  type ChatSendInput,
  type ChatMessage,
  type ChatMessagesPage,
  type ChatMessagesQuery,
  type ChatPeopleResponse,
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

/**
 * Who is asking: the id, the permissions and the ROLES of the session.
 *
 * Roles are here for one rule — an admin may take down anybody's pin (spec §5 row 11). Chat has no
 * permission of its own to test (N4), so the check names the role, the way `users.service.ts`
 * already reads `roles` where the concept IS the role.
 */
export interface ChatActor {
  id: string
  permissions: readonly string[]
  roles: readonly string[]
}

/**
 * ⚠ The name is NOT unique in the database, deliberately. Two „Nabavka" are allowed: a name is a
 * label, not a key, and enforcing it would mean a migration for a problem nobody has reported.
 */
export const ChatChannelInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
})

export const ChatMembersInputSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(200),
})

export const ChatMemberParamSchema = z.object({
  userId: z.string().uuid(),
})

/** A file id in a room's URL — parsed like every other id, never trusted as a string. */
export const ChatAttachmentIdParamSchema = z.object({
  attachmentId: z.string().uuid(),
})

export const ChatMessageIdParamSchema = z.object({
  id: z.string().uuid(),
})
