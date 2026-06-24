import { AuditAction } from '@mr/shared'

import { NotFoundError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
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

    return updated
  }

  async softDelete(id: string, actor: HttpActorContext): Promise<EngineManufacturerListItem> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Engine manufacturer', id)
    }

    const deleted = await this.repo.softDelete(id)

    await this.audit.log({
      entityType: 'engine_manufacturer',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before, after: deleted },
    })

    return deleted
  }
}
