import { AuditAction, ResourceChangedKey } from '@mr/shared'

import { ConflictError, NotFoundError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { CustomersRepository } from './customers.repository.js'
import type {
  CustomerCreateInput,
  CustomerListItem,
  CustomerUpdateInput,
  CustomersListQuery,
  ReferenceListResponse,
} from './customers.validators.js'

export class CustomersService {
  constructor(
    private readonly repo: CustomersRepository,
    private readonly audit: AuditPort,
    private readonly eventBus: EventBus,
  ) {}

  async list(query: CustomersListQuery): Promise<ReferenceListResponse<CustomerListItem>> {
    return this.repo.list(query)
  }

  async create(input: CustomerCreateInput, actor: HttpActorContext): Promise<CustomerListItem> {
    const created = await this.repo.create(input)

    await this.audit.log({
      entityType: 'customer',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { after: created },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.Customers)

    return created
  }

  async update(
    id: string,
    input: CustomerUpdateInput,
    actor: HttpActorContext,
  ): Promise<CustomerListItem> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Customer', id)
    }

    const updated = await this.repo.update(id, input)

    await this.audit.log({
      entityType: 'customer',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before, after: updated },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.Customers)

    return updated
  }

  async hardDelete(id: string, actor: HttpActorContext): Promise<void> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Customer', id)
    }

    if (before.usageCount > 0) {
      throw new ConflictError(
        'Firma se koristi u reklamacijama ili je povezana sa korisnicima i ne može se obrisati.',
      )
    }

    await this.repo.hardDelete(id)

    await this.audit.log({
      entityType: 'customer',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.Customers)
  }
}
