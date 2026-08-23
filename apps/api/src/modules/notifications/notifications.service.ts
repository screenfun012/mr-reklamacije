import type { Logger } from '@mr/logger'
import {
  ClaimKind,
  NotificationEntityType,
  NotificationType,
  type NotificationCatalog,
  type Permission,
} from '@mr/shared'

import { NotFoundError, ValidationError } from '../../core/errors/domain-errors.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type {
  ChatMentionNotification,
  ClaimNotificationContext,
  NotificationsPort,
} from '../../core/ports/notifications-port.js'
import type { NotificationsRepository } from './notifications.repository.js'
import type { NotificationInsert } from './notifications.types.js'
import type { NotificationListQuery, NotificationListResponse } from './notifications.validators.js'

/** Keyed so a new claim family cannot inherit DOMACE's entity type by accident. */
const ENTITY_TYPE_BY_KIND: Record<ClaimKind, NotificationEntityType> = {
  [ClaimKind.Emotive]: NotificationEntityType.EmotiveClaim,
  [ClaimKind.Domace]: NotificationEntityType.DomaceClaim,
}

function claimEntityType(kind: ClaimKind): NotificationEntityType {
  return ENTITY_TYPE_BY_KIND[kind]
}

/** Who may see a claim of this kind at all — the natural audience for its events. */
/** Who hears about a claim of this kind — wrong audience is a leak, not a nuisance. */
const VIEW_PERMISSION_BY_KIND: Record<ClaimKind, Permission> = {
  [ClaimKind.Emotive]: 'emotive_claims.view',
  [ClaimKind.Domace]: 'domace_claims.view',
}

function claimViewPermission(kind: ClaimKind): Permission {
  return VIEW_PERMISSION_BY_KIND[kind]
}

export class NotificationsService implements NotificationsPort {
  constructor(
    private readonly repo: NotificationsRepository,
    private readonly events: EventBus,
    private readonly logger: Logger,
  ) {}

  async list(userId: string, query: NotificationListQuery): Promise<NotificationListResponse> {
    const { items, total, unreadCount } = await this.repo.list(userId, query)
    return { items, total, page: query.page, pageSize: query.pageSize, unreadCount }
  }

