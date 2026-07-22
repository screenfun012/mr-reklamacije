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
  ClaimNotificationContext,
  NotificationsPort,
} from '../../core/ports/notifications-port.js'
import type { NotificationsRepository } from './notifications.repository.js'
import type { NotificationInsert } from './notifications.types.js'
import type { NotificationListQuery, NotificationListResponse } from './notifications.validators.js'

function claimEntityType(kind: ClaimKind): NotificationEntityType {
  return kind === ClaimKind.Emotive
    ? NotificationEntityType.EmotiveClaim
    : NotificationEntityType.DomaceClaim
}

/** Who may see a claim of this kind at all — the natural audience for its events. */
function claimViewPermission(kind: ClaimKind): Permission {
  return kind === ClaimKind.Emotive ? 'emotive_claims.view' : 'domace_claims.view'
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
