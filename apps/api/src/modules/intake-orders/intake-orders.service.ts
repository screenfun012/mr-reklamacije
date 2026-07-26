import { AuditAction, ResourceChangedKey, intakeOrderStatusValues } from '@mr/shared'

import type { HttpActorContext } from '../../core/http/actor-context.js'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/errors/domain-errors.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import {
  normalizeOrderNumberKey,
  normalizePlateKey,
  type IntakeOrdersRepository,
} from './intake-orders.repository.js'
import type { IntakeOrdersActor, IntakeOrdersListScope } from './intake-orders.types.js'
import { IntakeNumberCheckStatus } from './intake-orders.validators.js'
import type {
  IntakeNumberCheckResponse,
  IntakeOrderChangeStatusInput,
  IntakeOrderCreateInput,
  IntakeOrderDetail,
  IntakeOrderListQuery,
  IntakeOrderListResponse,
  IntakeOrderSignInput,
  IntakeOrderSummary,
  IntakeOrderUpdateInput,
  IntakePlateLookupResponse,
} from './intake-orders.validators.js'

/**
 * The one-way ladder a serviser walks. The office corrects mis-taps through
 * `change-status` instead, which can set any value.
 */
const STATUS_ORDER = intakeOrderStatusValues

/**
 * What may still be edited freely once the customer has signed. Services and materials are
 * the shop's own running record and change all the time.
 *
 * Everything else is on the paper the customer holds. The intake CONDITION (checklist, fuel,
 * damages) may be corrected by the office, which stamps the order as amended and marks the
 * printed document. Any other field is refused outright: the drawn UI never offers it, and
 * allowing it would let the paper and the record diverge with nothing saying so.
 */
const FREE_AFTER_SIGNING = ['services', 'materials'] as const

/** The intake condition — correcting it after signing requires `intake_orders.amend`. */
const CONDITION_FIELDS = ['checklist', 'fuelLevel', 'damages', 'equipmentNote'] as const

function resolveScope(actor: IntakeOrdersActor): IntakeOrdersListScope {
  if (actor.permissions.includes('intake_orders.view')) {
    return { type: 'all' }
  }

  if (actor.permissions.includes('intake_orders.view_own')) {
    return { type: 'own', userId: actor.id }
  }

  throw new ForbiddenError()
}

function nextStatus(current: string): string {
  const index = STATUS_ORDER.indexOf(current as (typeof STATUS_ORDER)[number])
  const next = STATUS_ORDER[index + 1]
  if (next === undefined) {
    throw new ConflictError('Intake order is already at the final status')
  }
  return next
}

export class IntakeOrdersService {
  constructor(
    private readonly repo: IntakeOrdersRepository,
    private readonly audit: AuditPort,
    private readonly events: EventBus,
  ) {}

  private signalChanged(): void {
    this.events.publishResourceChanged(ResourceChangedKey.IntakeOrders)
  }

  /**
   * Loads an order the actor is allowed to touch. A row outside the actor's scope answers
   * 404, never 403 — a serviser must not be able to learn that a colleague's order exists
   * (house rule; this is the class of bug that leaked once already).
   */
  private async loadVisible(id: string, actor: IntakeOrdersActor): Promise<IntakeOrderDetail> {
    const scope = resolveScope(actor)
    const order = await this.repo.findById(id)

    if (order === null) {
      throw new NotFoundError('Intake order', id)
    }

    if (scope.type === 'own' && order.technicianId !== scope.userId) {
      throw new NotFoundError('Intake order', id)
    }

    return order
  }

  async list(
    actor: IntakeOrdersActor,
    query: IntakeOrderListQuery,
  ): Promise<IntakeOrderListResponse> {
    const scope = resolveScope(actor)
    const { items, total } = await this.repo.list(scope, query)
    return { items, total, page: query.page, pageSize: query.pageSize }
  }

  async summary(actor: IntakeOrdersActor): Promise<IntakeOrderSummary> {
    return this.repo.summary(resolveScope(actor))
  }

  async findById(id: string, actor: IntakeOrdersActor): Promise<IntakeOrderDetail> {
    return this.loadVisible(id, actor)
  }

