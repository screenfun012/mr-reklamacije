import type { Logger } from '@mr/logger'
import {
  INTERNAL_DOMACE_CLAIMS_VIEW_PERMISSIONS,
  INTERNAL_EMOTIVE_CLAIMS_VIEW_PERMISSIONS,
} from '@mr/shared'

import { ConflictError, NotFoundError } from '../../core/errors/domain-errors.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { ChatRepository, ChatVisibilityScope } from './chat.repository.js'
import type {
  ChatActor,
  ChatConversationListResponse,
  ChatMessage,
  ChatMessagesPage,
  ChatMessagesQuery,
  ChatSendInput,
} from './chat.validators.js'

/** `created` is what separates 201 from 200 — a retry stored nothing and must not claim it did. */
export interface ChatSendResult {
  message: ChatMessage
  created: boolean
}

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
  constructor(
    private readonly repo: ChatRepository,
    private readonly events: EventBus,
    private readonly logger: Logger,
  ) {}

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
    const scope = await this.requireVisible(conversationId, actor)

    return this.repo.listMessages(conversationId, query, scope.userId)
  }

  /**
   * Only a member may post, and "member" is the same visible set the reads use — a conversation
   * he cannot read is one he cannot write into, and it answers 404 rather than 403.
   */
  async send(
    conversationId: string,
    input: ChatSendInput,
    actor: ChatActor,
  ): Promise<ChatSendResult> {
    await this.requireVisible(conversationId, actor)

    const stored = await this.repo.insertMessage({
      conversationId,
      authorId: actor.id,
      clientMsgId: input.clientMsgId,
      body: input.body,
      quoteOf: input.quoteOf ?? null,
    })
    if (stored === null) {
      throw new ConflictError('Chat message could not be stored')
    }

    const message = await this.repo.findMessageById(stored.id, actor.id)
    if (message === null) {
      throw new NotFoundError('Chat message', stored.id)
    }

    // A retry wrote nothing, so it announces nothing — one message, one signal.
    if (stored.created) {
      this.announce(conversationId, message.id)
    }

    return { message, created: stored.created }
  }

  /** No audit entry: how far someone has read is view-tracking, not a business state change. */
  async markRead(conversationId: string, lastSeq: bigint, actor: ChatActor): Promise<void> {
    const scope = await this.requireVisible(conversationId, actor)

    await this.repo.markRead(conversationId, scope.userId, lastSeq)
  }

  /**
   * Best-effort, after the write, and it never throws back at the sender: the message is stored,
   * and a bus that is down must not turn a delivered message into a 500. The listeners recover on
   * their next read anyway — that is what the overlapping recovery window is for. Same rule as
   * `fanOut()` in the notifications service.
   */
  private announce(conversationId: string, messageId: string): void {
    try {
      this.events.publishChatMessageCreated(conversationId, messageId)
    } catch (error) {
      this.logger.error({ err: error }, 'Chat message signal failed')
    }
  }

  /** 404, never 403: a conversation he may not read is one that, for him, is not there. */
  private async requireVisible(
    conversationId: string,
    actor: ChatActor,
  ): Promise<ChatVisibilityScope> {
    const scope = scopeFor(actor)
    const conversation = await this.repo.findVisibleConversation(conversationId, scope)
    if (conversation === null) {
      throw new NotFoundError('Chat conversation', conversationId)
    }

    return scope
  }
}
