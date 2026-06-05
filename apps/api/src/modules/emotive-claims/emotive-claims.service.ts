import {
  AuditAction,
  ClaimKind,
  type ClaimEventPayload,
  type EmotiveClaimFaultInput,
  type Permission,
} from '@mr/shared'

import { ForbiddenError, NotFoundError } from '../../core/errors/domain-errors.js'
import type { AuditService } from '../audit/audit.service.js'
import type { EventBus } from '../events/event-bus.js'
import type { EmotiveClaimsRepository } from './emotive-claims.repository.js'
import type {
  EmotiveClaimsActor,
  EmotiveClaimsAuditContext,
  EmotiveClaimsListScope,
} from './emotive-claims.types.js'
import type {
  EmotiveClaimChangeOutcomeInput,
  EmotiveClaimCreateInput,
  EmotiveClaimDetail,
  EmotiveClaimListQuery,
  EmotiveClaimListResponse,
  EmotiveClaimUpdateInput,
} from './emotive-claims.validators.js'

function assertPermission(actor: EmotiveClaimsActor, permission: Permission): void {
  if (!actor.permissions.includes(permission)) {
    throw new ForbiddenError()
  }
}

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
    private readonly audit: AuditService,
    private readonly events: EventBus,
  ) {}

  async create(
    input: EmotiveClaimCreateInput,
    actor: EmotiveClaimsActor,
    auditContext: EmotiveClaimsAuditContext,
  ): Promise<EmotiveClaimDetail> {
    assertPermission(actor, 'emotive_claims.create')

    await this.validateCreateReferences(input)

    const customerId =
      input.customerId ??
      (await this.repo.getSourceDefaultCustomerId(input.sourceId))

    const created = await this.repo.create(input, auditContext.actorUserId, customerId)

    await this.audit.log({
      entityType: 'emotive_claim',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp ?? null,
      actorUserAgent: auditContext.actorUserAgent ?? null,
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
    auditContext: EmotiveClaimsAuditContext,
  ): Promise<EmotiveClaimDetail> {
    assertPermission(actor, 'emotive_claims.update')

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
      actorIp: auditContext.actorIp ?? null,
      actorUserAgent: auditContext.actorUserAgent ?? null,
      changes: { before, after: updated },
    })

    this.events.publishClaimUpdated(emotiveEventPayload(id))

    return updated
  }

  async softDelete(
    id: string,
    actor: EmotiveClaimsActor,
    auditContext: EmotiveClaimsAuditContext,
  ): Promise<void> {
    assertPermission(actor, 'emotive_claims.delete')

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
      actorIp: auditContext.actorIp ?? null,
      actorUserAgent: auditContext.actorUserAgent ?? null,
      changes: { before },
    })

    this.events.publishClaimDeleted(emotiveEventPayload(id))
  }

  async changeOutcome(
    id: string,
    input: EmotiveClaimChangeOutcomeInput,
    actor: EmotiveClaimsActor,
    auditContext: EmotiveClaimsAuditContext,
  ): Promise<EmotiveClaimDetail> {
    assertPermission(actor, 'emotive_claims.change_outcome')

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
      actorIp: auditContext.actorIp ?? null,
      actorUserAgent: auditContext.actorUserAgent ?? null,
      changes: { before, after: updated, outcome: input.outcome },
    })

    this.events.publishClaimUpdated(emotiveEventPayload(id))

    return updated
  }

  private async validateCreateReferences(input: EmotiveClaimCreateInput): Promise<void> {
    await this.repo.assertActiveEngineType(input.engineTypeId)
    await this.repo.assertActiveEmployee(input.employeeId)
    await this.repo.assertActiveClaimSource(input.sourceId)

    if (input.customerId !== undefined) {
      await this.repo.assertActiveCustomer(input.customerId)
    }

    await this.validateFaults(input.faults)
  }

  private async validateUpdateReferences(input: EmotiveClaimUpdateInput): Promise<void> {
    if (input.engineTypeId !== undefined) {
      await this.repo.assertActiveEngineType(input.engineTypeId)
    }
    if (input.employeeId !== undefined) {
      await this.repo.assertActiveEmployee(input.employeeId)
    }
    if (input.sourceId !== undefined) {
      await this.repo.assertActiveClaimSource(input.sourceId)
    }
    if (input.customerId !== undefined && input.customerId !== null) {
      await this.repo.assertActiveCustomer(input.customerId)
    }
    if (input.faults !== undefined) {
      await this.validateFaults(input.faults)
    }
  }

  private async validateFaults(faults: readonly EmotiveClaimFaultInput[]): Promise<void> {
    for (const fault of faults) {
      switch (fault.faultType) {
        case 'employee':
          await this.repo.assertActiveEmployee(fault.employeeId)
          break
        case 'department':
          await this.repo.assertActiveDepartment(fault.departmentId)
          break
        case 'external':
          await this.repo.assertActiveExternalParty(fault.externalPartyId)
          break
      }
    }
  }
}
