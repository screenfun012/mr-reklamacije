import { AuditAction, ResourceChangedKey } from '@mr/shared'

import { ConflictError, NotFoundError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { EmployeesRepository } from './employees.repository.js'
import type {
  EmployeeCreateInput,
  EmployeeListItem,
  EmployeesListQuery,
  EmployeeUpdateInput,
  ReferenceListResponse,
} from './employees.validators.js'

export class EmployeesService {
  constructor(
    private readonly repo: EmployeesRepository,
    private readonly audit: AuditPort,
    private readonly eventBus: EventBus,
  ) {}

  async list(query: EmployeesListQuery): Promise<ReferenceListResponse<EmployeeListItem>> {
    return this.repo.list(query)
  }

  async create(input: EmployeeCreateInput, actor: HttpActorContext): Promise<EmployeeListItem> {
    const created = await this.repo.create(input)

    await this.audit.log({
      entityType: 'employee',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { after: created },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.Employees)

    return created
  }

  async update(
    id: string,
    input: EmployeeUpdateInput,
    actor: HttpActorContext,
  ): Promise<EmployeeListItem> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Employee', id)
    }

    const updated = await this.repo.update(id, input)

    await this.audit.log({
      entityType: 'employee',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before, after: updated },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.Employees)

    return updated
  }

  async hardDelete(id: string, actor: HttpActorContext): Promise<void> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Employee', id)
    }

    if (before.usageCount > 0) {
      throw new ConflictError(
        'Radnik se koristi u reklamacijama i ne može se obrisati. Deaktivirajte ga umesto brisanja.',
      )
    }

    await this.repo.hardDelete(id)

    await this.audit.log({
      entityType: 'employee',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.Employees)
  }
}
