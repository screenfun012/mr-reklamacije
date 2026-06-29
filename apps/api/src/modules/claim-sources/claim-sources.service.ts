import { AuditAction, ResourceChangedKey } from '@mr/shared'

import { ConflictError, NotFoundError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { ClaimSourcesRepository } from './claim-sources.repository.js'
import type {
  ClaimSourceCreateInput,
  ClaimSourceListItem,
  ClaimSourceUpdateInput,
  ReferenceListQuery,
  ReferenceListResponse,
} from './claim-sources.validators.js'

export class ClaimSourcesService {
  constructor(
    private readonly repo: ClaimSourcesRepository,
    private readonly audit: AuditPort,
    private readonly eventBus: EventBus,
  ) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<ClaimSourceListItem>> {
    return this.repo.list(query)
  }

  async create(
    input: ClaimSourceCreateInput,
    actor: HttpActorContext,
  ): Promise<ClaimSourceListItem> {
    const created = await this.repo.create(input)

    await this.audit.log({
      entityType: 'claim_source',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { after: created },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.ClaimSources)

    return created
  }

  async update(
    id: string,
    input: ClaimSourceUpdateInput,
    actor: HttpActorContext,
  ): Promise<ClaimSourceListItem> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Claim source', id)
    }

    const updated = await this.repo.update(id, input)

    await this.audit.log({
      entityType: 'claim_source',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before, after: updated },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.ClaimSources)

    return updated
  }

  async hardDelete(id: string, actor: HttpActorContext): Promise<void> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Claim source', id)
    }

    if (before.usageCount > 0) {
      throw new ConflictError('Izvor reklamacije se koristi u reklamacijama i ne može se obrisati.')
    }

    await this.repo.hardDelete(id)

    await this.audit.log({
      entityType: 'claim_source',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.ClaimSources)
  }
}
