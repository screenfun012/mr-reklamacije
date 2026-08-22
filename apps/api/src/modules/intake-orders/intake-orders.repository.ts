import {
  AttachmentPurpose,
  IntakeOrderStatus,
  type IntakeChecklist,
  type IntakeDamage,
  type IntakeExtraChecklistItem,
  type IntakeOwnerType,
  type IntakeOrderListView,
} from '@mr/shared'
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  notInArray,
  or,
  sql,
} from 'drizzle-orm'
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core'

import type { ApiDatabase } from '../../core/database.js'
import type { IntakeDocumentKind } from '../../infrastructure/storage/storage.interface.js'
import { attachments, auditLog, intakeOrders, users } from './intake-orders.schema.js'
import type { IntakeOrdersListScope } from './intake-orders.types.js'
import type {
  IntakeOrderCreateInput,
  IntakeOrderDetail,
  IntakeOrderHandoverInput,
  IntakeOrderHistoryEntry,
  IntakeOrderListItem,
  IntakeOrderListQuery,
  IntakeOrderPhoto,
  IntakeOrderQuote,
  IntakeOrderSignInput,
  IntakeOrderSummary,
  IntakeOrderUpdateInput,
  IntakePlateLookupResponse,
} from './intake-orders.validators.js'

/**
 * The SECOND `users` join of the detail read. Two different people appear on one order — the
 * serviser who took the vehicle in and whoever handed it back — so one join cannot answer both, and
 * without an alias Postgres has no way to tell the two `users` rows apart.
 */
const handoverTechnician = alias(users, 'handover_technician')

/**
 * Uniqueness key for a typed order number. Pads vary, so the format is never validated —
 * only case and surrounding whitespace are ignored, so `rn-0249/26 ` and `RN-0249/26`
 * cannot both be live at once.
 */
export function normalizeOrderNumberKey(value: string): string {
  return value.trim().toUpperCase()
}

/**
 * Plate lookup key: uppercase with every non-alphanumeric stripped, so `BG 774-LN`,
 * `bg774ln` and `BG-774-LN` all find the same vehicle. The plate is stored as typed for
 * display; only the key is compared.
 */
export function normalizePlateKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * A fresh intake has recorded NOTHING yet, and that is what it stores. It used to store the eight
 * codes the checklist was hardcoded to, which the catalog made into a lie in two directions: a shop
 * that retired an item still got it written into new evidence, and an item admin added was missing
 * from an order created after it. The rows appear when the serviser leaves step 2, which is when the
 * wizard sends the catalog's own list.
 */
const EMPTY_CHECKLIST: IntakeChecklist = {}

interface OrderRow {
  id: string
  orderNumber: string
  status: string
  receivedAt: Date
  technicianId: string
  technicianName: string | null
  vehicleType: string
  plate: string
  vehicle: string
  vin: string | null
  mileage: number | null
  arrivalMode: string
  ownerName: string
  ownerType: IntakeOwnerType
  ownerIdNumber: string | null
  ownerEmail: string | null
  ownerAddress: string | null
  ownerPhone: string
  contactPhone: string | null
  ownerRemarks: string | null
  fuelLevel: number
  checklist: IntakeChecklist | null
  extraChecklist: IntakeExtraChecklistItem[] | null
  equipmentNote: string | null
  damages: IntakeDamage[] | null
  extraDamages: string[] | null
  services: string[] | null
  materials: string[] | null
  draftStep: number | null
  photosExpected: number | null
  technicianSignature: string | null
  ownerSignature: string | null
  signedAt: Date | null
  archivedAt: Date | null
  documentReady: boolean
  documentEmailedAt: Date | null
  handoverTechnicianName: string | null
  handoverTechnicianSignature: string | null
  handoverOwnerSignature: string | null
  handoverSignedAt: Date | null
  handoverDocumentReady: boolean
  handoverDocumentEmailedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/** `photos_expected` is what the tablet held at signing; anything short of it never arrived. */
function pendingPhotoCount(expected: number | null, arrived: number): number {
  if (expected === null) {
    return 0
  }
  return Math.max(0, expected - arrived)
}

function mapPhotoRow(row: {
  id: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  width: number | null
  height: number | null
  thumbnailPath: string | null
  caption: string | null
  damageId: string | null
  uploadedAt: Date
}): IntakeOrderPhoto {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSizeBytes: row.fileSizeBytes,
    width: row.width,
    height: row.height,
    thumbnailPath: row.thumbnailPath,
    caption: row.caption,
    damageId: row.damageId,
    uploadedAt: row.uploadedAt.toISOString(),
  }
}

