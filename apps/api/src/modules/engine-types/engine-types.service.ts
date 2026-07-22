import { AuditAction, NotificationCatalog, ResourceChangedKey } from '@mr/shared'

import { ConflictError, NotFoundError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { NotificationsPort } from '../../core/ports/notifications-port.js'
import type { EngineTypesRepository } from './engine-types.repository.js'
import type {
  EngineTypeCreateInput,
  EngineTypeListItem,
  EngineTypeUpdateInput,
  EngineTypesListQuery,
  ReferenceListResponse,
} from './engine-types.validators.js'

export type CreateEngineTypeActorContext = HttpActorContext

export class EngineTypesService {
  constructor(
    private readonly repo: EngineTypesRepository,
    private readonly audit: AuditPort,
    private readonly eventBus: EventBus,
    private readonly notifications: NotificationsPort,
  ) {}

  async list(query: EngineTypesListQuery): Promise<ReferenceListResponse<EngineTypeListItem>> {
    return this.repo.list(query)
  }

  async create(input: EngineTypeCreateInput, actor: HttpActorContext): Promise<EngineTypeListItem> {
    const created = await this.repo.create(input)

    await this.audit.log({
      entityType: 'engine_type',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { after: created },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.EngineTypes)

    // Create only: a new catalog entry unblocks claim entry, an edit/delete does not.
    await this.notifications.notifyCatalogAdded(
      actor.actorUserId,
      NotificationCatalog.EngineTypes,
      created.id,
      created.code,
    )

    return created
  }

  async update(
    id: string,
    input: EngineTypeUpdateInput,
    actor: HttpActorContext,
  ): Promise<EngineTypeListItem> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Engine type', id)
    }

    const updated = await this.repo.update(id, input)

    await this.audit.log({
      entityType: 'engine_type',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before, after: updated },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.EngineTypes)

    return updated
  }

  async hardDelete(id: string, actor: HttpActorContext): Promise<void> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Engine type', id)
    }

    if (before.usageCount > 0) {
      throw new ConflictError('Tip motora se koristi u reklamacijama i ne može se obrisati.')
    }

    await this.repo.hardDelete(id)

    await this.audit.log({
      entityType: 'engine_type',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.EngineTypes)
  }
}
