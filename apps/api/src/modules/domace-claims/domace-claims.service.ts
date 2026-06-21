import {
  AuditAction,
  ClaimKind,
  type ClaimEventPayload,
  type DomaceClaimFaultInput,
} from '@mr/shared'

import {
  assertAcceptedClaimAmountEditable,
  assertClaimEditable,
  assertCompletedActionAllowed,
  assertOutcomeTransitionAllowed,
} from '../../core/claims/claim-lock.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { DomaceClaimsRepository } from './domace-claims.repository.js'
import type { DomaceClaimsActor, DomaceClaimsListScope } from './domace-claims.types.js'
import type {
  DomaceClaimAmountInput,
  DomaceClaimChangeOutcomeInput,
  DomaceClaimCreateInput,
  DomaceClaimDetail,
  DomaceClaimListQuery,
  DomaceClaimListResponse,
  DomaceClaimUpdateInput,
} from './domace-claims.validators.js'

function resolveListScope(actor: DomaceClaimsActor): DomaceClaimsListScope {
  if (actor.permissions.includes('domace_claims.view')) {
    return { type: 'all' }
  }

  if (actor.permissions.includes('domace_claims.view_own_customer')) {
    return { type: 'own_customer', userId: actor.id }
  }

  throw new ForbiddenError()
}

function domaceEventPayload(id: string): ClaimEventPayload {
  return { kind: ClaimKind.Domace, id }
}

const DOMACE_REOPEN_PERMISSION = 'domace_claims.reopen'

export class DomaceClaimsService {
  constructor(
    private readonly repo: DomaceClaimsRepository,
    private readonly audit: AuditPort,
    private readonly events: EventBus,
  ) {}

  async create(
    input: DomaceClaimCreateInput,
    actor: DomaceClaimsActor,
    auditContext: HttpActorContext,
  ): Promise<DomaceClaimDetail> {
    await this.validateCreateReferences(input)

    const created = await this.repo.create(input, auditContext.actorUserId)

    await this.audit.log({
      entityType: 'domace_claim',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { after: created },
    })

    this.events.publishClaimCreated(domaceEventPayload(created.id))

    return created
  }

  async list(
    query: DomaceClaimListQuery,
    actor: DomaceClaimsActor,
  ): Promise<DomaceClaimListResponse> {
    const scope = resolveListScope(actor)
    return this.repo.list(query, scope)
  }

  async findById(id: string, actor: DomaceClaimsActor): Promise<DomaceClaimDetail> {
    const scope = resolveListScope(actor)
    const claim = await this.repo.findById(id, scope)

    if (claim === null) {
      throw new NotFoundError('Domace claim', id)
    }

    return claim
  }

  async update(
    id: string,
    input: DomaceClaimUpdateInput,
    actor: DomaceClaimsActor,
    auditContext: HttpActorContext,
  ): Promise<DomaceClaimDetail> {
    const scope = resolveListScope(actor)
    const before = await this.repo.findById(id, scope)
    if (before === null) {
      throw new NotFoundError('Domace claim', id)
    }

    assertClaimEditable(before)

    await this.validateUpdateReferences(input)

    const updated = await this.repo.update(id, input, auditContext.actorUserId, scope)

    await this.audit.log({
      entityType: 'domace_claim',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { before, after: updated },
    })

    this.events.publishClaimUpdated(domaceEventPayload(id))

    return updated
  }

  async updateAmount(
    id: string,
    input: DomaceClaimAmountInput,
    actor: DomaceClaimsActor,
    auditContext: HttpActorContext,
  ): Promise<DomaceClaimDetail> {
    const scope = resolveListScope(actor)
    const before = await this.repo.findById(id, scope)
    if (before === null) {
      throw new NotFoundError('Domace claim', id)
    }

    assertAcceptedClaimAmountEditable(before)

    const updated = await this.repo.updateAmount(
      id,
      input.totalAmount,
      auditContext.actorUserId,
      scope,
    )

    await this.audit.log({
      entityType: 'domace_claim',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { before, after: updated, field: 'totalAmount' },
    })

    this.events.publishClaimUpdated(domaceEventPayload(id))

    return updated
  }

  async softDelete(
    id: string,
    actor: DomaceClaimsActor,
    auditContext: HttpActorContext,
  ): Promise<void> {
    const scope = resolveListScope(actor)
    const before = await this.repo.findById(id, scope)
    if (before === null) {
      throw new NotFoundError('Domace claim', id)
    }

    // A completed (locked) claim is frozen for drastic actions; only the
    // unlock-key holder (admin, via domace_claims.reopen) may delete it.
    assertCompletedActionAllowed(
      before,
      { reopenPermission: DOMACE_REOPEN_PERMISSION, permissions: actor.permissions },
      'Deleting a completed claim requires reopen permission',
    )

    await this.repo.softDelete(id, auditContext.actorUserId, scope)

    await this.audit.log({
      entityType: 'domace_claim',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { before },
    })

    this.events.publishClaimDeleted(domaceEventPayload(id))
  }

  async changeOutcome(
    id: string,
    input: DomaceClaimChangeOutcomeInput,
    actor: DomaceClaimsActor,
    auditContext: HttpActorContext,
  ): Promise<DomaceClaimDetail> {
    const scope = resolveListScope(actor)
    const before = await this.repo.findById(id, scope)
    if (before === null) {
      throw new NotFoundError('Domace claim', id)
    }

    const isReopen = assertOutcomeTransitionAllowed(before.outcome, input.outcome, {
      reopenPermission: DOMACE_REOPEN_PERMISSION,
      permissions: actor.permissions,
    })

    const updated = await this.repo.changeOutcome(id, input, auditContext.actorUserId, scope)

    await this.audit.log({
      entityType: 'domace_claim',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: isReopen
        ? { before, after: updated, outcome: input.outcome, transition: 'reopen' }
        : { before, after: updated, outcome: input.outcome },
    })

    this.events.publishClaimUpdated(domaceEventPayload(id))

    return updated
  }

  private async validateCreateReferences(input: DomaceClaimCreateInput): Promise<void> {
    const [engineTypeActive, employeeActive] = await Promise.all([
      input.engineTypeId !== undefined
        ? this.repo.isEngineTypeActive(input.engineTypeId)
        : Promise.resolve(true),
      input.employeeId !== undefined
        ? this.repo.isEmployeeActive(input.employeeId)
        : Promise.resolve(true),
    ])

    if (!engineTypeActive) {
      throw new ValidationError('Invalid or inactive engine type')
    }
    if (!employeeActive) {
      throw new ValidationError('Invalid or inactive employee')
    }

    await this.validateFaults(input.faults)
  }

  private async validateUpdateReferences(input: DomaceClaimUpdateInput): Promise<void> {
    type ReferenceCheck = { active: Promise<boolean>; message: string }
    const checks: ReferenceCheck[] = []

    if (input.engineTypeId !== undefined && input.engineTypeId !== null) {
      checks.push({
        active: this.repo.isEngineTypeActive(input.engineTypeId),
        message: 'Invalid or inactive engine type',
      })
    }
    if (input.employeeId !== undefined && input.employeeId !== null) {
      checks.push({
        active: this.repo.isEmployeeActive(input.employeeId),
        message: 'Invalid or inactive employee',
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
  }

  private async validateFaults(faults: readonly DomaceClaimFaultInput[]): Promise<void> {
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