  /** No audit entry: reading your own inbox is view-tracking, not a business state change. */
  async markRead(userId: string, id: string): Promise<void> {
    const updated = await this.repo.markRead(userId, id)
    if (!updated) {
      throw new NotFoundError('Notification', id)
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.markAllRead(userId)
  }

  /** No audit entry: clearing your own inbox is personal, not a business state change. */
  async delete(userId: string, id: string): Promise<void> {
    const removed = await this.repo.deleteOwn(userId, id)
    if (!removed) {
      throw new NotFoundError('Notification', id)
    }
  }

  async deleteAll(userId: string): Promise<void> {
    await this.repo.deleteAllOwn(userId)
  }

  async snooze(userId: string, id: string, until: Date): Promise<void> {
    if (until.getTime() <= Date.now()) {
      throw new ValidationError('Snooze target must be in the future')
    }

    const updated = await this.repo.snooze(userId, id, until)
    if (!updated) {
      throw new NotFoundError('Notification', id)
    }
  }

  async notifyNewSubmission(
    actorUserId: string,
    submissionId: string,
    customerName: string,
  ): Promise<void> {
    return this.fanOut(async () => {
      const recipients = await this.repo.findRecipientsWithPermission(
        'client_submissions.manage',
        actorUserId,
      )
      return recipients.map((userId) => ({
        userId,
        type: NotificationType.NewSubmission,
        entityType: NotificationEntityType.ClientSubmission,
        entityId: submissionId,
        data: { customerName },
      }))
    })
  }

  async notifyClaimCreated(actorUserId: string, claim: ClaimNotificationContext): Promise<void> {
    return this.fanOut(async () => {
      const [recipients, assigneeUserId] = await Promise.all([
        this.repo.findRecipientsWithPermission(claimViewPermission(claim.kind), actorUserId),
        this.resolveAssignee(claim.employeeId, actorUserId),
      ])

      const rows: NotificationInsert[] = recipients
        // The assignee gets the more specific `assigned_to_me` instead — never both.
        .filter((userId) => userId !== assigneeUserId)
        .map((userId) => ({
          userId,
          type: NotificationType.ClaimCreated,
          entityType: claimEntityType(claim.kind),
          entityId: claim.id,
          data: { mrNumber: claim.mrNumber, customerName: claim.customerName },
        }))

      if (assigneeUserId !== null) {
        rows.push(this.assignedRow(assigneeUserId, claim))
      }

      return rows
    })
  }

  async notifyClaimAssigned(actorUserId: string, claim: ClaimNotificationContext): Promise<void> {
    return this.fanOut(async () => {
      const assigneeUserId = await this.resolveAssignee(claim.employeeId, actorUserId)
      return assigneeUserId === null ? [] : [this.assignedRow(assigneeUserId, claim)]
    })
  }

  async notifyOutcomeChanged(actorUserId: string, claim: ClaimNotificationContext): Promise<void> {
    return this.fanOut(async () => {
      const recipients = await this.repo.findRecipientsWithPermission(
        claimViewPermission(claim.kind),
        actorUserId,
      )
      return recipients.map((userId) => ({
        userId,
        type: NotificationType.OutcomeChanged,
        entityType: claimEntityType(claim.kind),
        entityId: claim.id,
        data: { mrNumber: claim.mrNumber, outcome: claim.outcome },
      }))
    })
  }

  async notifyCatalogAdded(
    actorUserId: string,
    catalog: NotificationCatalog,
    itemId: string,
    itemName: string,
  ): Promise<void> {
    return this.fanOut(async () => {
      // A catalog entry unblocks claim entry, so the audience is "anyone who works claims".
      const recipients = await this.repo.findRecipientsWithPermission(
        'emotive_claims.view',
        actorUserId,
      )
      return recipients.map((userId) => ({
        userId,
        type: NotificationType.CatalogAdded,
        entityType: NotificationEntityType.Catalog,
        entityId: itemId,
        data: { catalog, itemName },
      }))
    })
  }

  /**
   * A client submission was CONVERTED into a claim. The team's "new submission"
   * notifications for it are removed and replaced by the standard `claim_created`
   * notification for the new claim — so the bell now points at the claim that was
   * made, not the handled submission. The actor is excluded by notifyClaimCreated.
   */
  async notifySubmissionConverted(
    actorUserId: string,
    submissionId: string,
    claim: ClaimNotificationContext,
  ): Promise<void> {
    await this.resolveSubmission(submissionId, actorUserId)
    await this.notifyClaimCreated(actorUserId, claim)
  }

  /**
   * A client submission was REJECTED. The "new submission" notifications are
   * removed and replaced by a `submission_rejected` notification that still points
   * at the submission, so the team can open it and read the rejection reason.
   */
  async notifySubmissionRejected(
    actorUserId: string,
    submissionId: string,
    customerName: string,
  ): Promise<void> {
    await this.resolveSubmission(submissionId, actorUserId, async (recipients) =>
      recipients.map((userId) => ({
        userId,
        type: NotificationType.SubmissionRejected,
        entityType: NotificationEntityType.ClientSubmission,
        entityId: submissionId,
        data: { customerName },
      })),
    )
  }

  /**
   * Shared reconciliation for a handled submission: delete the old rows, refresh
   * the bell of anyone who is NOT about to get a replacement (so their stale
   * "new submission" clears at once), then optionally fan out replacements.
   * Best-effort like every fan-out — never rejects.
   */
  private async resolveSubmission(
    submissionId: string,
    actorUserId: string,
    buildReplacements?: (recipients: string[]) => Promise<readonly NotificationInsert[]>,
  ): Promise<void> {
    // Delete-then-insert on purpose, and NOT in one transaction: the business op
    // (convert/reject) already committed, and notifications are best-effort. This
    // order means a crash between the two leaves NOTHING (a clean miss of a
    // convenience notification), which is better than insert-then-delete leaving
    // a stale "new submission" duplicate that would never clear.
    try {
      const affected = await this.repo.deleteByEntity(
        NotificationEntityType.ClientSubmission,
        submissionId,
      )
      // Everyone whose row was removed needs their bell refreshed; those who also
      // get a replacement will be signalled again by fanOut below.
      for (const userId of affected) {
        this.events.publishNotificationCreated(userId, submissionId)
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to clear submission notifications')
    }

    if (buildReplacements === undefined) {
      return
    }

    await this.fanOut(async () => {
      const recipients = await this.repo.findRecipientsWithPermission(
        'client_submissions.manage',
        actorUserId,
      )
      return buildReplacements(recipients)
    })
  }

  private assignedRow(userId: string, claim: ClaimNotificationContext): NotificationInsert {
    return {
      userId,
      type: NotificationType.AssignedToMe,
      entityType: claimEntityType(claim.kind),
      entityId: claim.id,
      data: { mrNumber: claim.mrNumber },
    }
  }

  private async resolveAssignee(
    employeeId: string | null,
    actorUserId: string,
  ): Promise<string | null> {
    if (employeeId === null) {
      return null
    }
    return this.repo.findEmployeeUserId(employeeId, actorUserId)
  }

  /**
   * Writes a fan-out and emits one signal-only SSE event per created row. Best-effort by
   * design: the caller has already persisted and audited the business change, so a failure
   * here is logged and swallowed rather than rolled onto the user.
   */
  async notifyChatMention(actorUserId: string, mention: ChatMentionNotification): Promise<void> {
    return this.fanOut(async () => {
      // Already rung for THIS message — an edit that adds a mention must reach only the new names.
      const alreadyRung = new Set(await this.repo.findMentionRecipients(mention.messageId))

      return mention.recipientIds
        .filter((userId) => userId !== actorUserId && !alreadyRung.has(userId))
        .map((userId) => ({
          userId,
          type: NotificationType.ChatMention,
          entityType: NotificationEntityType.ChatMessage,
          entityId: mention.messageId,
          data: {
            authorName: mention.authorName,
            conversationId: mention.conversationId,
            conversationTitle: mention.conversationTitle,
            excerpt: mention.excerpt,
          },
        }))
    })
  }

  private async fanOut(build: () => Promise<readonly NotificationInsert[]>): Promise<void> {
    try {
      const rows = await build()
      if (rows.length === 0) {
        return
      }

      const created = await this.repo.insertMany(rows)
      for (const row of created) {
        this.events.publishNotificationCreated(row.userId, row.id)
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Notification fan-out failed')
    }
  }
}
