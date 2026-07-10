import {
  AuditAction,
  ClaimKind,
  type ClaimEventPayload,
  type EmotiveClaimFaultInput,
} from '@mr/shared'

import type { HttpActorContext } from '../../core/http/actor-context.js'
import {
  assertClaimEditable,
  assertCompletedActionAllowed,
  assertOutcomeTransitionAllowed,
} from '../../core/claims/claim-lock.js'
import { isInternalNotesOnlyUpdate } from '../../core/claims/is-internal-notes-only-update.js'
import { validateEngineTypeManufacturerPair } from '../../core/claims/validate-engine-type-manufacturer-pair.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/domain-errors.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
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

const EMOTIVE_REOPEN_PERMISSION = 'emotive_claims.reopen'

export class EmotiveClaimsService {
  constructor(
    private readonly repo: EmotiveClaimsRepository,
    private readonly audit: AuditPort,
    private readonly events: EventBus,
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

    if (!isInternalNotesOnlyUpdate(input)) {
      assertClaimEditable(before)
    }

    await this.validateUpdateReferences(input)

    const updated = await this.repo.update(id, input, auditContext.actorUserId, scope)

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

    // A completed (locked) claim is frozen for drastic actions; only the
    // unlock-key holder (admin, via emotive_claims.reopen) may delete it.
    assertCompletedActionAllowed(
      before,
      { reopenPermission: EMOTIVE_REOPEN_PERMISSION, permissions: actor.permissions },
      'Deleting a completed claim requires reopen permission',
    )

    await this.repo.softDelete(id, auditContext.actorUserId, scope)

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

    const restored = await this.repo.restore(id, auditContext.actorUserId, scope)

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

    const isReopen = assertOutcomeTransitionAllowed(before.outcome, input.outcome, {
      reopenPermission: EMOTIVE_REOPEN_PERMISSION,
      permissions: actor.permissions,
    })

    const updated = await this.repo.changeOutcome(id, input, auditContext.actorUserId, scope)

    await this.audit.log({
      entityType: 'emotive_claim',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: isReopen
        ? { before, after: updated, outcome: input.outcome, transition: 'reopen' }
        : { before, after: updated, outcome: input.outcome },
    })

    this.events.publishClaimUpdated(emotiveEventPayload(id), updated.customerId)

    return updated
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
