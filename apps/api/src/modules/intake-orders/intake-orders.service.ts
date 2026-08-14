import {
  AuditAction,
  ResourceChangedKey,
  freeFieldsFor,
  intakeDamageZoneOf,
  intakeOrderStatusValues,
  IntakeOrderStatus,
  isIntakeConditionRecorded,
  type IntakeChecklist,
} from '@mr/shared'

import { createHash } from 'node:crypto'

import type { Logger } from '@mr/logger'

import type { HttpActorContext } from '../../core/http/actor-context.js'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UnprocessableEntityError,
  ValidationError,
} from '../../core/errors/domain-errors.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { IntakeChecklistCatalogPort } from '../../core/ports/intake-checklist-catalog-port.js'
import {
  processUploadFile,
  writeStoredFile,
  type AttachmentUploadFileInput,
} from '../../core/attachments/attachment-upload-pipeline.js'
import type { EmailPort } from '../../core/ports/email-port.js'
import type { PdfRenderer } from '../../core/pdf/pdf-renderer.js'
import {
  buildIntakeAttachmentStoragePath,
  buildIntakeDocumentStoragePath,
  type IntakeDocumentKind,
  type StorageService,
} from '../../infrastructure/storage/storage.interface.js'
import { renderIntakeDocumentPdf, type IntakeDocumentInput } from './intake-document-pdf.js'
import { renderIntakeHandoverPdf } from './intake-handover-pdf.js'
import {
  intakeHandoverEmailSubject,
  intakeHandoverFileName,
  renderIntakeHandoverEmailHtml,
} from './intake-handover.email.js'
import {
  intakeDocumentEmailSubject,
  intakeDocumentFileName,
  renderIntakeDocumentEmailHtml,
} from './intake-orders.email.js'
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
  IntakeOrderHandoverInput,
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

const DOCUMENT_MIME_TYPE = 'application/pdf'

/** Everything that differs between the two papers an order produces. */
interface IntakeDocumentFlavour {
  readonly render: (renderer: PdfRenderer, input: IntakeDocumentInput) => Promise<Buffer>
  readonly subject: (orderNumber: string) => string
  readonly html: (orderNumber: string) => string
  /**
   * Deliberately per kind. Both papers carry the same order number, so one naming rule would have
   * the second download quietly overwrite the first in the owner's folder.
   */
  readonly fileName: (orderNumber: string) => string
}

/**
 * Which drawing and which message a kind gets. One exhaustive map, and `satisfies Record<...>` is
 * the whole point of it: a third document kind becomes a compile error here instead of falling
 * through to the work order's renderer and mailing the wrong paper to a customer.
 */
const DOCUMENT_FLAVOURS = {
  intake: {
    render: renderIntakeDocumentPdf,
    subject: intakeDocumentEmailSubject,
    html: renderIntakeDocumentEmailHtml,
    fileName: intakeDocumentFileName,
  },
  handover: {
    render: renderIntakeHandoverPdf,
    subject: intakeHandoverEmailSubject,
    html: renderIntakeHandoverEmailHtml,
    fileName: intakeHandoverFileName,
  },
} as const satisfies Record<IntakeDocumentKind, IntakeDocumentFlavour>

/**
 * A signed order allows exactly two changes, and each gets its own name in Istorija. A patch that
 * carries the contact number is named for it: services and materials move constantly and would
 * otherwise bury the one entry that says somebody wrote a second phone number on a signed order.
 *
 * Takes `signedAt` itself (not a pre-computed boolean) so a swapped argument at the call site is a
 * type error, and returns a closed union rather than `string | null` for the same reason.
 */
function updateTransition(
  signedAt: string | null,
  patch: IntakeOrderUpdateInput,
): 'contact_added' | 'spec_updated' | null {
  if (signedAt === null) {
    return null
  }
  if (patch.contactPhone !== undefined) {
    return 'contact_added'
  }
  return 'spec_updated'
}

/**
 * How many unknown codes an error message names before it starts counting instead. A caller may
 * legitimately send up to `INTAKE_CHECKLIST_MAX_ITEMS` of them, and a message listing two hundred is
 * one nobody reads — but a bare count would not say WHICH item to fix, so the names come first.
 */