function mapDetail(
  row: OrderRow,
  photos: IntakeOrderPhoto[],
  quote: IntakeOrderQuote | null,
): IntakeOrderDetail {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status as IntakeOrderDetail['status'],
    receivedAt: row.receivedAt.toISOString(),
    technicianId: row.technicianId,
    technicianName: row.technicianName ?? '',
    vehicleType: row.vehicleType as IntakeOrderDetail['vehicleType'],
    plate: row.plate,
    vehicle: row.vehicle,
    vin: row.vin,
    mileage: row.mileage,
    arrivalMode: row.arrivalMode as IntakeOrderDetail['arrivalMode'],
    ownerName: row.ownerName,
    ownerType: row.ownerType,
    ownerIdNumber: row.ownerIdNumber,
    ownerEmail: row.ownerEmail,
    ownerAddress: row.ownerAddress,
    ownerPhone: row.ownerPhone,
    contactPhone: row.contactPhone,
    ownerRemarks: row.ownerRemarks,
    fuelLevel: row.fuelLevel,
    checklist: row.checklist ?? EMPTY_CHECKLIST,
    extraChecklist: row.extraChecklist ?? [],
    equipmentNote: row.equipmentNote,
    damages: row.damages ?? [],
    extraDamages: row.extraDamages ?? [],
    services: row.services ?? [],
    materials: row.materials ?? [],
    draftStep: row.draftStep,
    technicianSignature: row.technicianSignature,
    ownerSignature: row.ownerSignature,
    signedAt: row.signedAt === null ? null : row.signedAt.toISOString(),
    archivedAt: row.archivedAt === null ? null : row.archivedAt.toISOString(),
    quote,
    documentReady: row.documentReady,
    documentEmailedAt: row.documentEmailedAt === null ? null : row.documentEmailedAt.toISOString(),
    // Null and NOT `?? ''` like the intake's, because null is a real answer here: an order handed
    // over without a signature has nobody to name, and the sheet prints the role alone rather than
    // an empty line where a name belongs.
    handoverTechnicianName: row.handoverTechnicianName,
    handoverTechnicianSignature: row.handoverTechnicianSignature,
    handoverOwnerSignature: row.handoverOwnerSignature,
    handoverSignedAt: row.handoverSignedAt === null ? null : row.handoverSignedAt.toISOString(),
    handoverDocumentReady: row.handoverDocumentReady,
    handoverDocumentEmailedAt:
      row.handoverDocumentEmailedAt === null ? null : row.handoverDocumentEmailedAt.toISOString(),
    photosPending: pendingPhotoCount(row.photosExpected, photos.length),
    photos,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * The four columns one document lives in. Named explicitly rather than `Record<string, …>`: with an
 * open key set a typo compiles and only fails inside `findDocument`, at runtime, on the one path
 * that decides which file leaves the company.
 */
interface DocumentColumns {
  readonly storagePath: AnyPgColumn
  readonly sha256: AnyPgColumn
  readonly emailedAt: AnyPgColumn
  readonly signedAt: AnyPgColumn
}

/**
 * Which columns a document kind lives in. A map and not a branch per method: three methods each
 * carrying their own `if` is three places for the two kinds to drift apart.
 */
const DOCUMENT_COLUMNS = {
  intake: {
    storagePath: intakeOrders.documentStoragePath,
    sha256: intakeOrders.documentSha256,
    emailedAt: intakeOrders.documentEmailedAt,
    signedAt: intakeOrders.signedAt,
  },
  handover: {
    storagePath: intakeOrders.handoverDocumentStoragePath,
    sha256: intakeOrders.handoverDocumentSha256,
    emailedAt: intakeOrders.handoverDocumentEmailedAt,
    signedAt: intakeOrders.handoverSignedAt,
  },
} as const satisfies Record<IntakeDocumentKind, DocumentColumns>

export class IntakeOrdersRepository {
  constructor(private readonly db: ApiDatabase) {}

  private detailSelection() {
    return {
      id: intakeOrders.id,
      orderNumber: intakeOrders.orderNumber,
      status: intakeOrders.status,
      receivedAt: intakeOrders.receivedAt,
      technicianId: intakeOrders.technicianId,
      technicianName: users.name,
      vehicleType: intakeOrders.vehicleType,
      plate: intakeOrders.plate,
      vehicle: intakeOrders.vehicle,
      vin: intakeOrders.vin,
      mileage: intakeOrders.mileage,
      arrivalMode: intakeOrders.arrivalMode,
      ownerName: intakeOrders.ownerName,
      ownerType: intakeOrders.ownerType,
      ownerIdNumber: intakeOrders.ownerIdNumber,
      ownerEmail: intakeOrders.ownerEmail,
      ownerAddress: intakeOrders.ownerAddress,
      ownerPhone: intakeOrders.ownerPhone,
      contactPhone: intakeOrders.contactPhone,
      ownerRemarks: intakeOrders.ownerRemarks,
      fuelLevel: intakeOrders.fuelLevel,
      checklist: intakeOrders.checklist,
      extraChecklist: intakeOrders.extraChecklist,
      equipmentNote: intakeOrders.equipmentNote,
      damages: intakeOrders.damages,
      extraDamages: intakeOrders.extraDamages,
      services: intakeOrders.services,
      materials: intakeOrders.materials,
      draftStep: intakeOrders.draftStep,
      photosExpected: intakeOrders.photosExpected,
      technicianSignature: intakeOrders.technicianSignature,
      ownerSignature: intakeOrders.ownerSignature,
      signedAt: intakeOrders.signedAt,
      archivedAt: intakeOrders.archivedAt,
      // The presence of the file, not its key: the screen decides whether to offer a download.
      documentReady: sql<boolean>`${intakeOrders.documentStoragePath} IS NOT NULL`,
      documentEmailedAt: intakeOrders.documentEmailedAt,
      handoverTechnicianName: handoverTechnician.name,
      handoverTechnicianSignature: intakeOrders.handoverTechnicianSignature,
      handoverOwnerSignature: intakeOrders.handoverOwnerSignature,
      handoverSignedAt: intakeOrders.handoverSignedAt,
      // Same rule as `documentReady`, applied to the handover: the presence of the file, not its
      // key, and never selected in a form that could later be spread onto the wire by mistake.
      handoverDocumentReady: sql<boolean>`${intakeOrders.handoverDocumentStoragePath} IS NOT NULL`,
      handoverDocumentEmailedAt: intakeOrders.handoverDocumentEmailedAt,
      createdAt: intakeOrders.createdAt,
      updatedAt: intakeOrders.updatedAt,
    }
  }

  async findById(id: string): Promise<IntakeOrderDetail | null> {
    const [row] = await this.db
      .select(this.detailSelection())
      .from(intakeOrders)
      .leftJoin(users, eq(users.id, intakeOrders.technicianId))
      .leftJoin(handoverTechnician, eq(handoverTechnician.id, intakeOrders.handoverTechnicianId))
      .where(eq(intakeOrders.id, id))
      .limit(1)

    if (!row) {
      return null
    }

    const [photos, quote] = await Promise.all([this.listPhotos(id), this.findQuote(id)])
    return mapDetail(row as OrderRow, photos, quote)
  }

  async listPhotos(orderId: string): Promise<IntakeOrderPhoto[]> {
    const rows = await this.db
      .select({
        id: attachments.id,
        fileName: attachments.fileName,
        mimeType: attachments.mimeType,
        fileSizeBytes: attachments.fileSizeBytes,
        width: attachments.width,
        height: attachments.height,
        thumbnailPath: attachments.thumbnailPath,
        caption: attachments.caption,
        damageId: attachments.intakeDamageId,
        uploadedAt: attachments.uploadedAt,
      })
      .from(attachments)
      .where(
        and(
          eq(attachments.intakeOrderId, orderId),
          isNull(attachments.deletedAt),
          // The quote shares this table with the vehicle's photos, and an intake photo is
          // recognised by nothing but its order id — so without this it would show up in the photo
          // grid. Written the positive way, because that is what `insertPhoto` stores (the column
          // default), and a `!=` would also let a future fourth purpose in by accident.
          eq(attachments.purpose, AttachmentPurpose.ClaimAttachment),
        ),
      )
      .orderBy(asc(attachments.uploadedAt))

    return rows.map(mapPhotoRow)
  }

  /**
   * Scope and visibility in one predicate. The fork is the point: an `own` scope returns every
   * row of the caller, drafts included, and never reads the view — it is his own unfinished
   * work and hiding it would take away the only way back into it. Only the office's `all` scope
   * narrows.
   */
  private scopeCondition(scope: IntakeOrdersListScope, view: IntakeOrderListView) {
    if (scope.type === 'own') {
      return eq(intakeOrders.technicianId, scope.userId)
    }

    if (view === 'unfinished') {
      return isNull(intakeOrders.signedAt)
    }

    return isNotNull(intakeOrders.signedAt)
  }

  /**
   * Archived rows leave the working list — and this is deliberately OUTSIDE `scopeCondition`,
   * because that one returns early for a serviser and would let his archived orders keep showing.
   * `view=archived` is the one place they are the whole point.
   */
  private archivedCondition(view: IntakeOrderListView) {
    return view === 'archived'
      ? isNotNull(intakeOrders.archivedAt)
      : isNull(intakeOrders.archivedAt)
  }

  async list(
    scope: IntakeOrdersListScope,
    query: IntakeOrderListQuery,
  ): Promise<{ items: IntakeOrderListItem[]; total: number }> {
    const conditions = [this.scopeCondition(scope, query.view), this.archivedCondition(query.view)]

    if (query.status !== undefined) {
      conditions.push(eq(intakeOrders.status, query.status))
    }

    if (query.search !== undefined) {
      const term = `%${query.search}%`
      const plateTerm = `%${normalizePlateKey(query.search)}%`
      conditions.push(
        or(
          ilike(intakeOrders.orderNumber, term),
          ilike(intakeOrders.plateKey, plateTerm),
          ilike(intakeOrders.ownerName, term),
          ilike(intakeOrders.vehicle, term),
        )!,
      )
    }

    const where = and(...conditions)
    const offset = (query.page - 1) * query.pageSize

    const photoCount = sql<number>`(
      SELECT COUNT(*)::int FROM ${attachments}
      WHERE ${attachments.intakeOrderId} = ${intakeOrders.id}
        AND ${attachments.deletedAt} IS NULL
        AND ${attachments.purpose} = ${AttachmentPurpose.ClaimAttachment}
    )`

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select({
          id: intakeOrders.id,
          orderNumber: intakeOrders.orderNumber,
          status: intakeOrders.status,
          receivedAt: intakeOrders.receivedAt,
          vehicleType: intakeOrders.vehicleType,
          plate: intakeOrders.plate,
          vehicle: intakeOrders.vehicle,
          ownerName: intakeOrders.ownerName,
          contactPhone: intakeOrders.contactPhone,
          technicianId: intakeOrders.technicianId,
          technicianName: users.name,
          damageCount: sql<number>`COALESCE(jsonb_array_length(${intakeOrders.damages}), 0)::int`,
          photoCount,
          signedAt: intakeOrders.signedAt,
          archivedAt: intakeOrders.archivedAt,
          draftStep: intakeOrders.draftStep,
          photosExpected: intakeOrders.photosExpected,
        })
        .from(intakeOrders)
        .leftJoin(users, eq(users.id, intakeOrders.technicianId))
        .where(where)
        .orderBy(desc(intakeOrders.receivedAt), desc(intakeOrders.id))
        .limit(query.pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(intakeOrders).where(where),
    ])

    const items = rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status as IntakeOrderListItem['status'],
      receivedAt: row.receivedAt.toISOString(),
      vehicleType: row.vehicleType as IntakeOrderListItem['vehicleType'],
      plate: row.plate,
      vehicle: row.vehicle,
      ownerName: row.ownerName,
      contactPhone: row.contactPhone,
      technicianId: row.technicianId,
      technicianName: row.technicianName ?? '',
      damageCount: row.damageCount,
      photoCount: row.photoCount,
      signedAt: row.signedAt === null ? null : row.signedAt.toISOString(),
      archivedAt: row.archivedAt === null ? null : row.archivedAt.toISOString(),
      draftStep: row.draftStep,
      photosPending: pendingPhotoCount(row.photosExpected, row.photoCount),
    }))

    return { items, total: totalRow?.value ?? 0 }
  }

  /**
   * KPI cards: signed orders only, so a half-entered intake never inflates "Primljeno" — and never
   * archived ones, or archiving a row would leave the number above it unchanged and the screen
   * would contradict itself in one viewport. These are always the working list's numbers; the
   * cards take no view.
   */
  async summary(scope: IntakeOrdersListScope): Promise<IntakeOrderSummary> {
    const conditions = [isNotNull(intakeOrders.signedAt), isNull(intakeOrders.archivedAt)]
    if (scope.type === 'own') {
      conditions.push(eq(intakeOrders.technicianId, scope.userId))
    }

    const rows = await this.db
      .select({ status: intakeOrders.status, value: count() })
      .from(intakeOrders)
      .where(and(...conditions))
      .groupBy(intakeOrders.status)

    const byStatus = new Map(rows.map((row) => [row.status, row.value]))

    return {
      primljeno: byStatus.get(IntakeOrderStatus.Received) ?? 0,
      uRadu: byStatus.get(IntakeOrderStatus.InProgress) ?? 0,
      gotovo: byStatus.get(IntakeOrderStatus.Done) ?? 0,
      preuzeto: byStatus.get(IntakeOrderStatus.PickedUp) ?? 0,
    }
  }

  async create(input: IntakeOrderCreateInput, technicianId: string): Promise<IntakeOrderDetail> {
    const [created] = await this.db
      .insert(intakeOrders)
      .values({
        orderNumber: input.orderNumber.trim(),
        orderNumberKey: normalizeOrderNumberKey(input.orderNumber),
        technicianId,
        vehicleType: input.vehicleType,
        plate: input.plate.trim(),
        plateKey: normalizePlateKey(input.plate),
        vehicle: input.vehicle,
        vin: input.vin ?? null,
        mileage: input.mileage ?? null,
        arrivalMode: input.arrivalMode,
        ownerName: input.ownerName,
        ...(input.ownerType === undefined ? {} : { ownerType: input.ownerType }),
        ownerIdNumber: input.ownerIdNumber ?? null,
        ownerEmail: input.ownerEmail ?? null,
        ownerAddress: input.ownerAddress ?? null,
        ownerPhone: input.ownerPhone,
        ownerRemarks: input.ownerRemarks ?? null,
        checklist: EMPTY_CHECKLIST,
        damages: [],
        services: [],
        materials: [],
        draftStep: 1,
      })
      .returning({ id: intakeOrders.id })

    if (!created) {
      throw new Error('[intake-orders] insert returned no row')
    }

    const detail = await this.findById(created.id)
    if (detail === null) {
      throw new Error('[intake-orders] created order not found')
    }
    return detail
  }

  async update(id: string, patch: IntakeOrderUpdateInput): Promise<IntakeOrderDetail | null> {
    const values: Record<string, unknown> = {}

    if (patch.orderNumber !== undefined) {
      values['orderNumber'] = patch.orderNumber.trim()
      values['orderNumberKey'] = normalizeOrderNumberKey(patch.orderNumber)
    }
    if (patch.plate !== undefined) {
      values['plate'] = patch.plate.trim()
      values['plateKey'] = normalizePlateKey(patch.plate)
    }
    if (patch.vehicleType !== undefined) values['vehicleType'] = patch.vehicleType
    if (patch.vehicle !== undefined) values['vehicle'] = patch.vehicle
    if (patch.vin !== undefined) values['vin'] = patch.vin
    if (patch.mileage !== undefined) values['mileage'] = patch.mileage
    if (patch.arrivalMode !== undefined) values['arrivalMode'] = patch.arrivalMode
    if (patch.ownerName !== undefined) values['ownerName'] = patch.ownerName
    if (patch.ownerAddress !== undefined) values['ownerAddress'] = patch.ownerAddress
    if (patch.ownerPhone !== undefined) values['ownerPhone'] = patch.ownerPhone
    if (patch.contactPhone !== undefined) values['contactPhone'] = patch.contactPhone
    if (patch.ownerRemarks !== undefined) values['ownerRemarks'] = patch.ownerRemarks
    if (patch.fuelLevel !== undefined) values['fuelLevel'] = patch.fuelLevel
    if (patch.ownerType !== undefined) values['ownerType'] = patch.ownerType
    if (patch.ownerIdNumber !== undefined) values['ownerIdNumber'] = patch.ownerIdNumber
    if (patch.ownerEmail !== undefined) values['ownerEmail'] = patch.ownerEmail
    if (patch.checklist !== undefined) values['checklist'] = patch.checklist
    if (patch.extraChecklist !== undefined) values['extraChecklist'] = patch.extraChecklist
    if (patch.extraDamages !== undefined) values['extraDamages'] = patch.extraDamages
    if (patch.equipmentNote !== undefined) values['equipmentNote'] = patch.equipmentNote
    if (patch.damages !== undefined) values['damages'] = patch.damages
    if (patch.services !== undefined) values['services'] = patch.services
    if (patch.materials !== undefined) values['materials'] = patch.materials
    if (patch.draftStep !== undefined) values['draftStep'] = patch.draftStep

    await this.db.transaction(async (tx) => {
      await tx.update(intakeOrders).set(values).where(eq(intakeOrders.id, id))

      // Removing a damage must not destroy its evidence — the photos stay and only lose their
      // number (docs/25 §3.4). Left alone, `intake_damage_id` would point at an id no longer in
      // the jsonb array; the badge happens to render as a general photo, but the row is a lie and
      // any later reader has to be defensive about it. Same transaction as the damage write, so
      // the two can never disagree.
      if (patch.damages !== undefined) {
        const surviving = patch.damages.map((damage) => damage.id)
        await tx
          .update(attachments)
          .set({ intakeDamageId: null })
          .where(
            and(
              eq(attachments.intakeOrderId, id),
              isNotNull(attachments.intakeDamageId),
              // `notInArray` with an empty list is a Drizzle footgun; deleting every damage is
              // exactly the case that reaches it.
              surviving.length === 0
                ? undefined
                : notInArray(attachments.intakeDamageId, surviving),
            ),
          )
      }
    })

    return this.findById(id)
  }

  /**
   * `setDocument` and `setDocumentEmailedAt` below cannot read `DOCUMENT_COLUMNS` the way
   * `findDocument` does: Drizzle's `.set()` only accepts an object literal keyed by the table's own
   * TS field names, and Postgres itself rejects a table-qualified column in an UPDATE ... SET target
   * — so a column reference pulled out of the map has nowhere valid to go on the write side. Two
   * literal branches, kept side by side, is the boring and type-safe answer; do not "fix" this into
   * a map read.
   *
   * What the sealed document is and where it lives. A row of its own rather than a field on the
   * patch path: `update` refuses everything `freeFieldsFor` does not name on a signed order, and
   * this is written precisely BECAUSE the order was signed. Routing it through the patch would mean
   * either an exception in that guard or a hole in it.
   */
  async setDocument(
    id: string,
    kind: IntakeDocumentKind,
    document: { storagePath: string; sha256: string },
  ): Promise<void> {
    await this.db
      .update(intakeOrders)
      .set(
        kind === 'intake'
          ? { documentStoragePath: document.storagePath, documentSha256: document.sha256 }
          : {
              handoverDocumentStoragePath: document.storagePath,
              handoverDocumentSha256: document.sha256,
            },
      )
      .where(eq(intakeOrders.id, id))
  }

  /**
   * When the sealed sheet reached the owner. Its own write, like the seal beside it. Same reason as
   * `setDocument` above for the literal branch instead of a `DOCUMENT_COLUMNS` read.
   */
  async setDocumentEmailedAt(id: string, kind: IntakeDocumentKind, at: Date): Promise<void> {
    await this.db
      .update(intakeOrders)
      .set(kind === 'intake' ? { documentEmailedAt: at } : { handoverDocumentEmailedAt: at })
      .where(eq(intakeOrders.id, id))
  }

  /**
   * The document's own row, read without the actor's scope — the caller has already established who
   * may see this order. `signedAt` travels with it because an unsigned order has no document to
   * make (it is now the signature of the SAME kind), and `orderNumber` because the file the office
   * downloads is named after the paper.
   */
  async findDocument(
    id: string,
    kind: IntakeDocumentKind,
  ): Promise<{
    orderNumber: string
    signedAt: Date | null
    ownerEmail: string | null
    storagePath: string | null
    sha256: string | null
    emailedAt: Date | null
  } | null> {
    const columns = DOCUMENT_COLUMNS[kind]
    const [row] = await this.db
      .select({
        orderNumber: intakeOrders.orderNumber,
        signedAt: columns.signedAt,
        // Where it goes. Deliberately absent from the printed sheet — an address is how to reach the
        // owner, not a fact about the handover — but it is what this row exists to answer.
        ownerEmail: intakeOrders.ownerEmail,
        storagePath: columns.storagePath,
        sha256: columns.sha256,
        emailedAt: columns.emailedAt,
      })
      .from(intakeOrders)
      .where(eq(intakeOrders.id, id))
      .limit(1)

    return row ?? null
  }

  async sign(id: string, input: IntakeOrderSignInput): Promise<IntakeOrderDetail | null> {
    await this.db
      .update(intakeOrders)
      .set({
        technicianSignature: input.technicianSignature,
        ownerSignature: input.ownerSignature,
        photosExpected: input.photosExpected,
        signedAt: new Date(),
        draftStep: null,
      })
      .where(eq(intakeOrders.id, id))

    return this.findById(id)
  }

  /**
   * The vehicle leaves: both signatures, who gave it back, when, and the status — one `UPDATE`.
   *
   * One statement and not four, because these five facts are one event. Written separately, a
   * failure between them would leave an order signed for by an owner who is standing outside with
   * his car while the record still says it is in the shop.
   *
   * `technicianId` is the CALLER's, handed down by the service from the session. It is a parameter
   * rather than part of `input` so that no request body can ever reach this column.
   */
  async handOver(
    id: string,
    input: IntakeOrderHandoverInput,
    technicianId: string,
  ): Promise<IntakeOrderDetail | null> {
    await this.db
      .update(intakeOrders)
      .set({
        handoverTechnicianSignature: input.technicianSignature,
        handoverOwnerSignature: input.ownerSignature,
        handoverTechnicianId: technicianId,
        handoverSignedAt: new Date(),
        status: IntakeOrderStatus.PickedUp,
      })
      .where(eq(intakeOrders.id, id))

    return this.findById(id)
  }

  async setStatus(id: string, status: string): Promise<IntakeOrderDetail | null> {
    await this.db
      .update(intakeOrders)
      .set({ status: status as IntakeOrderDetail['status'] })
      .where(eq(intakeOrders.id, id))

    return this.findById(id)
  }

  async insertPhoto(values: {
    orderId: string
    damageId: string | null
    fileName: string
    storagePath: string
    mimeType: string
    fileSizeBytes: number
    contentSha256: string
    width: number | null
    height: number | null
    thumbnailPath: string | null
    uploadedBy: string
  }): Promise<IntakeOrderPhoto> {
    const [row] = await this.db
      .insert(attachments)
      .values({
        intakeOrderId: values.orderId,
        intakeDamageId: values.damageId,
        fileName: values.fileName,
        storagePath: values.storagePath,
        mimeType: values.mimeType,
        fileSizeBytes: values.fileSizeBytes,
        contentSha256: values.contentSha256,
        width: values.width,
        height: values.height,
        thumbnailPath: values.thumbnailPath,
        uploadedBy: values.uploadedBy,
      })
      .returning({
        id: attachments.id,
        fileName: attachments.fileName,
        mimeType: attachments.mimeType,
        fileSizeBytes: attachments.fileSizeBytes,
        width: attachments.width,
        height: attachments.height,
        thumbnailPath: attachments.thumbnailPath,
        caption: attachments.caption,
        damageId: attachments.intakeDamageId,
        uploadedAt: attachments.uploadedAt,
      })

    if (!row) {
      throw new Error('[intake-orders] photo insert returned no row')
    }
    return mapPhotoRow(row)
  }

  /** One photo of one order — the order id is part of the lookup so a foreign id cannot match. */
  async findPhoto(
    orderId: string,
    attachmentId: string,
  ): Promise<{
    id: string
    fileName: string
    mimeType: string
    storagePath: string
    thumbnailPath: string | null
    contentSha256: string | null
  } | null> {
    const [row] = await this.db
      .select({
        id: attachments.id,
        fileName: attachments.fileName,
        mimeType: attachments.mimeType,
        storagePath: attachments.storagePath,
        thumbnailPath: attachments.thumbnailPath,
        contentSha256: attachments.contentSha256,
      })
      .from(attachments)
      .where(
        and(
          eq(attachments.id, attachmentId),
          eq(attachments.intakeOrderId, orderId),
          isNull(attachments.deletedAt),
        ),
      )
      .limit(1)

    return row ?? null
  }

  /**
   * Soft delete. The stored bytes stay on purpose: an intake photo is evidence, and a row that is
   * gone from the screen is enough — deleting objects would also mean a database-only restore
   * points at files the bucket no longer holds (docs/11).
   */
  async softDeletePhoto(orderId: string, attachmentId: string): Promise<void> {
    await this.db
      .update(attachments)
      .set({ deletedAt: new Date() })
      .where(and(eq(attachments.id, attachmentId), eq(attachments.intakeOrderId, orderId)))
  }

  /**
   * The order's history, projected down to what a serviser and the office may see. The audit rows
   * themselves carry the actor's IP, their user agent and a whole before/after object with the
   * signature paths in it — none of that leaves this method.
   */
  async listHistory(orderId: string): Promise<IntakeOrderHistoryEntry[]> {
    const rows = await this.db
      .select({
        id: auditLog.id,
        createdAt: auditLog.createdAt,
        action: auditLog.action,
        changes: auditLog.changes,
        actorName: users.name,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .where(
        and(
          eq(auditLog.entityType, 'intake_order'),
          eq(auditLog.entityId, orderId),
          // The intake being filled in is not a change TO the intake: the wizard's own step
          // patches carry no transition, and a photo that arrives or is retaken before the
          // signature is the same intake still in progress. Keyed on the transition, not the
          // action — a photo removal audits as Delete, so "keep every delete" would keep it.
          // COALESCE is load-bearing: the `create` row has no `transition` key at all, so a
          // bare `->>'transition' IN (...)` reads SQL NULL there — NULL OR FALSE is NULL in
          // three-valued logic, and a WHERE clause drops a NULL row exactly like a FALSE one,
          // silently erasing every order's own creation from its history.
          sql`NOT (
            COALESCE(${auditLog.changes}->>'transition', '') IN ('photo_uploaded', 'photo_removed')
            OR (${auditLog.action} = 'update' AND ${auditLog.changes}->>'transition' IS NULL)
          )`,
        ),
      )
      .orderBy(desc(auditLog.createdAt))

    return rows.map((row) => {
      const changes = (row.changes ?? {}) as {
        transition?: unknown
        before?: { status?: unknown }
        after?: { status?: unknown }
      }
      const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)

      return {
        id: row.id,
        at: row.createdAt.toISOString(),
        action: row.action,
        transition: text(changes.transition),
        actorName: row.actorName ?? null,
        fromStatus: text(changes.before?.status),
        toStatus: text(changes.after?.status),
      }
    })
  }

  /**
   * An abandoned draft is really deleted — that is what `ODUSTANI` means, and it releases
   * the order number for the pad's next sheet.
   */
  /**
   * The order's current quote, or null. One per order by construction: attaching a new one
   * soft-deletes the old, so this is a `limit(1)` over what is left rather than a "latest" guess.
   */
  async findQuote(orderId: string): Promise<IntakeOrderQuote | null> {
    const [row] = await this.db
      .select({
        id: attachments.id,
        fileName: attachments.fileName,
        mimeType: attachments.mimeType,
        fileSizeBytes: attachments.fileSizeBytes,
        uploadedAt: attachments.uploadedAt,
        uploadedByName: users.name,
      })
      .from(attachments)
      .leftJoin(users, eq(users.id, attachments.uploadedBy))
      .where(
        and(
          eq(attachments.intakeOrderId, orderId),
          eq(attachments.purpose, AttachmentPurpose.IntakeQuote),
          isNull(attachments.deletedAt),
        ),
      )
      .orderBy(desc(attachments.uploadedAt))
      .limit(1)

    if (row === undefined) {
      return null
    }

    return {
      id: row.id,
      fileName: row.fileName,
      mimeType: row.mimeType,
      fileSizeBytes: Number(row.fileSizeBytes),
      uploadedAt: row.uploadedAt.toISOString(),
      uploadedByName: row.uploadedByName,
    }
  }

  /**
   * The bytes behind the quote — for the download and for the email. Separate from `findQuote`
   * because the storage path is not the client's business and never crosses the wire, exactly as
   * `findDocument` keeps the sealed papers' paths on this side.
   */
  async findQuoteFile(
    orderId: string,
  ): Promise<{ storagePath: string; fileName: string; mimeType: string } | null> {
    const [row] = await this.db
      .select({
        storagePath: attachments.storagePath,
        fileName: attachments.fileName,
        mimeType: attachments.mimeType,
      })
      .from(attachments)
      .where(
        and(
          eq(attachments.intakeOrderId, orderId),
          eq(attachments.purpose, AttachmentPurpose.IntakeQuote),
          isNull(attachments.deletedAt),
        ),
      )
      .orderBy(desc(attachments.uploadedAt))
      .limit(1)

    return row ?? null
  }

  /** Attaching a new quote replaces the current one; the old row stays, soft-deleted. */
  async replaceQuote(values: {
    orderId: string
    fileName: string
    storagePath: string
    mimeType: string
    fileSizeBytes: number
    contentSha256: string
    uploadedBy: string
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(attachments)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(attachments.intakeOrderId, values.orderId),
            eq(attachments.purpose, AttachmentPurpose.IntakeQuote),
            isNull(attachments.deletedAt),
          ),
        )

      await tx.insert(attachments).values({
        intakeOrderId: values.orderId,
        purpose: AttachmentPurpose.IntakeQuote,
        fileName: values.fileName,
        storagePath: values.storagePath,
        mimeType: values.mimeType,
        fileSizeBytes: values.fileSizeBytes,
        contentSha256: values.contentSha256,
        uploadedBy: values.uploadedBy,
      })
    })
  }

  /** Soft delete, like a photo: the bytes stay, the row stops being the order's quote. */
  async removeQuote(orderId: string): Promise<void> {
    await this.db
      .update(attachments)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(attachments.intakeOrderId, orderId),
          eq(attachments.purpose, AttachmentPurpose.IntakeQuote),
          isNull(attachments.deletedAt),
        ),
      )
  }

  /**
   * Out of the working list, or back into it. One UPDATE, both columns together — an `archived_at`
   * without an `archived_by` would be a change with nobody's name on it.
   */
  async setArchived(id: string, archived: boolean, actorId: string): Promise<void> {
    await this.db
      .update(intakeOrders)
      .set(
        archived
          ? { archivedAt: new Date(), archivedBy: actorId }
          : { archivedAt: null, archivedBy: null },
      )
      .where(eq(intakeOrders.id, id))
  }

  async hardDelete(id: string): Promise<void> {
    await this.db.delete(intakeOrders).where(eq(intakeOrders.id, id))
  }

  /**
   * Who holds this order number, if anyone. Returns the row's owner and progress so the
   * service can decide between "resume", "open it" and "pick another number".
   */
  async findByNumberKey(numberKey: string): Promise<{
    id: string
    technicianId: string
    technicianName: string | null
    draftStep: number | null
    signedAt: Date | null
    vehicle: string
    plate: string
  } | null> {
    const [row] = await this.db
      .select({
        id: intakeOrders.id,
        technicianId: intakeOrders.technicianId,
        technicianName: users.name,
        draftStep: intakeOrders.draftStep,
        signedAt: intakeOrders.signedAt,
        vehicle: intakeOrders.vehicle,
        plate: intakeOrders.plate,
      })
      .from(intakeOrders)
      .leftJoin(users, eq(users.id, intakeOrders.technicianId))
      .where(eq(intakeOrders.orderNumberKey, numberKey))
      .limit(1)

    return row ?? null
  }

  /** The most recent signed intake for this plate — what "vozilo prepoznato" offers. */
  async lookupByPlate(plateKey: string): Promise<IntakePlateLookupResponse['match']> {
    const [row] = await this.db
      .select({
        orderId: intakeOrders.id,
        orderNumber: intakeOrders.orderNumber,
        receivedAt: intakeOrders.receivedAt,
        vehicleType: intakeOrders.vehicleType,
        vehicle: intakeOrders.vehicle,
        vin: intakeOrders.vin,
        ownerName: intakeOrders.ownerName,
        ownerAddress: intakeOrders.ownerAddress,
        ownerPhone: intakeOrders.ownerPhone,
      })
      .from(intakeOrders)
      .where(and(eq(intakeOrders.plateKey, plateKey), isNotNull(intakeOrders.signedAt)))
      .orderBy(desc(intakeOrders.receivedAt))
      .limit(1)

    if (!row) {
      return null
    }

    return {
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      receivedAt: row.receivedAt.toISOString(),
      vehicleType: row.vehicleType as NonNullable<
        IntakePlateLookupResponse['match']
      >['vehicleType'],
      vehicle: row.vehicle,
      vin: row.vin,
      ownerName: row.ownerName,
      ownerAddress: row.ownerAddress,
      ownerPhone: row.ownerPhone,
    }
  }
}
