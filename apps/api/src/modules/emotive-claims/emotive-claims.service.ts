import {
  AuditAction,
  ClaimKind,
  ClaimOutcome,
  type ClaimEventPayload,
  type EmotiveClaimFaultInput,
} from '@mr/shared'
import type { Logger } from '@mr/logger'

import type { ApiClaimTxExecutor } from '../../core/database.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import { validateEngineTypeManufacturerPair } from '../../core/claims/validate-engine-type-manufacturer-pair.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/domain-errors.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EmailPort } from '../../core/ports/email-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { AppSettingsReader } from '../../core/settings/app-settings.reader.js'
import {
  outcomeChangedEmailSubject,
  renderOutcomeChangedEmailHtml,
} from './emotive-claims.email.js'
import type { EmotiveClaimsRepository } from './emotive-claims.repository.js'
import type { EmotiveClaimsActor, EmotiveClaimsListScope } from './emotive-claims.types.js'
import type {
  EmotiveClaimChangeOutcomeInput,
  EmotiveClaimCreateInput,
  EmotiveClaimDetail,
  EmotiveClaimListQuery,
  EmotiveClaimListResponse,
  EmotiveClaimUpdateInput,
} from './emotive-claims.validators.js'

function resolveListScope(actor: EmotiveClaimsActor): EmotiveClaimsListScope {
  if (actor.permissions.includes('emotive_claims.view')) {
    return { type: 'all' }
  }

  if (actor.permissions.includes('emotive_claims.view_own_customer')) {
    return { type: 'own_customer', userId: actor.id }
  }

  throw new ForbiddenError()
}

function emotiveEventPayload(id: string): ClaimEventPayload {
  return { kind: ClaimKind.Emotive, id }
}

// Admin hook (docs/13): setting the value to the string 'false' turns the
// client outcome-change email off; anything else (including unset) leaves it on.
const NOTIFY_CLIENT_SETTING_KEY = 'emotive_claims.notify_client_on_outcome'

export class EmotiveClaimsService {
  constructor(
    private readonly repo: EmotiveClaimsRepository,
    private readonly audit: AuditPort,
    private readonly events: EventBus,
    private readonly emailPort: EmailPort,
    private readonly appSettings: AppSettingsReader,
    private readonly portalBaseUrl: string,
    private readonly logger: Logger,
  ) {}

  async create(
    input: EmotiveClaimCreateInput,
    actor: EmotiveClaimsActor,
    auditContext: HttpActorContext,
  ): Promise<EmotiveClaimDetail> {
    await this.validateCreateReferences(input)

    const customerId =
      input.customerId ??
      (input.sourceId !== undefined
        ? await this.repo.getSourceDefaultCustomerId(input.sourceId)
        : null)

    const created = await this.repo.create(input, auditContext.actorUserId, customerId)

    await this.audit.log({
      entityType: 'emotive_claim',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { after: created },
    })

    this.events.publishClaimCreated(emotiveEventPayload(created.id), created.customerId)

    return created
  }

  /**
   * Creates an emotive claim inside a caller-provided transaction (used by the
   * client-submissions conversion to stay atomic with the attachment re-point + submission
   * status update). Validates references exactly like {@link create}; the caller owns audit
   * and event emission after the transaction commits. Returns the new claim id.
   */
  async createWithinTransaction(
    tx: ApiClaimTxExecutor,
    input: EmotiveClaimCreateInput,
    actorUserId: string,
  ): Promise<string> {
    await this.validateCreateReferences(input)

    const customerId =
      input.customerId ??
      (input.sourceId !== undefined
        ? await this.repo.getSourceDefaultCustomerId(input.sourceId)
        : null)

    return this.repo.createWithinTransaction(tx, input, actorUserId, customerId)
  }

  async list(
    query: EmotiveClaimListQuery,
    actor: EmotiveClaimsActor,
  ): Promise<EmotiveClaimListResponse> {
    const scope = resolveListScope(actor)
    return this.repo.list(query, scope)
  }