  /**
   * Three outcomes plus "free". The actor's own unfinished intake is an offer to resume, not
   * an error; a colleague's yields their name but no id, because they cannot open it.
   */
  async checkNumber(
    orderNumber: string,
    actor: IntakeOrdersActor,
  ): Promise<IntakeNumberCheckResponse> {
    const holder = await this.repo.findByNumberKey(normalizeOrderNumberKey(orderNumber))

    if (holder === null) {
      return {
        status: IntakeNumberCheckStatus.Free,
        orderId: null,
        draftStep: null,
        takenByName: null,
        vehicle: null,
        plate: null,
      }
    }

    if (holder.signedAt !== null) {
      const canOpen =
        actor.permissions.includes('intake_orders.view') || holder.technicianId === actor.id
      return {
        status: IntakeNumberCheckStatus.TakenOrder,
        orderId: canOpen ? holder.id : null,
        draftStep: null,
        takenByName: holder.technicianName,
        vehicle: holder.vehicle,
        plate: holder.plate,
      }
    }

    if (holder.technicianId === actor.id) {
      return {
        status: IntakeNumberCheckStatus.TakenDraftMine,
        orderId: holder.id,
        draftStep: holder.draftStep,
        takenByName: holder.technicianName,
        vehicle: holder.vehicle,
        plate: holder.plate,
      }
    }

    return {
      status: IntakeNumberCheckStatus.TakenDraftOther,
      orderId: null,
      draftStep: null,
      takenByName: holder.technicianName,
      vehicle: null,
      plate: null,
    }
  }

  async lookupByPlate(plate: string): Promise<IntakePlateLookupResponse> {
    return { match: await this.repo.lookupByPlate(normalizePlateKey(plate)) }
  }

  async create(
    input: IntakeOrderCreateInput,
    auditContext: HttpActorContext,
  ): Promise<IntakeOrderDetail> {
    await this.assertNumberFree(normalizeOrderNumberKey(input.orderNumber), null)

    const created = await this.repo.create(input, auditContext.actorUserId)

    await this.audit.log({
      entityType: 'intake_order',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { after: created },
    })

    this.signalChanged()
    return created
  }

  async update(
    id: string,
    patch: IntakeOrderUpdateInput,
    actor: IntakeOrdersActor,
    auditContext: HttpActorContext,
  ): Promise<IntakeOrderDetail> {
    const before = await this.loadVisible(id, actor)

    if (patch.orderNumber !== undefined) {
      await this.assertNumberFree(normalizeOrderNumberKey(patch.orderNumber), id)
    }

    const isAmendment = before.signedAt !== null && this.assertPostSigningPatchAllowed(patch, actor)

    const updated = await this.repo.update(id, patch, isAmendment ? auditContext.actorUserId : null)
    if (updated === null) {
      throw new NotFoundError('Intake order', id)
    }

    await this.audit.log({
      entityType: 'intake_order',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: isAmendment
        ? { before, after: updated, transition: 'amend_after_signing' }
        : { before, after: updated },
    })

    this.signalChanged()
    return updated
  }

  /**
   * Returns true when the patch is an amendment of the intake condition (so the caller
   * stamps `amended_at`/`amended_by`). Throws when the patch touches anything the signed
   * document must keep.
   */
  private assertPostSigningPatchAllowed(
    patch: IntakeOrderUpdateInput,
    actor: IntakeOrdersActor,
  ): boolean {
    const touched = Object.keys(patch)
    const free = new Set<string>(FREE_AFTER_SIGNING)
    const condition = new Set<string>(CONDITION_FIELDS)

    const conditionTouched = touched.filter((field) => condition.has(field))
    const frozenTouched = touched.filter((field) => !free.has(field) && !condition.has(field))

    if (frozenTouched.length > 0) {
      throw new ValidationError(
        `Signed intake order: ${frozenTouched.join(', ')} cannot be changed after signing`,
      )
    }

    if (conditionTouched.length === 0) {
      return false
    }

    // The freeze is enforced here, not only on the route: a serviser holds `update` and must
    // not be able to route around the office's amend gate by patching the condition.
    if (!actor.permissions.includes('intake_orders.amend')) {
      throw new ForbiddenError('Correcting the intake condition after signing requires amend')
    }

    return true
  }

