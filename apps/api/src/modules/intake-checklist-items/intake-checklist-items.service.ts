import { AuditAction, ResourceChangedKey } from '@mr/shared'

import { NotFoundError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { IntakeChecklistItemsRepository } from './intake-checklist-items.repository.js'
import type {
  IntakeChecklistItemCreateInput,
  IntakeChecklistItemListItem,
  IntakeChecklistItemsListQuery,
  IntakeChecklistItemUpdateInput,
  ReferenceListResponse,
} from './intake-checklist-items.validators.js'

const ENTITY_TYPE = 'intake_checklist_item'

export class IntakeChecklistItemsService {
  constructor(
    private readonly repo: IntakeChecklistItemsRepository,
    private readonly audit: AuditPort,
    private readonly eventBus: EventBus,
  ) {}

  async list(
    query: IntakeChecklistItemsListQuery,
  ): Promise<ReferenceListResponse<IntakeChecklistItemListItem>> {
    return this.repo.list(query)
  }

  async create(
    input: IntakeChecklistItemCreateInput,
    actor: HttpActorContext,
  ): Promise<IntakeChecklistItemListItem> {
    const { item, revived } = await this.repo.create(input)

    await this.audit.log({
      entityType: ENTITY_TYPE,
      entityId: item.id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      // A revival lands on the row that already existed, so its old state belongs in the trail.
      changes: revived === null ? { after: item } : { before: revived, after: item },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.IntakeChecklistItems)

    return item
  }

  async update(
    id: string,
    input: IntakeChecklistItemUpdateInput,
    actor: HttpActorContext,
  ): Promise<IntakeChecklistItemListItem> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Intake checklist item', id)
    }

    const updated = await this.repo.update(id, input)

    await this.audit.log({
      entityType: ENTITY_TYPE,
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before, after: updated },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.IntakeChecklistItems)

    return updated
  }

  /**
   * Soft delete, and there is no usage guard on purpose: the code lives inside each order's
   * `checklist` jsonb, so "in use" would mean scanning every order — and blocking the removal would
   * leave the shop unable to retire an item it stopped checking. The row stays so nothing that
   * reads history hits a dangling code.
   */
  async softDelete(id: string, actor: HttpActorContext): Promise<void> {
    const before = await this.repo.findById(id)
    if (before === null) {
      throw new NotFoundError('Intake checklist item', id)
    }

    await this.repo.softDelete(id)

    await this.audit.log({
      entityType: ENTITY_TYPE,
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.IntakeChecklistItems)
  }
}
