import { IntakeOrderStatus, type IntakeChecklist, type IntakeDamage } from '@mr/shared'
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
import { alias } from 'drizzle-orm/pg-core'

import type { ApiDatabase } from '../../core/database.js'
import { attachments, intakeOrders, users } from './intake-orders.schema.js'
import type { IntakeOrdersListScope } from './intake-orders.types.js'
import type {
  IntakeOrderCreateInput,
  IntakeOrderDetail,
  IntakeOrderListItem,
  IntakeOrderListQuery,
  IntakeOrderPhoto,
  IntakeOrderSignInput,
  IntakeOrderSummary,
  IntakeOrderUpdateInput,
  IntakePlateLookupResponse,
} from './intake-orders.validators.js'

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

const EMPTY_CHECKLIST: IntakeChecklist = {
  rezervna: null,
  dizalica: null,
  komplet: null,
  saobracajna: null,
  vozacka: null,
  prvaPomoc: null,
  prsluk: null,
  lanci: null,
}

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
  ownerAddress: string | null
  ownerPhone: string
  ownerRemarks: string | null
  fuelLevel: number
  checklist: IntakeChecklist | null
  equipmentNote: string | null
  damages: IntakeDamage[] | null
  services: string[] | null
  materials: string[] | null
  draftStep: number | null
  photosExpected: number | null
  technicianSignature: string | null
  ownerSignature: string | null
  signedAt: Date | null
  amendedAt: Date | null
  amendedByName: string | null
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

