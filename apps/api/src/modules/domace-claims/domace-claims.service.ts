import {
  AuditAction,
  ClaimKind,
  type ClaimEventPayload,
  type DomaceClaimFaultInput,
} from '@mr/shared'

import { assertAcceptedClaimAmountEditable } from '../../core/claims/claim-lock.js'
import { validateEngineTypeManufacturerPair } from '../../core/claims/validate-engine-type-manufacturer-pair.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type {
  ClaimNotificationContext,
  NotificationsPort,
} from '../../core/ports/notifications-port.js'
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

function notificationContext(claim: DomaceClaimDetail): ClaimNotificationContext {
  return {
    kind: ClaimKind.Domace,
    id: claim.id,
    mrNumber: claim.mrNumber,
    customerName: claim.customerName,
    employeeId: claim.employeeId,
    outcome: claim.outcome,
  }
}

export class DomaceClaimsService {
  constructor(
    private readonly repo: DomaceClaimsRepository,
    private readonly audit: AuditPort,
    private readonly events: EventBus,
    private readonly notifications: NotificationsPort,
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

    await this.notifications.notifyClaimCreated(
      auditContext.actorUserId,
      notificationContext(created),
    )

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

    await this.validateUpdateReferences(input)

    const updated = await this.repo.update(id, input, auditContext.actorUserId, before, scope)

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

    // Only a NEW assignee is news; re-saving the same technician is not.
    if (updated.employeeId !== null && updated.employeeId !== before.employeeId) {
      await this.notifications.notifyClaimAssigned(
        auditContext.actorUserId,
        notificationContext(updated),
      )
    }

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

    await this.repo.softDelete(id, auditContext.actorUserId, before)

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

  async restore(
    id: string,
    actor: DomaceClaimsActor,
    auditContext: HttpActorContext,
  ): Promise<DomaceClaimDetail> {
    if (!actor.permissions.includes('domace_claims.restore')) {
      throw new ForbiddenError()
    }

    const scope = resolveListScope(actor)
    const before = await this.repo.findDeletedById(id, scope)
    if (before === null) {
      throw new NotFoundError('Domace claim', id)
    }

    const restored = await this.repo.restore(id, auditContext.actorUserId, before, scope)

    await this.audit.log({
      entityType: 'domace_claim',
      entityId: id,
      action: AuditAction.Restore,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { before, after: restored },
    })

    this.events.publishClaimUpdated(domaceEventPayload(id))

    return restored
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

    const updated = await this.repo.changeOutcome(
      id,
      input,
      auditContext.actorUserId,
      before,
      scope,
    )

    await this.audit.log({
      entityType: 'domace_claim',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { before, after: updated, outcome: input.outcome },
    })

    this.events.publishClaimUpdated(domaceEventPayload(id))

    await this.notifications.notifyOutcomeChanged(
      auditContext.actorUserId,
      notificationContext(updated),
    )

    return updated
  }

  private async validateCreateReferences(input: DomaceClaimCreateInput): Promise<void> {
    const [engineTypeActive, manufacturerActive, employeeActive] = await Promise.all([
      input.engineTypeId !== undefined
        ? this.repo.isEngineTypeActive(input.engineTypeId)
        : Promise.resolve(true),
      input.manufacturerId !== undefined
        ? this.repo.isManufacturerActive(input.manufacturerId)
        : Promise.resolve(true),
      input.employeeId !== undefined
        ? this.repo.isEmployeeActive(input.employeeId)
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

  private async validateUpdateReferences(input: DomaceClaimUpdateInput): Promise<void> {
    type ReferenceCheck = { active: Promise<boolean>; message: string }
    const checks: ReferenceCheck[] = []

    if (input.engineTypeId !== undefined && input.engineTypeId !== null) {
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