  /** Both signatures in — the intake is finished and the office's list can see it. */
  async sign(
    id: string,
    input: IntakeOrderSignInput,
    actor: IntakeOrdersActor,
    auditContext: HttpActorContext,
  ): Promise<IntakeOrderDetail> {
    const before = await this.loadVisible(id, actor)

    if (before.signedAt !== null) {
      throw new ConflictError('Intake order is already signed')
    }

    const signed = await this.repo.sign(id, input)
    if (signed === null) {
      throw new NotFoundError('Intake order', id)
    }

    await this.audit.log({
      entityType: 'intake_order',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { before, after: signed, transition: 'sign' },
    })

    this.signalChanged()
    return signed
  }

  /** The serviser's one-way button. */
  async advance(
    id: string,
    actor: IntakeOrdersActor,
    auditContext: HttpActorContext,
  ): Promise<IntakeOrderDetail> {
    const before = await this.loadVisible(id, actor)
    this.assertSignedForStatusChange(before)

    return this.applyStatus(id, nextStatus(before.status), before, 'advance', auditContext)
  }

  /** The office's correction: any status, always recorded. */
  async changeStatus(
    id: string,
    input: IntakeOrderChangeStatusInput,
    actor: IntakeOrdersActor,
    auditContext: HttpActorContext,
  ): Promise<IntakeOrderDetail> {
    const before = await this.loadVisible(id, actor)
    this.assertSignedForStatusChange(before)

    if (before.status === input.status) {
      return before
    }

    return this.applyStatus(id, input.status, before, 'change_status', auditContext)
  }

  private assertSignedForStatusChange(order: IntakeOrderDetail): void {
    if (order.signedAt === null) {
      throw new ValidationError('An unfinished intake has no status to move — sign it first')
    }
  }

  private async applyStatus(
    id: string,
    status: string,
    before: IntakeOrderDetail,
    transition: 'advance' | 'change_status',
    auditContext: HttpActorContext,
  ): Promise<IntakeOrderDetail> {
    const updated = await this.repo.setStatus(id, status)
    if (updated === null) {
      throw new NotFoundError('Intake order', id)
    }

    await this.audit.log({
      entityType: 'intake_order',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: {
        before: { status: before.status },
        after: { status: updated.status },
        transition,
      },
    })

    this.signalChanged()
    return updated
  }

  /**
   * An unfinished intake is really deleted — `ODUSTANI` throws the sheet away and releases
   * the number. A signed one is soft-deleted by the office only: it is evidence, so it
   * leaves the list and stays in the database with a trace of who removed it.
   */
  async delete(
    id: string,
    actor: IntakeOrdersActor,
    auditContext: HttpActorContext,
  ): Promise<void> {
    const before = await this.loadVisible(id, actor)

    if (before.signedAt === null) {
      await this.repo.hardDelete(id)
    } else {
      if (!actor.permissions.includes('intake_orders.delete')) {
        throw new ForbiddenError('Removing a signed intake order requires delete')
      }
      await this.repo.softDelete(id)
    }

    await this.audit.log({
      entityType: 'intake_order',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: {
        before,
        transition: before.signedAt === null ? 'discard_draft' : 'soft_delete',
      },
    })

    this.signalChanged()
  }

  /**
   * The number is a live claim on a pad sheet, so this refuses a duplicate before the unique
   * index does — the index stays as the second layer, for two servisers typing at once.
   */
  private async assertNumberFree(numberKey: string, allowedOrderId: string | null): Promise<void> {
    const holder = await this.repo.findByNumberKey(numberKey)
    if (holder === null || holder.id === allowedOrderId) {
      return
    }

    // The pre-flight `check-number` is what links the serviser to the owning order; this
    // 409 is the second layer for two people typing the same number at once.
    throw new ConflictError('Order number is already taken')
  }
}
