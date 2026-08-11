import { m, type Locale } from '@mr/i18n'
import type { IntakeChecklistItemListItem, IntakeOrderDetail } from '@mr/shared'

import { resolveIntakeChecklistRows, type IntakeChecklistRow } from '../intake-checklist-catalog'
import {
  INTAKE_ARRIVAL_MODE_LABELS,
  INTAKE_DAMAGE_TYPE_LABELS,
  INTAKE_VEHICLE_TYPE_LABELS,
} from '../intake-labels'
import { formatIntakeReceivedAtLong } from '../intake-status'
import { INTAKE_SILHOUETTES, type IntakeSilhouettePath } from '../wizard/intake-silhouettes'

/**
 * One A4 page is a rule, not a preference. These are the cuts, and they live here rather than
 * inside the components so that what the customer receives is decided once, in a place a test can
 * interrogate.
 *
 * Photographs are NOT among them: they left the document on 2026-08-10 (Nikola — "to ne mora da
 * stoji, može da stoji koliko slika je slikano"). The count still appears in the figures row and in
 * the legal sentence, which is how the customer knows they exist and where.
 */
export const PRINT_MAX_LIST_ITEMS = 5
export const PRINT_MAX_DAMAGES = 12
export const PRINT_MAX_REMARKS = 180

/**
 * The paper's language, chosen at print time. A foreign customer brings a car in and signs an
 * English work order while the office keeps working in Serbian — so this is an argument, never
 * `getLocale()`, and every message below names it explicitly.
 */
export type IntakePrintLocale = Locale

export interface IntakePrintChecklistRow {
  key: string
  label: string
  mark: '✓' | '✗' | '—'
  /** A "no" and an untouched row print their text grey; a "yes" prints it black. */
  muted: boolean
}

export interface IntakePrintDamageRow {
  id: string
  number: number
  type: string
  zone: string
  x: number
  y: number
}

export interface IntakePrintModel {
  /** Travels with the data, so a block component takes one prop and still resolves its captions. */
  locale: IntakePrintLocale
  orderNumber: string
  receivedAt: string
  ownerName: string
  ownerAddress: string
  ownerPhone: string
  vehicle: string
  plate: string
  vehicleTypeLabel: string
  vin: string
  mileage: string
  arrivalMode: string
  checklist: IntakePrintChecklistRow[]
  fuelLevel: number
  damageCount: number
  photoCount: number
  ownerRemarks: string
  damages: IntakePrintDamageRow[]
  /** How many defects did NOT fit; 0 when all of them did. */
  damagesOverflow: number
  services: string[]
  materials: string[]
  technicianName: string
  technicianSignature: string | null
  ownerSignature: string | null
  silhouette: readonly IntakeSilhouettePath[]
  markers: { x: number; y: number; textY: number; number: number }[]
}

const DASH = '—'

/**
 * The name is already resolved against the catalog by the time it gets here, in the language the
 * paper was asked for — so nothing on this sheet calls a message key for an equipment name any more.
 */
function printChecklistRow(row: IntakeChecklistRow): IntakePrintChecklistRow {
  const shared = { key: row.code, label: row.name }
  if (row.value === true) {
    return { ...shared, mark: '✓', muted: false }
  }
  if (row.value === false) {
    return { ...shared, mark: '✗', muted: true }
  }
  return { ...shared, mark: DASH, muted: true }
}

function clipRemarks(value: string | null, locale: IntakePrintLocale): string {
  if (value === null || value.trim().length === 0) {
    return m.intake_print_no_remarks({}, { locale })
  }
  const trimmed = value.trim()
  return trimmed.length <= PRINT_MAX_REMARKS ? trimmed : `${trimmed.slice(0, PRINT_MAX_REMARKS)}…`
}

/**
 * Everything the sheet draws, already cut to size. Built from the order and the catalog: the print
 * has its own typographic scale and a white background, so it never reads the screen's components.
 *
 * `checklistItems` must be the DISPLAY read of the catalog — deactivated and removed items
 * included. This sheet is what the customer signed, and a row whose item the shop has since retired
 * still has to print with its name (plan D3).
 */
export function buildIntakePrintModel(
  order: IntakeOrderDetail,
  checklistItems: readonly IntakeChecklistItemListItem[],
  locale: IntakePrintLocale,
): IntakePrintModel {
  const damages = order.damages.slice(0, PRINT_MAX_DAMAGES).map((damage, index) => ({
    id: damage.id,
    number: index + 1,
    type: INTAKE_DAMAGE_TYPE_LABELS[damage.type]({}, { locale }),
    zone: damage.zone,
    x: damage.x,
    y: damage.y,
  }))

  return {
    locale,
    orderNumber: order.orderNumber,
    receivedAt: formatIntakeReceivedAtLong(order.receivedAt, locale),
    ownerName: order.ownerName,
    ownerAddress: order.ownerAddress ?? DASH,
    ownerPhone: order.ownerPhone,
    vehicle: order.vehicle,
    plate: order.plate,
    vehicleTypeLabel: INTAKE_VEHICLE_TYPE_LABELS[order.vehicleType]({}, { locale }).toUpperCase(),
    vin: order.vin ?? DASH,
    mileage: order.mileage === null ? DASH : `${order.mileage} km`,
    arrivalMode: INTAKE_ARRIVAL_MODE_LABELS[order.arrivalMode]({}, { locale }).toLowerCase(),
    // The ORDER's own rows, never the catalog's (plan D4): an item added since must not appear on a
    // sheet somebody already signed, and it never had that row.
    checklist: resolveIntakeChecklistRows(order.checklist, checklistItems, locale).map(
      printChecklistRow,
    ),
    fuelLevel: order.fuelLevel,
    damageCount: order.damages.length,
    photoCount: order.photos.length,
    ownerRemarks: clipRemarks(order.ownerRemarks, locale),
    damages,
    damagesOverflow: order.damages.length - damages.length,
    services: order.services.slice(0, PRINT_MAX_LIST_ITEMS),
    materials: order.materials.slice(0, PRINT_MAX_LIST_ITEMS),
    technicianName: order.technicianName,
    technicianSignature: order.technicianSignature,
    ownerSignature: order.ownerSignature,
    silhouette: INTAKE_SILHOUETTES[order.vehicleType],
    markers: damages.map((damage) => ({
      x: damage.x,
      y: damage.y,
      // The digit's baseline sits 6px below the circle's centre (prototype :1388).
      textY: damage.y + 6,
      number: damage.number,
    })),
  }
}
