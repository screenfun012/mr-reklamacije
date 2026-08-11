import { m, type Locale } from '@mr/i18n'
import { INTAKE_CHECKLIST_KEYS, type IntakeOrderDetail } from '@mr/shared'

import {
  INTAKE_ARRIVAL_MODE_LABELS,
  INTAKE_CHECKLIST_LABELS,
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

function checklistRow(
  key: (typeof INTAKE_CHECKLIST_KEYS)[number],
  value: boolean | null,
  locale: IntakePrintLocale,
): IntakePrintChecklistRow {
  const label = INTAKE_CHECKLIST_LABELS[key]({}, { locale })
  if (value === true) {
    return { key, label, mark: '✓', muted: false }
  }
  if (value === false) {
    return { key, label, mark: '✗', muted: true }
  }
  return { key, label, mark: DASH, muted: true }
}

function clipRemarks(value: string | null, locale: IntakePrintLocale): string {
  if (value === null || value.trim().length === 0) {
    return m.intake_print_no_remarks({}, { locale })
  }
  const trimmed = value.trim()
  return trimmed.length <= PRINT_MAX_REMARKS ? trimmed : `${trimmed.slice(0, PRINT_MAX_REMARKS)}…`
}

/**
 * Everything the sheet draws, already cut to size. Built from the order alone: the print has its
 * own typographic scale and a white background, so it never reads the screen's components.
 */
export function buildIntakePrintModel(
  order: IntakeOrderDetail,
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
    checklist: INTAKE_CHECKLIST_KEYS.map((key) => checklistRow(key, order.checklist[key], locale)),
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
