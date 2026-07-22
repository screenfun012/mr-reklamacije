import type { Logger } from '@mr/logger'
import {
  AuditAction,
  ClaimKind,
  ClientSubmissionStatus,
  CustomerKind,
  SUPPORT_EMAIL_BY_KIND,
  type ClientSubmissionCreateInput,
  type EmotiveClaimCreateInput,
  type EmotiveClaimDetail,
} from '@mr/shared'
import { and, eq, isNull } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EmailPort } from '../../core/ports/email-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { NotificationsPort } from '../../core/ports/notifications-port.js'
import type { EmotiveClaimsConversionPort } from '../../core/ports/emotive-claims-conversion-port.js'
import type { AppSettingsReader } from '../../core/settings/app-settings.reader.js'
import {
  renderSubmissionNotificationHtml,
  submissionNotificationSubject,
} from './client-submissions.email.js'
import type { ClientSubmissionsRepository } from './client-submissions.repository.js'
import { attachments } from './client-submissions.schema.js'
import type {
  ClientSubmissionDetail,
  ClientSubmissionListItem,
} from './client-submissions.validators.js'

/** Admin-configurable recipient for new-submission notifications (docs/18 §10). */
const NOTIFY_EMAIL_SETTING_KEY = 'client_submissions.notify_email'
const DEFAULT_NOTIFY_EMAIL = SUPPORT_EMAIL_BY_KIND[ClaimKind.Emotive]
const ENTITY_TYPE = 'client_submission'
/** Internal all-scope read of the claim the operator just created (they own the conversion). */
const EMOTIVE_VIEW_PERMISSION = 'emotive_claims.view'

export class ClientSubmissionsService {
  constructor(
    private readonly db: ApiDatabase,
    private readonly repo: ClientSubmissionsRepository,
    private readonly emotiveClaims: EmotiveClaimsConversionPort,
    private readonly emailPort: EmailPort,
    private readonly events: EventBus,
    private readonly audit: AuditPort,
    private readonly appSettings: AppSettingsReader,
    private readonly logger: Logger,
    /** Internal-web origin used to build the "/pristiglo" link in the notification email. */
    private readonly internalBaseUrl: string,
    private readonly notifications: NotificationsPort,
  ) {}

  /** Pending submissions for the internal Inbox, newest first ({ items, total, page, pageSize }). */
  async listPending(params: { page: number; pageSize: number }): Promise<{
    items: ClientSubmissionListItem[]
    total: number
    page: number
    pageSize: number
  }> {
    const { items, total } = await this.repo.listPending(params)
    return { items, total, page: params.page, pageSize: params.pageSize }
  }

  /** Full detail for one submission; throws NotFoundError (→ 404) when it does not exist. */
  async getById(id: string): Promise<ClientSubmissionDetail> {
    const submission = await this.repo.findById(id)
    if (submission === null) {
      throw new NotFoundError('Client submission', id)
    }
    return submission
  }

  /** A logged-in portal client submits a request for their linked firm. */
  async create(
    actor: HttpActorContext,
    input: ClientSubmissionCreateInput,
  ): Promise<{ id: string }> {
    const customer = await this.repo.getPrimaryCustomerForUser(actor.actorUserId)
    if (customer === null) {
      throw new ForbiddenError('User is not linked to a customer')
    }

    const { id } = await this.repo.create({
      customerId: customer.id,
      submittedByUserId: actor.actorUserId,
      message: input.message,
    })

    await this.audit.log({
      entityType: ENTITY_TYPE,
      entityId: id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { after: { customerId: customer.id, message: input.message } },
    })

    this.events.publishClientSubmissionChanged(id)

    // In-app inbox fan-out (best-effort inside the port) — distinct from the email below.
    await this.notifications.notifyNewSubmission(actor.actorUserId, id, customer.name)

    // Best-effort notification — fire-and-settle so a slow/timing-out Resend call never adds
    // latency to the client's submit (the submission is already persisted, audited and emitted).
    // `notifyNewSubmission` swallows its own errors; the `.catch` is a defensive guard against
    // an un-awaited rejection ever becoming an unhandledRejection.
    void this.notifyNewSubmission(id, customer.name, input.message).catch((error) => {
      this.logger.error(
        { err: error, submissionId: id },
        'Unexpected error dispatching client submission notification',
      )
    })

    return { id }
  }