const NAMED_UNKNOWN_CODES = 5

function describeUnknownCodes(unknown: readonly string[]): string {
  const named = unknown.slice(0, NAMED_UNKNOWN_CODES).join(', ')
  const rest = unknown.length - NAMED_UNKNOWN_CODES

  return rest > 0 ? `${named} (+${rest} more)` : named
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
    private readonly checklistCatalog: IntakeChecklistCatalogPort,
    private readonly pdfRenderer: PdfRenderer,
    private readonly email: EmailPort,
    private readonly logger: Logger,
  ) {}

  /**
   * The sealings currently running, one entry per order AND kind — the two documents of one order
   * may seal at once.
   *
   * Signing starts one in the background and the office can start another by hand — a retry after a
   * failure — and without this both render and both write the same key. Measured while writing the
   * test for it: the second write truncated the file the first had just finished, and the download
   * that followed streamed zero bytes. Instance state, not module state: the container builds one
   * service, and a second replica is not a thing this repository has yet (CLAUDE.md §9).
   */
  private readonly documentsBeingSealed = new Map<string, Promise<void>>()

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
   * `delete` carries its own version of this rule rather than calling this one, because the two
   * refusals mean different things and an operator reading the response body deserves the right
   * sentence. See `delete` below.
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

    // Asserted on the RAW patch, before zones are derived: a `vehicleType` patch pulls `damages`
    // in below, and the refusal must name what the caller actually sent. Unsigned orders pass
    // straight through — `freeFieldsFor` returns null for those and the assertion is a no-op.
    this.assertPostSigningPatchAllowed(before.signedAt, before.handoverSignedAt, patch)

    // The added number exists only because the signed one is frozen. On a draft there is nothing
    // to work around: the real field is still editable, and a second place to type the same thing
    // is a hole the screen would have to explain (docs/25 §3.0).
    if (before.signedAt === null && patch.contactPhone !== undefined) {
      throw new ValidationError(
        'contactPhone belongs to a signed order — correct ownerPhone instead',
      )
    }

    if (patch.orderNumber !== undefined) {
      await this.assertNumberFree(normalizeOrderNumberKey(patch.orderNumber), id)
    }

    // Only when the patch actually carries one: the wizard patches on every step (`create` cannot
    // carry a checklist at all), and a step that never touched the equipment list must not pay for
    // a query.
    if (patch.checklist !== undefined) {
      await this.assertChecklistCodesKnown(patch.checklist)
    }

    const effective = this.withDerivedZones(patch, before)
    const updated = await this.repo.update(id, effective)
    if (updated === null) {
      throw new NotFoundError('Intake order', id)
    }

    const transition = updateTransition(before.signedAt, effective)

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
   * The wire accepts any well-formed code; the CATALOG decides which ones exist, and this is where
   * that judgement happens (spec ⑭). A schema cannot make it: the shop adds and retires items at
   * runtime, so a closed list would refuse a patch carrying an item admin added this morning.
   *
   * Deactivated and soft-deleted codes pass — see `listKnownCodes`. An empty map costs no query at
   * all, which is also what lets a shop whose catalog is still empty walk out of step 1.
   */
  private async assertChecklistCodesKnown(checklist: IntakeChecklist): Promise<void> {
    const codes = Object.keys(checklist)
    if (codes.length === 0) {
      return
    }

    const known = new Set(await this.checklistCatalog.listKnownCodes())
    const unknown = codes.filter((code) => !known.has(code))

    if (unknown.length > 0) {
      throw new ValidationError(`Unknown checklist item: ${describeUnknownCodes(unknown)}`)
    }
  }

  /**
   * A signed order accepts only what `freeFieldsFor` still allows, and that narrows a second time
   * once the handover is signed too. Refused on the field's NAME, never on its value: pruning a key
   * because it happens to equal what is stored would make "send it again with the same value" a way
   * past the freeze. Enforced HERE and not only on the route — a serviser holds `update`, and there
   * is no second gate left to catch him.
   */
  private assertPostSigningPatchAllowed(
    signedAt: string | null,
    handoverSignedAt: string | null,
    patch: IntakeOrderUpdateInput,
  ): void {
    const allowed = freeFieldsFor(
      signedAt === null ? null : new Date(signedAt),
      handoverSignedAt === null ? null : new Date(handoverSignedAt),
    )
    if (allowed === null) {
      return
    }

    const free = new Set<string>(allowed)
    const frozen = Object.keys(patch).filter((field) => !free.has(field))

    if (frozen.length > 0) {
      throw new ValidationError(
        `Signed intake order: ${frozen.join(', ')} cannot be changed after signing`,
      )
    }
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

    /**
     * The owner signs the printed sheet standing at the car, and that sheet is the only evidence if
     * he later says a jack was in the boot — so it must assert SOMETHING. The wizard holds this line
     * too, but a tablet reloads and `?resume=` is a URL: the paper must not depend on which browser
     * produced it. An empty catalog passes, because that is the office's mistake and it must not
     * strand a car in the yard.
     */
    if (
      !isIntakeConditionRecorded(
        before.checklist,
        before.extraChecklist,
        before.equipmentNote,
        await this.checklistCatalog.countActiveItems(),
      )
    ) {
      throw new ValidationError('Intake order: the recorded condition is empty')
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
    this.produceDocumentInBackground(id, 'intake')
    return signed
  }

  /**
   * The signed sheet, sealed once.
   *
   * Made AFTER the signature is a fact and never as part of it: a failure here — Chromium gone, the
   * bucket unreachable — must not undo a signature the owner has already given, standing at his car.
   * So the caller starts it and walks away (`void`), and an order whose document failed simply has
   * none, which is a true statement about it. The office runs it again.
   *
   * Idempotent by the column rather than by a lock: a produced document is never re-rendered,
   * because a second render is a different file with a different seal for the same signed paper.
   *
   * It carries BOTH languages, one sheet each — Nikola's decision, 2026-08-14, and the reason there
   * is no locale argument here. There was no moment at which to choose one: the paper's language is
   * picked in the preview, which the operator opens after signing.
   *
   * Sending is part of the same job and guarded by its own column, so a run that sealed the file but
   * failed to send it recovers on the next run instead of needing a different button. Each step that
   * fails leaves the ones before it standing: an order with a document and no email is a true record
   * of where it got to.
   */
  async produceDocument(id: string, kind: IntakeDocumentKind): Promise<void> {
    const key = `${id}:${kind}`
    const running = this.documentsBeingSealed.get(key)
    if (running !== undefined) {
      return running
    }

    const sealing = this.sealDocument(id, kind).finally(() => {
      this.documentsBeingSealed.delete(key)
    })
    this.documentsBeingSealed.set(key, sealing)
    return sealing
  }

  private async sealDocument(id: string, kind: IntakeDocumentKind): Promise<void> {
    const existing = await this.repo.findDocument(id, kind)
    if (existing === null) {
      throw new NotFoundError('Intake order', id)
    }
    if (existing.signedAt === null) {
      throw new ValidationError('An unsigned intake has no document to produce')
    }
    if (existing.storagePath !== null) {
      // Already sealed — but possibly never sent, if the last run got that far and no further.
      if (existing.emailedAt === null) {
        await this.sendSealedDocument(id, kind, existing)
      }
      return
    }

    const order = await this.repo.findById(id)
    if (order === null) {
      throw new NotFoundError('Intake order', id)
    }

    const pdf = await DOCUMENT_FLAVOURS[kind].render(this.pdfRenderer, {
      order,
      // The DISPLAY read: an item the shop retired since keeps the name the owner answered it by.
      checklistItems: await this.checklistCatalog.listForDocument(),
    })

    const storagePath = buildIntakeDocumentStoragePath(id, kind)
    await this.storage.upload({ path: storagePath, data: pdf, mimeType: DOCUMENT_MIME_TYPE })
    // The seal is taken from the bytes that were STORED, not from the ones that were meant to be:
    // the whole point of it is to answer "is this that file".
    await this.repo.setDocument(id, kind, {
      storagePath,
      sha256: createHash('sha256').update(pdf).digest('hex'),
    })

    await this.sendSealedDocument(id, kind, { ...existing, storagePath })
  }

  /**
   * Sends the sealed sheet to the owner, once.
   *
   * Nothing happens when he left no address — Nikola, 13.08.: „ako klijent nema mail onda ništa, ne
   * šalje se nego samo dobije fizičku kopiju." The document is made either way; it is his copy of it
   * that is on paper.
   */
  private async sendSealedDocument(
    id: string,
    kind: IntakeDocumentKind,
    document: { orderNumber: string; ownerEmail: string | null; storagePath: string | null },
  ): Promise<void> {
    if (document.ownerEmail === null || document.storagePath === null || !this.email.enabled) {
      return
    }

    await this.deliverDocument(id, kind, {
      orderNumber: document.orderNumber,
      ownerEmail: document.ownerEmail,
      storagePath: document.storagePath,
    })
  }

  /**
   * The file itself, read back out of storage and attached — never re-rendered. A second render is a
   * different document for the same signed paper, so what the owner is sent again is byte for byte
   * what he was sent the first time, and what the seal in the database answers for.
   */
  private async deliverDocument(
    id: string,
    kind: IntakeDocumentKind,
    document: { orderNumber: string; ownerEmail: string; storagePath: string },
  ): Promise<void> {
    const content = await this.storage.read(document.storagePath)
    const flavour = DOCUMENT_FLAVOURS[kind]

    await this.email.send({
      to: document.ownerEmail,
      subject: flavour.subject(document.orderNumber),
      html: flavour.html(document.orderNumber),
      attachments: [
        {
          fileName: flavour.fileName(document.orderNumber),
          content,
          mimeType: DOCUMENT_MIME_TYPE,
        },
      ],
    })

    await this.repo.setDocumentEmailedAt(id, kind, new Date())
  }

  /**
   * The office's "send it again" — the same file, to the address on the order.
   *
   * Its own permission because it reaches outside the shop, and its own audit row because somebody
   * decided to do it. It refuses rather than improvises: no document is 404 (there is nothing to
   * send), no address is a 422 the operator can act on by adding one.
   */
  async sendDocument(
    id: string,
    actor: IntakeOrdersActor,
    auditContext: HttpActorContext,
    kind: IntakeDocumentKind,
  ): Promise<void> {
    await this.loadVisible(id, actor)

    const document = await this.repo.findDocument(id, kind)
    if (document === null || document.storagePath === null) {
      throw new NotFoundError('Intake order document', id)
    }
    if (document.ownerEmail === null) {
      // 422, not 400: the request is perfectly well formed, the ORDER is what cannot answer it.
      throw new UnprocessableEntityError('The owner left no email address for this order')
    }
    if (!this.email.enabled) {
      throw new ServiceUnavailableError('Slanje e-pošte trenutno nije podešeno.')
    }

    await this.deliverDocument(id, kind, {
      orderNumber: document.orderNumber,
      ownerEmail: document.ownerEmail,
      storagePath: document.storagePath,
    })

    await this.audit.log({
      entityType: 'intake_order',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { transition: 'send_document' },
    })
  }

  /** Starts the sealing and returns immediately, leaving the failure in the log rather than in the
   * caller's hands. Signing must not wait on a browser, and must not fail with one. */
  private produceDocumentInBackground(id: string, kind: IntakeDocumentKind): void {
    void this.produceDocument(id, kind).catch((error: unknown) => {
      this.logger.error({ err: error, intakeOrderId: id }, 'Failed to produce the intake document')
    })
  }

  /**
   * What the office downloads. `loadVisible` first, so an order outside the actor's scope answers
   * 404 before anything about its document is known.
   */
  async getDocumentDownloadMeta(
    id: string,
    actor: IntakeOrdersActor,
    kind: IntakeDocumentKind,
  ): Promise<{ storagePath: string; mimeType: string; fileName: string; etag: string | null }> {
    await this.loadVisible(id, actor)

    const document = await this.repo.findDocument(id, kind)
    if (document === null || document.storagePath === null) {
      throw new NotFoundError('Intake order document', id)
    }

    return {
      storagePath: document.storagePath,
      mimeType: DOCUMENT_MIME_TYPE,
      fileName: DOCUMENT_FLAVOURS[kind].fileName(document.orderNumber),
      etag: document.sha256,
    }
  }

  openDocumentStream(
    storagePath: string,
  ): Promise<{ stream: ReadableStream<Uint8Array>; size: number }> {
    return this.storage.readStream(storagePath)
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

  /**
   * The vehicle goes back, and both people sign for it.
   *
   * Who handed it over is the CALLER (`actor.id`), never a value from the body: the whole worth of
   * this paper is that the name under the signature is the person who actually stood there.
   *
   * The sealing runs AFTER the signature is a fact and never as part of it — same rule as the
   * intake's. Chromium falling over must not undo a signature the owner has already given standing
   * beside his car; an order whose sheet failed simply has none, and the office runs it again.
   */
  async handOver(
    id: string,
    input: IntakeOrderHandoverInput,
    actor: IntakeOrdersActor,
    auditContext: HttpActorContext,
  ): Promise<IntakeOrderDetail> {
    const before = await this.loadVisible(id, actor)

    // 409 rather than 422: nothing is wrong with the request, the ORDER is in the wrong state for
    // it. A vehicle that was never taken in on paper cannot be given back on paper.
    if (before.signedAt === null) {
      throw new ConflictError('An unsigned intake has nothing to hand over — sign it first')
    }
    /**
     * Keyed on the SIGNATURE, while its unsigned twin below keys on the STATUS. Deliberate, and not
     * to be "aligned": an order released without a signature is `preuzeto` with nothing signed for
     * it, and this guard lets a proper handover still be signed afterwards. That is the repair path
     * for the owner who turns up at 19:00 once the serviser has gone home — the next morning turns a
     * visible gap in the evidence into a real record. What may never happen twice is the signing.
     */
    if (before.handoverSignedAt !== null) {
      throw new ConflictError('This vehicle has already been handed over')
    }

    const handed = await this.repo.handOver(id, input, actor.id)
    if (handed === null) {
      throw new NotFoundError('Intake order', id)
    }

    await this.audit.log({
      entityType: 'intake_order',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: { before, after: handed, transition: 'handover' },
    })

    this.signalChanged()
    this.produceDocumentInBackground(id, 'handover')
    return handed
  }

  /**
   * The office recording a pickup nobody signed for — the owner took the car while the tablet was
   * flat, or a colleague released it and said so afterwards.
   *
   * `handover_signed_at` stays NULL, and that emptiness IS the record: this order is `preuzeto` with
   * nothing signed for it. NO document is made — there is no signature to seal, and a handover sheet
   * with two blank rules would look exactly like one somebody forgot to sign.
   */
  async handOverWithoutSignature(
    id: string,
    actor: IntakeOrdersActor,
    auditContext: HttpActorContext,
  ): Promise<IntakeOrderDetail> {
    const before = await this.loadVisible(id, actor)

    if (before.signedAt === null) {
      throw new ConflictError('An unsigned intake has nothing to hand over — sign it first')
    }
    /**
     * Keyed on the STATUS, not on `handoverSignedAt` like its signed twin above — the two guards
     * ask different questions on purpose. All this one has to refuse is recording a second "he
     * already took it" over a vehicle that has left, whichever way it left. Reading the signature
     * here instead would let an already-signed handover be overwritten by a blank one.
     */
    if (before.status === IntakeOrderStatus.PickedUp) {
      throw new ConflictError('This vehicle has already been handed over')
    }

    return this.applyStatus(
      id,
      IntakeOrderStatus.PickedUp,
      before,
      'handover_skipped',
      auditContext,
    )
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
    transition: 'advance' | 'change_status' | 'handover_skipped',
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
   * the number. A SIGNED one cannot be removed at all any more (2026-08-11): if a signed record
   * may be destroyed, freezing its fields is weaker than deleting the whole document.
   *
   * Throwing away a draft that is NOT yours additionally costs `delete`. The route gate is an
   * OR (`update` or `delete`) and the row scope hands any `intake_orders.view` holder every
   * serviser's draft, so without this a hand-built role of "sees everything, may edit, may not
   * delete" could permanently destroy a colleague's started intake — hard, with nothing to undo it
   * with — by typing `/prijem/novi?resume=<id>` and pressing ODUSTANI. The office keeps
   * `delete`, so cleaning up after a serviser who left the firm (docs/25 §3.3) is untouched.
   * The UI already drew this line (`isOwner || canDelete` in the draft bar); the server was the
   * half that took it on trust.
   *
   * 403, not 404: whoever reaches this branch holds `view` and already sees the draft in his own
   * list — its existence is not a secret from him, so there is nothing to protect by lying.
   */
  async delete(
    id: string,
    actor: IntakeOrdersActor,
    auditContext: HttpActorContext,
  ): Promise<void> {
    const before = await this.loadVisible(id, actor)

    /**
     * The signature closes the record, and that includes whether it exists: a signed order is the
     * shop's half of a document the owner is holding. Only an unfinished draft can be discarded,
     * and that is a HARD delete — its number goes back into circulation.
     */
    if (before.signedAt !== null) {
      throw new ValidationError('A signed intake order cannot be removed')
    }

    if (before.technicianId !== actor.id && !actor.permissions.includes('intake_orders.delete')) {
      throw new ForbiddenError("Discarding another serviser's unfinished intake requires delete")
    }
    await this.repo.hardDelete(id)

    await this.audit.log({
      entityType: 'intake_order',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      // Only a draft reaches this line, so there is one transition left to write. The row it
      // belongs to is gone (hard delete), which is why the history projection never shows it.
      changes: { before, transition: 'discard_draft' },
    })

    this.signalChanged()
  }

  /**
   * A photo arriving for an order that is ALREADY SIGNED is accepted, not rejected (Nikola,
   * 2026-07-27). The tablet uploads in the background while the serviser works through the last
   * steps, so a photo can legitimately land after the signature — it was taken before it, and
   * refusing it would lose the evidence the whole module exists for, purely because the hall's
   * WiFi stalled at the wrong second.
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

    /**
     * A late arrival is the tablet delivering what it already held at signing — not a change, which
     * is why `docs/25` §3.6 can promise "no network → the order saves, the photos go by themselves".
     *
     * ⚠ The old gate asked only WHO uploads, never how many, so the order's own serviser could hang
     * a photo of damage done in the shop onto a frozen record a week later. `photos_expected` was
     * written at signing as "arrived + outstanding, failures included", so `photosPending` is
     * exactly how many photos the record still admits are missing — and the door is that wide, no
     * wider.
     */
    if (order.signedAt !== null) {
      if (order.technicianId !== actor.id) {
        throw new ForbiddenError('A signed intake order accepts photos only from its own serviser')
      }
      if (order.photosPending <= 0) {
        throw new ValidationError('A signed intake order already holds every photo it expected')
      }
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

    await this.audit.log({
      entityType: 'intake_order',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: {
        after: { photoId: photo.id, damageId },
        transition: 'photo_uploaded',
      },
    })

    this.signalChanged()
    return photo
  }

  /**
   * A serviser deletes his own photos freely WHILE FILLING THE INTAKE IN — he may have taken a
   * blurred one and needs to retake it, and step 3 is where he notices. The moment both
   * signatures are in, the photos are frozen for everyone (Nikola chose this boundary over
   * "until the car goes into work", 2026-07-27).
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

    /**
     * The customer signed for the condition these photos show, so removing one afterwards is
     * exactly the divergence the freeze exists to prevent. Refused for everyone — the office no
     * longer has a stamp to record it with, and a silent removal is worse than a refusal.
     */
    if (order.signedAt !== null) {
      throw new ValidationError('A signed intake order: photos cannot be removed')
    }

    await this.repo.softDeletePhoto(id, attachmentId)

    await this.audit.log({
      entityType: 'intake_order',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      changes: {
        before: { photoId: attachmentId, fileName: photo.fileName },
        transition: 'photo_removed',
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
