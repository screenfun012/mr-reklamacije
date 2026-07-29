import {
  AuditAction,
  ResourceChangedKey,
  intakeDamageZoneOf,
  intakeOrderStatusValues,
} from '@mr/shared'

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
  processUploadFile,
  writeStoredFile,
  type AttachmentUploadFileInput,
} from '../../core/attachments/attachment-upload-pipeline.js'
import {
  buildIntakeAttachmentStoragePath,
  type StorageService,
} from '../../infrastructure/storage/storage.interface.js'
import { extensionForMimeType } from '@mr/shared'
import {
  normalizeOrderNumberKey,
  normalizePlateKey,
  type IntakeOrdersRepository,
} from './intake-orders.repository.js'
import type { IntakeOrdersActor, IntakeOrdersListScope } from './intake-orders.types.js'
import { IntakeNumberCheckStatus } from './intake-orders.validators.js'
import type {
  IntakeOrderPhoto,
  IntakeNumberCheckResponse,
  IntakeOrderChangeStatusInput,
  IntakeOrderCreateInput,
  IntakeOrderDetail,
  IntakeOrderHistoryEntry,
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

/**
 * A patch of a SIGNED order is either an amendment of the condition or an edit of the two
 * fields that stay free (services, materials). The free edit still has to reach the Istorija
 * tab — it is the only change a signed work order allows — so it is tagged rather than left
 * transition-less, which is the shape the history projection drops (docs/25 V-6-1 §6.1).
 *
 * Takes `signedAt` itself (not a pre-computed boolean) so a swapped argument at the call site
 * is a type error, not a silently-flipped transition — the same reason the return type is a
 * closed union rather than `string | null`.
 */
function updateTransition(
  signedAt: string | null,
  isAmendment: boolean,
): 'amend_after_signing' | 'spec_updated' | null {
  if (isAmendment) {
    return 'amend_after_signing'
  }
  if (signedAt !== null) {
    return 'spec_updated'
  }
  return null
}

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
    private readonly storage: StorageService,
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

  /**
   * An unfinished intake may only be moved forward by the serviser who started it. Until now the
   * rule lived only in the wizard's UI, while the server accepted the patch from anyone holding
   * `intake_orders.update` — and V-6 adds a typeable second entrance to that draft
   * (`/prijem/novi?resume=<id>`), so the gap stops being theoretical.
   *
   * 403, not 404: the row scope has already spoken. A serviser reaching for a colleague's draft
   * never gets here — `loadVisible` gave him a 404 — so the only caller this can refuse is an
   * office actor who legitimately knows the order exists.
   *
   * `delete` is deliberately NOT guarded: the office throwing away the draft of a serviser who
   * left the firm is a rule of its own (docs/25 §3.3.5).
   */
  private assertDraftOwner(order: IntakeOrderDetail, actor: IntakeOrdersActor): void {
    if (order.signedAt !== null) {
      return
    }
    if (order.technicianId === actor.id) {
      return
    }
    throw new ForbiddenError('An unfinished intake can only be continued by its own serviser')
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
   * The order's history. `loadVisible` runs first, so a serviser asking for a colleague's order
   * gets the same 404 the detail gives — the history must not become a way around row-level scope.
   */
  async listHistory(id: string, actor: IntakeOrdersActor): Promise<IntakeOrderHistoryEntry[]> {
    await this.loadVisible(id, actor)
    return this.repo.listHistory(id)
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
    this.assertDraftOwner(before, actor)

    if (patch.orderNumber !== undefined) {
      await this.assertNumberFree(normalizeOrderNumberKey(patch.orderNumber), id)
    }

    const isAmendment = before.signedAt !== null && this.assertPostSigningPatchAllowed(patch, actor)

    const updated = await this.repo.update(
      id,
      this.withDerivedZones(patch, before),
      isAmendment ? auditContext.actorUserId : null,
    )
    if (updated === null) {
      throw new NotFoundError('Intake order', id)
    }

    const transition = updateTransition(before.signedAt, isAmendment)

    await this.audit.log({
      entityType: 'intake_order',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes:
        transition === null ? { before, after: updated } : { before, after: updated, transition },
    })

    this.signalChanged()
    return updated
  }

  /**
   * The zone is derived here, never taken from the client. It is printed on the work order the
   * customer signs, so a wrong word is a permanent error on evidence — and deriving it from
   * (vehicleType, x, y) is also what keeps the map, the defect list and the print agreeing.
   *
   * Changing the vehicle type re-zones the existing markers, because the same coordinates mean
   * a different part of a kombi than of a car.
   */
  private withDerivedZones(
    patch: IntakeOrderUpdateInput,
    before: IntakeOrderDetail,
  ): IntakeOrderUpdateInput {
    const vehicleType = patch.vehicleType ?? before.vehicleType
    const damages = patch.damages ?? (patch.vehicleType !== undefined ? before.damages : undefined)

    if (damages === undefined) {
      return patch
    }

    return {
      ...patch,
      damages: damages.map((damage) => ({
        ...damage,
        zone: intakeDamageZoneOf(vehicleType, damage.x, damage.y),
      })),
    }
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
    this.assertDraftOwner(before, actor)

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
   * A photo arriving for an order that is ALREADY SIGNED is accepted, not rejected (Nikola,
   * 2026-07-27). The tablet uploads in the background while the serviser works through steps 4
   * and 5, so a photo can legitimately land after the signature — it was taken before it, and
   * refusing it would lose the evidence the whole module exists for, purely because the hall's
   * WiFi stalled at the wrong second.
   *
   * Which is why "who is uploading" decides whether this counts as an amendment: the order's own
   * serviser is a queued arrival and leaves no mark, while anyone else adding a photo afterwards
   * is changing the intake condition — that needs `amend` and stamps the printed document.
   */
  async uploadPhoto(
    id: string,
    file: AttachmentUploadFileInput,
    damageId: string | null,
    actor: IntakeOrdersActor,
    auditContext: HttpActorContext,
  ): Promise<IntakeOrderPhoto> {
    const order = await this.loadVisible(id, actor)
    this.assertDraftOwner(order, actor)

    if (damageId !== null && !order.damages.some((damage) => damage.id === damageId)) {
      throw new ValidationError('That damage does not exist on this intake order')
    }

    const isLateArrival = order.technicianId === actor.id
    const isAmendment = order.signedAt !== null && !isLateArrival
    if (isAmendment && !actor.permissions.includes('intake_orders.amend')) {
      throw new ForbiddenError('Adding a photo after signing requires amend')
    }

    const processed = await processUploadFile(file)
    const attachmentId = crypto.randomUUID()
    const storagePath = buildIntakeAttachmentStoragePath({
      orderId: id,
      attachmentId,
      extension: extensionForMimeType(processed.storedMime),
    })

    const stored = await writeStoredFile(this.storage, {
      storagePath,
      storedData: processed.storedData,
      storedMime: processed.storedMime,
      optimized: processed.optimized,
    })

    const photo = await this.repo.insertPhoto({
      orderId: id,
      damageId,
      fileName: file.fileName,
      storagePath,
      mimeType: processed.storedMime,
      fileSizeBytes: processed.storedData.byteLength,
      contentSha256: processed.contentSha256,
      width: stored.width,
      height: stored.height,
      thumbnailPath: stored.thumbnailPath,
      uploadedBy: auditContext.actorUserId,
    })

    if (isAmendment) {
      await this.repo.update(id, {}, auditContext.actorUserId)
      await this.repo.shiftPhotosExpected(id, 1)
    }

    await this.audit.log({
      entityType: 'intake_order',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: {
        after: { photoId: photo.id, damageId },
        transition: isAmendment ? 'amend_photo_added' : 'photo_uploaded',
      },
    })

    this.signalChanged()
    return photo
  }

  /**
   * A serviser deletes his own photos freely WHILE FILLING THE INTAKE IN — he may have taken a
   * blurred one and needs to retake it, and step 3 is where he notices. The moment both
   * signatures are in, the photos are frozen: the customer signed for the condition those photos
   * show, so removing one afterwards is an office amendment and stamps the document (Nikola chose
   * this boundary over "until the car goes into work", 2026-07-27).
   */
  async deletePhoto(
    id: string,
    attachmentId: string,
    actor: IntakeOrdersActor,
    auditContext: HttpActorContext,
  ): Promise<void> {
    const order = await this.loadVisible(id, actor)
    this.assertDraftOwner(order, actor)
    const photo = await this.repo.findPhoto(id, attachmentId)
    if (photo === null) {
      throw new NotFoundError('Intake photo', attachmentId)
    }

    const isAmendment = order.signedAt !== null
    if (isAmendment && !actor.permissions.includes('intake_orders.amend')) {
      throw new ForbiddenError('Removing a photo after signing requires amend')
    }

    await this.repo.softDeletePhoto(id, attachmentId)
    if (isAmendment) {
      await this.repo.update(id, {}, auditContext.actorUserId)
      await this.repo.shiftPhotosExpected(id, -1)
    }

    await this.audit.log({
      entityType: 'intake_order',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: {
        before: { photoId: attachmentId, fileName: photo.fileName },
        transition: isAmendment ? 'amend_photo_removed' : 'photo_removed',
      },
    })

    this.signalChanged()
  }

  /**
   * Serving goes through this module, never `/api/attachments` — that route is gated by
   * `attachments.view_internal`, and a serviser holding it could read a claim's files.
   */
  async getPhotoDownloadMeta(
    id: string,
    attachmentId: string,
    variant: 'original' | 'thumbnail',
    actor: IntakeOrdersActor,
  ): Promise<{ storagePath: string; mimeType: string; fileName: string; etag: string | null }> {
    await this.loadVisible(id, actor)
    const photo = await this.repo.findPhoto(id, attachmentId)
    if (photo === null) {
      throw new NotFoundError('Intake photo', attachmentId)
    }

    const useThumbnail = variant === 'thumbnail' && photo.thumbnailPath !== null
    return {
      storagePath: useThumbnail ? (photo.thumbnailPath as string) : photo.storagePath,
      mimeType: useThumbnail ? 'image/jpeg' : photo.mimeType,
      fileName: photo.fileName,
      // Content-addressed, so the browser can revalidate instead of re-downloading.
      etag:
        photo.contentSha256 === null ? null : `"${photo.contentSha256}${useThumbnail ? '-t' : ''}"`,
    }
  }

  async openPhotoStream(
    storagePath: string,
  ): Promise<{ stream: ReadableStream<Uint8Array>; size: number }> {
    return this.storage.readStream(storagePath)
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
