import {
  AuditAction,
  ClaimKind,
  type ClaimEventPayload,
  type EmotiveClaimFaultInput,
} from '@mr/shared'

import type { HttpActorContext } from '../../core/http/actor-context.js'
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
      input.customerId ?? (await this.repo.getSourceDefaultCustomerId(input.sourceId))

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

    this.events.publishClaimCreated(emotiveEventPayload(created.id))

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

    this.events.publishClaimUpdated(emotiveEventPayload(id))

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

    this.events.publishClaimDeleted(emotiveEventPayload(id))
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

    const updated = await this.repo.changeOutcome(id, input, auditContext.actorUserId, scope)

    await this.audit.log({
      entityType: 'emotive_claim',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { before, after: updated, outcome: input.outcome },
    })

    this.events.publishClaimUpdated(emotiveEventPayload(id))

    return updated
  }

  private async validateCreateReferences(input: EmotiveClaimCreateInput): Promise<void> {
    if (!(await this.repo.isEngineTypeActive(input.engineTypeId))) {
      throw new ValidationError('Invalid or inactive engine type')
    }
    if (!(await this.repo.isEmployeeActive(input.employeeId))) {
      throw new ValidationError('Invalid or inactive employee')
    }
    if (!(await this.repo.isClaimSourceActive(input.sourceId))) {
      throw new ValidationError('Invalid or inactive claim source')
    }

    if (input.customerId !== undefined && !(await this.repo.isCustomerActive(input.customerId))) {
      throw new ValidationError('Invalid or inactive customer')
    }

    await this.validateFaults(input.faults)
  }

  private async validateUpdateReferences(input: EmotiveClaimUpdateInput): Promise<void> {
    if (
      input.engineTypeId !== undefined &&
      !(await this.repo.isEngineTypeActive(input.engineTypeId))
    ) {
      throw new ValidationError('Invalid or inactive engine type')
    }
    if (input.employeeId !== undefined && !(await this.repo.isEmployeeActive(input.employeeId))) {
      throw new ValidationError('Invalid or inactive employee')
    }
    if (input.sourceId !== undefined && !(await this.repo.isClaimSourceActive(input.sourceId))) {
      throw new ValidationError('Invalid or inactive claim source')
    }
    if (
      input.customerId !== undefined &&
      input.customerId !== null &&
      !(await this.repo.isCustomerActive(input.customerId))
    ) {
      throw new ValidationError('Invalid or inactive customer')
    }
    if (input.faults !== undefined) {
      await this.validateFaults(input.faults)
    }
  }

  private async validateFaults(faults: readonly EmotiveClaimFaultInput[]): Promise<void> {
    for (const fault of faults) {
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
    }
  }
}
