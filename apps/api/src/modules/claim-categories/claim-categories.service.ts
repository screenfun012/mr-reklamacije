import { AuditAction, ResourceChangedKey } from '@mr/shared'

import { ConflictError, NotFoundError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { ClaimCategoriesRepository } from './claim-categories.repository.js'
import type {
  ClaimCategoryCreateInput,
  ClaimCategoryListItem,
  ClaimCategoryUpdateInput,
  ReferenceListQuery,
  ReferenceListResponse,
} from './claim-categories.validators.js'

export class ClaimCategoriesService {
  constructor(
    private readonly repo: ClaimCategoriesRepository,
    private readonly audit: AuditPort,
    private readonly eventBus: EventBus,
  ) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<ClaimCategoryListItem>> {
    return this.repo.list(query)
  }

  async create(
    input: ClaimCategoryCreateInput,
    actor: HttpActorContext,
  ): Promise<ClaimCategoryListItem> {
    const created = await this.repo.create(input)

    await this.audit.log({
      entityType: 'claim_category',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { after: created },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.ClaimCategories)

    return created
  }

  async update(
    id: string,
    input: ClaimCategoryUpdateInput,
    actor: HttpActorContext,
  ): Promise<ClaimCategoryListItem> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Claim category', id)
    }

    const updated = await this.repo.update(id, input)

    await this.audit.log({
      entityType: 'claim_category',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before, after: updated },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.ClaimCategories)

    return updated
  }

  async hardDelete(id: string, actor: HttpActorContext): Promise<void> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Claim category', id)
    }

    if (before.usageCount > 0) {
      throw new ConflictError('Kategorija se koristi u reklamacijama i ne može se obrisati.')
    }

    // Its fields hold it by a RESTRICT key, so without this Postgres refuses the DELETE and the
    // office sees a 500. Since migration 0048 every category ships with fields, so this is the
    // ordinary case, not the exotic one — and deleting them along with it is not ours to decide.
    const fieldCount = await this.repo.countFields(id)
    if (fieldCount > 0) {
      throw new ConflictError(
        'Kategorija ima svoja polja i ne može se obrisati. Prvo obriši polja te kategorije.',
      )
    }

    await this.repo.hardDelete(id)

    await this.audit.log({
      entityType: 'claim_category',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.ClaimCategories)
  }
}
