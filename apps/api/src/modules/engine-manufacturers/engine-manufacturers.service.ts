import { AuditAction, NotificationCatalog, ResourceChangedKey } from '@mr/shared'

import { ConflictError, NotFoundError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { NotificationsPort } from '../../core/ports/notifications-port.js'
import type { EngineManufacturersRepository } from './engine-manufacturers.repository.js'
import type {
  EngineManufacturerCreateInput,
  EngineManufacturerListItem,
  EngineManufacturerUpdateInput,
  ReferenceListQuery,
  ReferenceListResponse,
} from './engine-manufacturers.validators.js'

export class EngineManufacturersService {
  constructor(
    private readonly repo: EngineManufacturersRepository,
    private readonly audit: AuditPort,
    private readonly eventBus: EventBus,
    private readonly notifications: NotificationsPort,
  ) {}

  async list(
    query: ReferenceListQuery,
  ): Promise<ReferenceListResponse<EngineManufacturerListItem>> {
    return this.repo.list(query)
  }

  async create(
    input: EngineManufacturerCreateInput,
    actor: HttpActorContext,
  ): Promise<EngineManufacturerListItem> {
    const created = await this.repo.create(input)

    await this.audit.log({
      entityType: 'engine_manufacturer',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { after: created },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.EngineManufacturers)

    // Create only: a new catalog entry unblocks claim entry, an edit/delete does not.
    await this.notifications.notifyCatalogAdded(
      actor.actorUserId,
      NotificationCatalog.EngineManufacturers,
      created.id,
      created.name,
    )

    return created
  }

  async update(
    id: string,
    input: EngineManufacturerUpdateInput,
    actor: HttpActorContext,
  ): Promise<EngineManufacturerListItem> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Engine manufacturer', id)
    }

    const updated = await this.repo.update(id, input)

    await this.audit.log({
      entityType: 'engine_manufacturer',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before, after: updated },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.EngineManufacturers)

    return updated
  }

  async hardDelete(id: string, actor: HttpActorContext): Promise<void> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Engine manufacturer', id)
    }

    if (before.usageCount > 0) {
      throw new ConflictError('Proizvođač motora se koristi u reklamacijama i ne može se obrisati.')
    }

    await this.repo.hardDelete(id)

    await this.audit.log({
      entityType: 'engine_manufacturer',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.EngineManufacturers)
  }
}
