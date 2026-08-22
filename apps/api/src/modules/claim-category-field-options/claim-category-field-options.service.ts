import { AuditAction, ResourceChangedKey } from '@mr/shared'

import { ConflictError, NotFoundError, ValidationError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { ClaimCategoryFieldOptionsRepository } from './claim-category-field-options.repository.js'
import type {
  ClaimCategoryFieldOptionCreateInput,
  ClaimCategoryFieldOptionListItem,
  ClaimCategoryFieldOptionUpdateInput,
  ClaimCategoryFieldOptionsListQuery,
  ReferenceListResponse,
} from './claim-category-field-options.validators.js'

const INVALID_PARENT_MESSAGE =
  'Invalid parent option: it must be an option of another field of the same category'

export class ClaimCategoryFieldOptionsService {
  constructor(
    private readonly repo: ClaimCategoryFieldOptionsRepository,
    private readonly audit: AuditPort,
    private readonly eventBus: EventBus,
  ) {}

  async list(
    query: ClaimCategoryFieldOptionsListQuery,
  ): Promise<ReferenceListResponse<ClaimCategoryFieldOptionListItem>> {
    return this.repo.list(query)
  }

  /**
   * A parent has to be an option of ANOTHER field of the SAME category — a field cannot depend on
   * itself, and an answer in one kind of work can never gate an answer in another. The rule needs
   * a subquery, so it lives here and not in a CHECK constraint.
   */
  private async assertParentOption(parentOptionId: string, fieldId: string): Promise<void> {
    const parent = await this.repo.findById(parentOptionId)
    if (parent === null || parent.fieldId === fieldId) {
      throw new ValidationError(INVALID_PARENT_MESSAGE)
    }

    const categoryId = await this.repo.findFieldCategoryId(fieldId)
    const parentCategoryId = await this.repo.findFieldCategoryId(parent.fieldId)
    if (categoryId === null || parentCategoryId !== categoryId) {
      throw new ValidationError(INVALID_PARENT_MESSAGE)
    }
  }

  async create(
    input: ClaimCategoryFieldOptionCreateInput,
    actor: HttpActorContext,
  ): Promise<ClaimCategoryFieldOptionListItem> {
    if (input.parentOptionId !== undefined) {
      await this.assertParentOption(input.parentOptionId, input.fieldId)
    }

    const created = await this.repo.create(input)

    await this.audit.log({
      entityType: 'claim_category_field_option',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { after: created },
    })

    // One signal for the whole category family (see the fields service).
    this.eventBus.publishResourceChanged(ResourceChangedKey.ClaimCategories)

    return created
  }

  async update(
    id: string,
    input: ClaimCategoryFieldOptionUpdateInput,
    actor: HttpActorContext,
  ): Promise<ClaimCategoryFieldOptionListItem> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Claim category field option', id)
    }

    if (input.parentOptionId !== undefined && input.parentOptionId !== null) {
      await this.assertParentOption(input.parentOptionId, before.fieldId)
    }

    const updated = await this.repo.update(id, input)

    await this.audit.log({
      entityType: 'claim_category_field_option',
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
      throw new NotFoundError('Claim category field option', id)
    }

    // An answer already given on a claim cannot be deleted from under it. Switching the option
    // off stops it being offered while every claim that carries it keeps reading correctly.
    if (before.usageCount > 0) {
      throw new ConflictError('Opcija se koristi na reklamacijama i ne može se obrisati.')
    }

    // Same shape one level down again: dependent options hold this one by a RESTRICT key, and
    // without this the database refuses and the office reads a 500 instead of a sentence.
    const childCount = await this.repo.countChildren(id)
    if (childCount > 0) {
      throw new ConflictError(
        'Opcija ima zavisne opcije i ne može se obrisati. Prvo obriši opcije koje zavise od nje.',
      )
    }

    await this.repo.hardDelete(id)

    await this.audit.log({
      entityType: 'claim_category_field_option',
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