function mapDetail(row: OrderRow, photos: IntakeOrderPhoto[]): IntakeOrderDetail {
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
    ownerAddress: row.ownerAddress,
    ownerPhone: row.ownerPhone,
    ownerRemarks: row.ownerRemarks,
    fuelLevel: row.fuelLevel,
    checklist: row.checklist ?? EMPTY_CHECKLIST,
    equipmentNote: row.equipmentNote,
    damages: row.damages ?? [],
    services: row.services ?? [],
    materials: row.materials ?? [],
    draftStep: row.draftStep,
    technicianSignature: row.technicianSignature,
    ownerSignature: row.ownerSignature,
    signedAt: row.signedAt === null ? null : row.signedAt.toISOString(),
    amendedAt: row.amendedAt === null ? null : row.amendedAt.toISOString(),
    amendedByName: row.amendedByName,
    photosPending: pendingPhotoCount(row.photosExpected, photos.length),
    photos,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Second join onto users: who corrected the intake condition after signing. */
const amender = alias(users, 'amender')

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
      ownerAddress: intakeOrders.ownerAddress,
      ownerPhone: intakeOrders.ownerPhone,
      ownerRemarks: intakeOrders.ownerRemarks,
      fuelLevel: intakeOrders.fuelLevel,
      checklist: intakeOrders.checklist,
      equipmentNote: intakeOrders.equipmentNote,
      damages: intakeOrders.damages,
      services: intakeOrders.services,
      materials: intakeOrders.materials,
      draftStep: intakeOrders.draftStep,
      photosExpected: intakeOrders.photosExpected,
      technicianSignature: intakeOrders.technicianSignature,
      ownerSignature: intakeOrders.ownerSignature,
      signedAt: intakeOrders.signedAt,
      amendedAt: intakeOrders.amendedAt,
      amendedByName: amender.name,
      createdAt: intakeOrders.createdAt,
      updatedAt: intakeOrders.updatedAt,
    }
  }

  async findById(id: string): Promise<IntakeOrderDetail | null> {
    const [row] = await this.db
      .select(this.detailSelection())
      .from(intakeOrders)
      .leftJoin(users, eq(users.id, intakeOrders.technicianId))
      .leftJoin(amender, eq(amender.id, intakeOrders.amendedBy))
      .where(and(eq(intakeOrders.id, id), isNull(intakeOrders.deletedAt)))
      .limit(1)

    if (!row) {
      return null
    }

    const photos = await this.listPhotos(id)
    return mapDetail(row as OrderRow, photos)
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
      .where(and(eq(attachments.intakeOrderId, orderId), isNull(attachments.deletedAt)))
      .orderBy(asc(attachments.uploadedAt))

    return rows.map(mapPhotoRow)
  }

  /**
   * Scope and draft visibility in one predicate: a serviser gets his own rows including
   * unfinished ones, the office gets signed orders unless it asked for the drafts.
   */
  private scopeCondition(scope: IntakeOrdersListScope, unfinished: boolean) {
    const live = isNull(intakeOrders.deletedAt)

    if (scope.type === 'own') {
      return and(live, eq(intakeOrders.technicianId, scope.userId))
    }

    return and(live, unfinished ? isNull(intakeOrders.signedAt) : isNotNull(intakeOrders.signedAt))
  }

  async list(
    scope: IntakeOrdersListScope,
    query: IntakeOrderListQuery,
  ): Promise<{ items: IntakeOrderListItem[]; total: number }> {
    const conditions = [this.scopeCondition(scope, query.unfinished)]

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
          technicianName: users.name,
          damageCount: sql<number>`COALESCE(jsonb_array_length(${intakeOrders.damages}), 0)::int`,
          photoCount,
          signedAt: intakeOrders.signedAt,
          draftStep: intakeOrders.draftStep,
          amendedAt: intakeOrders.amendedAt,
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
      technicianName: row.technicianName ?? '',
      damageCount: row.damageCount,
      photoCount: row.photoCount,
      signedAt: row.signedAt === null ? null : row.signedAt.toISOString(),
      draftStep: row.draftStep,
      amendedAt: row.amendedAt === null ? null : row.amendedAt.toISOString(),
      photosPending: pendingPhotoCount(row.photosExpected, row.photoCount),
    }))

    return { items, total: totalRow?.value ?? 0 }
  }

  /** KPI cards: signed orders only, so a half-entered intake never inflates "Primljeno". */
  async summary(scope: IntakeOrdersListScope): Promise<IntakeOrderSummary> {
    const conditions = [isNull(intakeOrders.deletedAt), isNotNull(intakeOrders.signedAt)]
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

  async update(
    id: string,
    patch: IntakeOrderUpdateInput,
    amendedBy: string | null,
  ): Promise<IntakeOrderDetail | null> {
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
    if (patch.ownerRemarks !== undefined) values['ownerRemarks'] = patch.ownerRemarks
    if (patch.fuelLevel !== undefined) values['fuelLevel'] = patch.fuelLevel
    if (patch.checklist !== undefined) values['checklist'] = patch.checklist
    if (patch.equipmentNote !== undefined) values['equipmentNote'] = patch.equipmentNote
    if (patch.damages !== undefined) values['damages'] = patch.damages
    if (patch.services !== undefined) values['services'] = patch.services
    if (patch.materials !== undefined) values['materials'] = patch.materials
    if (patch.draftStep !== undefined) values['draftStep'] = patch.draftStep

    if (amendedBy !== null) {
      values['amendedAt'] = new Date()
      values['amendedBy'] = amendedBy
    }

    if (Object.keys(values).length === 0) {
      return this.findById(id)
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(intakeOrders)
        .set(values)
        .where(and(eq(intakeOrders.id, id), isNull(intakeOrders.deletedAt)))

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
      .where(and(eq(intakeOrders.id, id), isNull(intakeOrders.deletedAt)))

    return this.findById(id)
  }

  async setStatus(id: string, status: string): Promise<IntakeOrderDetail | null> {
    await this.db
      .update(intakeOrders)
      .set({ status: status as IntakeOrderDetail['status'] })
      .where(and(eq(intakeOrders.id, id), isNull(intakeOrders.deletedAt)))

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

  /** A signed order is evidence: it leaves the list, never the database. */
  async softDelete(id: string): Promise<void> {
    await this.db
      .update(intakeOrders)
      .set({ deletedAt: new Date() })
      .where(and(eq(intakeOrders.id, id), isNull(intakeOrders.deletedAt)))
  }

  /**
   * An abandoned draft is really deleted — that is what `ODUSTANI` means, and it releases
   * the order number for the pad's next sheet.
   */
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
      .where(and(eq(intakeOrders.orderNumberKey, numberKey), isNull(intakeOrders.deletedAt)))
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
      .where(
        and(
          eq(intakeOrders.plateKey, plateKey),
          isNull(intakeOrders.deletedAt),
          isNotNull(intakeOrders.signedAt),
        ),
      )
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
