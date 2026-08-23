import {
  INTERNAL_DOMACE_CLAIMS_VIEW_PERMISSIONS,
  INTERNAL_EMOTIVE_CLAIMS_VIEW_PERMISSIONS,
} from '@mr/shared'

import { NotFoundError } from '../../core/errors/domain-errors.js'
import type { ChatRepository, ChatVisibilityScope } from './chat.repository.js'
import type {
  ChatActor,
  ChatConversationListResponse,
  ChatMessagesPage,
  ChatMessagesQuery,
} from './chat.validators.js'

function holdsAny(actor: ChatActor, permissions: readonly string[]): boolean {
  return permissions.some((permission) => actor.permissions.includes(permission))
}

/**
 * ⚠ The INTERNAL sets, and nothing else.
 *
 * A claim thread is an internal conversation about a claim, so it follows the permission that
 * opens the claim on an INTERNAL screen. `emotive_claims.view_own_customer` is the portal
 * client's permission — reading it here would hand him the shop's own conversations. Spec §3.3.
 */
function scopeFor(actor: ChatActor): ChatVisibilityScope {
  return {
    userId: actor.id,
    canReadEmotiveClaims: holdsAny(actor, INTERNAL_EMOTIVE_CLAIMS_VIEW_PERMISSIONS),
    canReadDomaceClaims: holdsAny(actor, INTERNAL_DOMACE_CLAIMS_VIEW_PERMISSIONS),
  }
}

export class ChatService {
  constructor(private readonly repo: ChatRepository) {}

  async listConversations(actor: ChatActor): Promise<ChatConversationListResponse> {
    const items = await this.repo.listConversations(scopeFor(actor))

    return {
      items,
      // Task 5 sums the unread numbers here, muted conversations excluded.
      unreadTotal: items.reduce((total, item) => total + (item.isMuted ? 0 : item.unreadCount), 0),
    }
  }

  async listMessages(
    conversationId: string,
    query: ChatMessagesQuery,
    actor: ChatActor,
  ): Promise<ChatMessagesPage> {
    const scope = scopeFor(actor)
    const conversation = await this.repo.findVisibleConversation(conversationId, scope)
    // 404, never 403: a conversation he may not read is one that, for him, is not there.
    if (conversation === null) {
      throw new NotFoundError('Chat conversation', conversationId)
    }

    return this.repo.listMessages(conversationId, query, scope.userId)
  }
}
