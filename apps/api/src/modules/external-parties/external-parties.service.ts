import { AuditAction, ResourceChangedKey } from '@mr/shared'

import { ConflictError, NotFoundError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { ExternalPartiesRepository } from './external-parties.repository.js'
import type {
  ExternalPartyCreateInput,
  ExternalPartyListItem,
  ExternalPartyUpdateInput,
  ReferenceListQuery,
  ReferenceListResponse,
} from './external-parties.validators.js'

export type CreateExternalPartyActorContext = HttpActorContext

export class ExternalPartiesService {
  constructor(
    private readonly repo: ExternalPartiesRepository,
    private readonly audit: AuditPort,
    private readonly eventBus: EventBus,
  ) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<ExternalPartyListItem>> {
    return this.repo.list(query)
  }

  async create(
    input: ExternalPartyCreateInput,
    actor: HttpActorContext,
  ): Promise<ExternalPartyListItem> {
    const created = await this.repo.create(input)

    await this.audit.log({
      entityType: 'external_party',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { after: created },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.ExternalParties)

    return created
  }

  async update(
    id: string,
    input: ExternalPartyUpdateInput,
    actor: HttpActorContext,
  ): Promise<ExternalPartyListItem> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('External party', id)
    }

    const updated = await this.repo.update(id, input)

    await this.audit.log({
      entityType: 'external_party',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before, after: updated },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.ExternalParties)

    return updated
  }

  async hardDelete(id: string, actor: HttpActorContext): Promise<void> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('External party', id)
    }

    if (before.usageCount > 0) {
      throw new ConflictError('Eksterni izvođač se koristi u reklamacijama i ne može se obrisati.')
    }

    await this.repo.hardDelete(id)

    await this.audit.log({
      entityType: 'external_party',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.ExternalParties)
  }
}
