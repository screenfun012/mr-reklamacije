import { AuditAction, ResourceChangedKey } from '@mr/shared'

import { ConflictError, NotFoundError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { ClaimCategoryFieldsRepository } from './claim-category-fields.repository.js'
import type {
  ClaimCategoryFieldCreateInput,
  ClaimCategoryFieldListItem,
  ClaimCategoryFieldUpdateInput,
  ClaimCategoryFieldsListQuery,
  ReferenceListResponse,
} from './claim-category-fields.validators.js'

export class ClaimCategoryFieldsService {
  constructor(
    private readonly repo: ClaimCategoryFieldsRepository,
    private readonly audit: AuditPort,
    private readonly eventBus: EventBus,
  ) {}

  async list(
    query: ClaimCategoryFieldsListQuery,
  ): Promise<ReferenceListResponse<ClaimCategoryFieldListItem>> {
    return this.repo.list(query)
  }

  async create(
    input: ClaimCategoryFieldCreateInput,
    actor: HttpActorContext,
  ): Promise<ClaimCategoryFieldListItem> {
    const created = await this.repo.create(input)

    await this.audit.log({
      entityType: 'claim_category_field',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { after: created },
    })

    // One signal for the whole category family — fields, options and the counts all hang off it.
    this.eventBus.publishResourceChanged(ResourceChangedKey.ClaimCategories)

    return created
  }

  async update(
    id: string,
    input: ClaimCategoryFieldUpdateInput,
    actor: HttpActorContext,
  ): Promise<ClaimCategoryFieldListItem> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Claim category field', id)
    }

    const updated = await this.repo.update(id, input)

    await this.audit.log({
      entityType: 'claim_category_field',
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
      throw new NotFoundError('Claim category field', id)
    }

    // A field whose answers are on claims cannot be deleted — the answers would lose their
    // question. Switching it off is what the office wants here, and that keeps the values.
    if (before.usageCount > 0) {
      throw new ConflictError('Polje se koristi na reklamacijama i ne može se obrisati.')
    }

    // Same shape one level down: the options hold the field by a RESTRICT key.
    const optionCount = await this.repo.countOptions(id)
    if (optionCount > 0) {
      throw new ConflictError(
        'Polje ima svoje opcije i ne može se obrisati. Prvo obriši opcije tog polja.',
      )
    }

    await this.repo.hardDelete(id)

    await this.audit.log({
      entityType: 'claim_category_field',
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