  /**
   * Converts a pending submission into an EMOTIVE claim. Kind-aware: reads the linked
   * customer's `kind` (only `emotive_partner` is supported today). The claim create,
   * attachment re-point and submission status update run in ONE transaction so a failure
   * leaves the submission pending with its attachments intact. Returns the created claim.
   */
  async convert(
    actor: HttpActorContext,
    id: string,
    claimInput: EmotiveClaimCreateInput,
  ): Promise<EmotiveClaimDetail> {
    const submission = await this.repo.findById(id)
    if (submission === null || submission.status !== ClientSubmissionStatus.Pending) {
      throw new NotFoundError('Client submission', id)
    }

    const kind = await this.repo.getCustomerKind(submission.customerId)
    if (kind !== CustomerKind.EmotivePartner) {
      throw new ValidationError('Domestic submissions are not supported yet')
    }

    const emotiveInput: EmotiveClaimCreateInput = {
      ...claimInput,
      customerId: submission.customerId,
      warrantyReport: claimInput.warrantyReport ?? submission.message,
    }

    const claimId = await this.db.transaction(async (tx) => {
      const newClaimId = await this.emotiveClaims.createWithinTransaction(
        tx,
        emotiveInput,
        actor.actorUserId,
      )

      // Carry the client's photos/documents over to the created claim (atomic with it).
      await tx
        .update(attachments)
        .set({ emotiveClaimId: newClaimId, claimKind: ClaimKind.Emotive, clientSubmissionId: null })
        .where(and(eq(attachments.clientSubmissionId, id), isNull(attachments.deletedAt)))

      // Compare-and-swap on status=pending: a concurrent convert (double-click / retry)
      // that already flipped the submission matches 0 rows → reject the loser and roll
      // back this claim + attachment re-point instead of creating a duplicate.
      const converted = await this.repo.markConverted(id, newClaimId, actor.actorUserId, tx)
      if (converted === 0) {
        throw new ConflictError('Submission was already handled')
      }

      return newClaimId
    })

    const claim = await this.emotiveClaims.findById(claimId, {
      id: actor.actorUserId,
      permissions: [EMOTIVE_VIEW_PERMISSION],
    })

    await this.audit.log({
      entityType: 'emotive_claim',
      entityId: claimId,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { after: claim, source: ENTITY_TYPE, clientSubmissionId: id },
    })

    await this.audit.log({
      entityType: ENTITY_TYPE,
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: {
        before: { status: submission.status },
        after: { status: ClientSubmissionStatus.Converted, linkedEmotiveClaimId: claimId },
      },
    })

    this.events.publishClaimCreated({ kind: ClaimKind.Emotive, id: claimId }, submission.customerId)
    this.events.publishClientSubmissionChanged(id)

    return claim
  }

  /** Dismisses a pending submission with an optional internal reason (not shown to the client). */
  async reject(actor: HttpActorContext, id: string, reason: string | null): Promise<void> {
    const submission = await this.repo.findById(id)
    if (submission === null || submission.status !== ClientSubmissionStatus.Pending) {
      throw new NotFoundError('Client submission', id)
    }

    // Flip status AND soft-delete the submission's photos/videos in one transaction: a rejected
    // submission never re-points its files to a claim, so a GC sweep can reclaim the storage.
    await this.db.transaction(async (tx) => {
      await this.repo.markRejected(id, reason, actor.actorUserId, tx)
      await this.repo.softDeleteAttachmentsForSubmission(id, tx)
    })

    await this.audit.log({
      entityType: ENTITY_TYPE,
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: {
        before: { status: submission.status },
        after: { status: ClientSubmissionStatus.Rejected, rejectedReason: reason },
      },
    })

    this.events.publishClientSubmissionChanged(id)
  }

  /**
   * Best-effort employee notification. A failed send never fails the submission (it is
   * already in the Inbox); a silent no-op when email is not configured.
   */
  private async notifyNewSubmission(
    submissionId: string,
    firmName: string,
    message: string,
  ): Promise<void> {
    if (!this.emailPort.enabled) {
      return
    }

    try {
      const to =
        (await this.appSettings.getString(NOTIFY_EMAIL_SETTING_KEY)) ?? DEFAULT_NOTIFY_EMAIL
      await this.emailPort.send({
        to,
        subject: submissionNotificationSubject(firmName),
        html: renderSubmissionNotificationHtml({
          firmName,
          message,
          inboxUrl: `${this.internalBaseUrl}/pristiglo`,
        }),
      })
    } catch (error) {
      this.logger.error(
        { err: error, submissionId },
        'Failed to send client submission notification',
      )
    }
  }
}
