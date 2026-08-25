import type { ClaimKind, ClaimOutcome, NotificationCatalog } from '@mr/shared'

import type { ApiDatabase } from '../database.js'

/** The claim facts a notification needs to render its title — never claim internals. */
export interface ClaimNotificationContext {
  readonly kind: ClaimKind
  readonly id: string
  readonly mrNumber: string | null
  readonly customerName: string | null
  readonly employeeId: string | null
  readonly outcome: ClaimOutcome
}

/** What the bell needs to say "X mentioned you" and to open the room it happened in. */
export interface ChatMentionNotification {
  readonly messageId: string
  readonly conversationId: string
  /** The channel's name or the thread's MR number. */
  readonly conversationTitle: string
  readonly authorName: string
  /** The first words, already stripped of mention markup. */
  readonly excerpt: string
  /** Everybody to ring, resolved by the chat module against who may see the conversation. */
  readonly recipientIds: readonly string[]
}

/**
 * The slice of the notifications service other domain modules call for fan-out. A core
 * port so those modules depend on core, not a sibling module (depcruise
 * `no-sibling-modules`); the container injects the concrete `NotificationsService`.
 *
 * Every method is best-effort and NEVER rejects — a notification is not worth failing
 * the business operation it describes. The acting user is always excluded.
 */
export interface NotificationsPort {
  notifyNewSubmission(
    actorUserId: string,
    submissionId: string,
    customerName: string,
  ): Promise<void>

  /** `claim_created` to everyone who may view the kind, `assigned_to_me` to the assignee instead. */
  notifyClaimCreated(actorUserId: string, claim: ClaimNotificationContext): Promise<void>

  /** The assignee only — call when an update points `employeeId` at someone new. */
  notifyClaimAssigned(actorUserId: string, claim: ClaimNotificationContext): Promise<void>

  notifyOutcomeChanged(actorUserId: string, claim: ClaimNotificationContext): Promise<void>

  notifyCatalogAdded(
    actorUserId: string,
    catalog: NotificationCatalog,
    itemId: string,
    itemName: string,
  ): Promise<void>

  /** A submission was converted → replace its new_submission notifications with claim_created. */
  notifySubmissionConverted(
    actorUserId: string,
    submissionId: string,
    claim: ClaimNotificationContext,
  ): Promise<void>

  /**
   * Somebody was named in a chat message.
   *
   * The chat module resolves the recipients, because it is the only place that knows who can see a
   * conversation. What is decided HERE is who has already been rung for this message: an edit may
   * add a mention (15-minute window) and must not ring anybody a second time.
   */
  notifyChatMention(
    actorUserId: string,
    mention: ChatMentionNotification,
    executor?: ApiDatabase,
    onCreated?: (userId: string, notificationId: string) => void,
  ): Promise<void>

  /** Forget every mention notification pointing into one conversation, in one bounded query. */
  dropForChatConversation(conversationId: string, executor?: ApiDatabase): Promise<void>

  /** A submission was rejected → replace its new_submission notifications with submission_rejected. */
  notifySubmissionRejected(
    actorUserId: string,
    submissionId: string,
    customerName: string,
  ): Promise<void>
}
