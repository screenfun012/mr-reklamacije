import { AuditAction, ResourceChangedKey } from '@mr/shared'

import { ConflictError, NotFoundError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { DepartmentsRepository } from './departments.repository.js'
import type {
  DepartmentCreateInput,
  DepartmentListItem,
  DepartmentUpdateInput,
  ReferenceListQuery,
  ReferenceListResponse,
} from './departments.validators.js'

export class DepartmentsService {
  constructor(
    private readonly repo: DepartmentsRepository,
    private readonly audit: AuditPort,
    private readonly eventBus: EventBus,
  ) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<DepartmentListItem>> {
    return this.repo.list(query)
  }

  async create(input: DepartmentCreateInput, actor: HttpActorContext): Promise<DepartmentListItem> {
    const created = await this.repo.create(input)

    await this.audit.log({
      entityType: 'department',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { after: created },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.Departments)

    return created
  }

  async update(
    id: string,
    input: DepartmentUpdateInput,
    actor: HttpActorContext,
  ): Promise<DepartmentListItem> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Department', id)
    }

    const updated = await this.repo.update(id, input)

    await this.audit.log({
      entityType: 'department',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before, after: updated },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.Departments)

    return updated
  }

  async hardDelete(id: string, actor: HttpActorContext): Promise<void> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Department', id)
    }

    if (before.usageCount > 0) {
      throw new ConflictError(
        'Odeljenje se koristi u reklamacijama ili je vezano za radnike i ne može se obrisati.',
      )
    }

    await this.repo.hardDelete(id)

    await this.audit.log({
      entityType: 'department',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.Departments)
  }
}