  async findById(id: string, actor: EmotiveClaimsActor): Promise<EmotiveClaimDetail> {
    const scope = resolveListScope(actor)
    const claim = await this.repo.findById(id, scope)

    if (claim === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    // A claim with neither timestamp set is "Primljeno" (received) — it still
    // shows as a card in the client's list, but the client must not be able to
    // open its detail. Existence-hiding (security rule): 404, not 403.
    if (
      scope.type === 'own_customer' &&
      claim.clientVisibleAt === null &&
      claim.publishedAt === null
    ) {
      throw new NotFoundError('Emotive claim', id)
    }

    // Phase 3 freshness: opening the detail is what clears the client's NEW/UPDATE
    // badge on the list. Best-effort — a write failure here must not break the read
    // (already-persisted, already-visible claim). Never recorded for `type === 'all'`:
    // an operator previewing the claim must not clear the client's own badge.
    if (scope.type === 'own_customer') {
      try {
        await this.repo.recordClientView(scope.userId, id)
      } catch (error) {
        this.logger.error(
          { err: error, claimId: id, userId: scope.userId },
          'Failed to record client claim view',
        )
      }
    }

    return claim
  }

  async update(
    id: string,
    input: EmotiveClaimUpdateInput,
    actor: EmotiveClaimsActor,
    auditContext: HttpActorContext,
  ): Promise<EmotiveClaimDetail> {
    const scope = resolveListScope(actor)
    const before = await this.repo.findById(id, scope)
    if (before === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    await this.validateUpdateReferences(input)

    const updated = await this.repo.update(id, input, auditContext.actorUserId, before, scope)

    await this.audit.log({
      entityType: 'emotive_claim',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { before, after: updated },
    })

    this.events.publishClaimUpdated(emotiveEventPayload(id), updated.customerId)

    return updated
  }

  async softDelete(
    id: string,
    actor: EmotiveClaimsActor,
    auditContext: HttpActorContext,
  ): Promise<void> {
    const scope = resolveListScope(actor)
    const before = await this.repo.findById(id, scope)
    if (before === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    await this.repo.softDelete(id, auditContext.actorUserId, before)

    await this.audit.log({
      entityType: 'emotive_claim',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { before },
    })

    this.events.publishClaimDeleted(emotiveEventPayload(id), before.customerId)
  }

  async restore(
    id: string,
    actor: EmotiveClaimsActor,
    auditContext: HttpActorContext,
  ): Promise<EmotiveClaimDetail> {
    if (!actor.permissions.includes('emotive_claims.restore')) {
      throw new ForbiddenError()
    }

    const scope = resolveListScope(actor)
    const before = await this.repo.findDeletedById(id, scope)
    if (before === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    const restored = await this.repo.restore(id, auditContext.actorUserId, before, scope)

    await this.audit.log({
      entityType: 'emotive_claim',
      entityId: id,
      action: AuditAction.Restore,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { before, after: restored },
    })

    this.events.publishClaimUpdated(emotiveEventPayload(id), restored.customerId)

    return restored
  }

  async changeOutcome(
    id: string,
    input: EmotiveClaimChangeOutcomeInput,
    actor: EmotiveClaimsActor,
    auditContext: HttpActorContext,
  ): Promise<EmotiveClaimDetail> {
    const scope = resolveListScope(actor)
    const before = await this.repo.findById(id, scope)
    if (before === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    const updated = await this.repo.changeOutcome(
      id,
      input,
      auditContext.actorUserId,
      before,
      scope,
    )

    await this.audit.log({
      entityType: 'emotive_claim',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { before, after: updated, outcome: input.outcome },
    })

    this.events.publishClaimUpdated(emotiveEventPayload(id), updated.customerId)

    // Best-effort notification — fire-and-settle so a slow Resend call never
    // adds latency to the outcome change (already persisted, audited, emitted).
    void this.notifyClientOutcomeChanged(updated).catch((error) => {
      this.logger.error(
        { err: error, claimId: id },
        'Unexpected error dispatching outcome-change notification',
      )
    })

    return updated
  }

  /**
   * Gate B: the operator's explicit "Objavi/Publish" action — stamps `published_at`
   * so the client wire-masking (`toClientClaimDetail`/`toClientClaimListItem`) starts
   * showing the real outcome instead of the masked "pending" placeholder. Always
   * full-scope (`{ type: 'all' }`) — this is an operator action, not a scoped read.
   */
  async publish(id: string, auditContext: HttpActorContext): Promise<EmotiveClaimDetail> {
    const before = await this.repo.findById(id, { type: 'all' })
    if (before === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    // Idempotent: already published — no duplicate audit row or SSE event, still a
    // normal 200 with the unchanged claim.
    if (before.publishedAt !== null) {
      return before
    }

    await this.repo.publish(id, auditContext.actorUserId)

    await this.audit.log({
      entityType: 'emotive_claim',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { transition: 'publish' },
    })

    this.events.publishClaimUpdated(emotiveEventPayload(id), before.customerId)

    const updated = await this.repo.findById(id, { type: 'all' })
    if (updated === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    // Best-effort notification — fire-and-settle (see changeOutcome). The guard inside
    // notifyClientOutcomeChanged only sends when the outcome is decided, so publishing a
    // still-pending claim stays silent.
    void this.notifyClientOutcomeChanged(updated).catch((error) => {
      this.logger.error(
        { err: error, claimId: id },
        'Unexpected error dispatching outcome-change notification',
      )
    })

    return updated
  }

  /** Never throws — a failed client email must not break the outcome change. */
  private async notifyClientOutcomeChanged(claim: EmotiveClaimDetail): Promise<void> {
    // Gate B: the client portal masks the outcome until `published_at` is set, so an
    // email must never fire while the claim is still private (or still pending) — that
    // would leak or misstate what the client can't yet see.
    if (claim.publishedAt === null || claim.outcome === ClaimOutcome.Pending) {
      return
    }

    if (!this.emailPort.enabled || claim.customerId === null) {
      return
    }

    const toggle = await this.appSettings.getString(NOTIFY_CLIENT_SETTING_KEY)
    if (toggle === 'false') {
      return
    }

    const recipients = await this.repo.getOutcomeNotificationRecipients(claim.customerId)

    for (const recipient of recipients) {
      try {
        await this.emailPort.send({
          to: recipient.email,
          subject: outcomeChangedEmailSubject(claim.mrNumber, recipient.preferredLanguage),
          html: renderOutcomeChangedEmailHtml({
            name: recipient.name,
            mrNumber: claim.mrNumber,
            url: this.portalBaseUrl,
            locale: recipient.preferredLanguage,
          }),
        })
      } catch (error) {
        this.logger.error(
          { err: error, claimId: claim.id, to: recipient.email },
          'Failed to send outcome-change email',
        )
      }
    }
  }

  private async validateCreateReferences(input: EmotiveClaimCreateInput): Promise<void> {
    const [engineTypeActive, manufacturerActive, employeeActive, sourceActive, customerActive] =
      await Promise.all([
        this.repo.isEngineTypeActive(input.engineTypeId),
        input.manufacturerId !== undefined
          ? this.repo.isManufacturerActive(input.manufacturerId)
          : Promise.resolve(true),
        input.employeeId !== undefined
          ? this.repo.isEmployeeActive(input.employeeId)
          : Promise.resolve(true),
        input.sourceId !== undefined
          ? this.repo.isClaimSourceActive(input.sourceId)
          : Promise.resolve(true),
        input.customerId !== undefined
          ? this.repo.isCustomerActive(input.customerId)
          : Promise.resolve(true),
      ])

    if (!engineTypeActive) {
      throw new ValidationError('Invalid or inactive engine type')
    }
    if (!manufacturerActive) {
      throw new ValidationError('Invalid or inactive engine manufacturer')
    }
    if (!employeeActive) {
      throw new ValidationError('Invalid or inactive employee')
    }
    if (!sourceActive) {
      throw new ValidationError('Invalid or inactive claim source')
    }
    if (!customerActive) {
      throw new ValidationError('Invalid or inactive customer')
    }

    await this.validateFaults(input.faults)
    await this.validateManufacturerEngineTypePair(input.manufacturerId, input.engineTypeId)
  }

  private async validateManufacturerEngineTypePair(
    manufacturerId: string | null | undefined,
    engineTypeId: string | null | undefined,
  ): Promise<void> {
    if (
      manufacturerId === undefined ||
      manufacturerId === null ||
      engineTypeId === undefined ||
      engineTypeId === null
    ) {
      return
    }

    await validateEngineTypeManufacturerPair(
      (id) => this.repo.getEngineTypeManufacturerId(id),
      engineTypeId,
      manufacturerId,
    )
  }

  private async validateUpdateReferences(input: EmotiveClaimUpdateInput): Promise<void> {
    type ReferenceCheck = { active: Promise<boolean>; message: string }
    const checks: ReferenceCheck[] = []

    if (input.engineTypeId !== undefined) {
      checks.push({
        active: this.repo.isEngineTypeActive(input.engineTypeId),
        message: 'Invalid or inactive engine type',
      })
    }
    if (input.manufacturerId !== undefined && input.manufacturerId !== null) {
      checks.push({
        active: this.repo.isManufacturerActive(input.manufacturerId),
        message: 'Invalid or inactive engine manufacturer',
      })
    }
    if (input.employeeId !== undefined && input.employeeId !== null) {
      checks.push({
        active: this.repo.isEmployeeActive(input.employeeId),
        message: 'Invalid or inactive employee',
      })
    }
    if (input.sourceId !== undefined) {
      checks.push({
        active: this.repo.isClaimSourceActive(input.sourceId),
        message: 'Invalid or inactive claim source',
      })
    }
    if (input.customerId !== undefined && input.customerId !== null) {
      checks.push({
        active: this.repo.isCustomerActive(input.customerId),
        message: 'Invalid or inactive customer',
      })
    }

    const results = await Promise.all(checks.map((check) => check.active))
    for (const [index, active] of results.entries()) {
      if (!active) {
        const failed = checks[index]
        if (failed !== undefined) {
          throw new ValidationError(failed.message)
        }
      }
    }

    if (input.faults !== undefined) {
      await this.validateFaults(input.faults)
    }

    await this.validateManufacturerEngineTypePair(input.manufacturerId, input.engineTypeId)
  }

  private async validateFaults(faults: readonly EmotiveClaimFaultInput[]): Promise<void> {
    await Promise.all(
      faults.map(async (fault) => {
        switch (fault.faultType) {
          case 'employee':
            if (!(await this.repo.isEmployeeActive(fault.employeeId))) {
              throw new ValidationError('Invalid or inactive employee')
            }
            break
          case 'department':
            if (!(await this.repo.isDepartmentActive(fault.departmentId))) {
              throw new ValidationError('Invalid or inactive department')
            }
            break
          case 'external':
            if (!(await this.repo.isExternalPartyActive(fault.externalPartyId))) {
              throw new ValidationError('Invalid or inactive external party')
            }
            break
        }
      }),
    )
  }
}
