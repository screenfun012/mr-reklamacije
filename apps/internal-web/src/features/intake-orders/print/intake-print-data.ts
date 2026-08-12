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
/**
 * How many written-in defects the sheet carries.
 *
 * MEASURED in print media, 2026-08-12, against the fullest page this sheet can hold — 12 markers,
 * 4 written-in equipment rows, a maximal owner remark, 5 services, 5 materials — with every row at
 * the field's own 80-character ceiling: three rows fit, and the footer with both signatures stayed
 * on page one.
 *
 * Two things were tried first and killed by measurement, both worth not repeating:
 *   · a CHARACTER budget — 20 rows of 35 characters is the same 700 characters as 4 rows of 200,
 *     and only 8 of them fit. The page's cost is wrapped lines, which no simple formula predicts.
 *   · rows at 200 characters (what the schema allowed until this measurement) — only two fit, so
 *     the field itself was cut to 80. See `IntakeExtraDamagesSchema`.
 *
 * ⚠ The footer is `mt-auto`, so `scrollHeight === offsetHeight` holds WHENEVER the page fits: the
 * comparison is binary and can never report headroom. A ceiling here can only be found by walking
 * to the edge, never read off a margin.
 */
export const PRINT_MAX_OTHER_DAMAGES = 3
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
  /** Null when the serviser wrote nothing — the band then shows only its rows. */
  equipmentNote: string | null
  /** Defects with no place on the drawing, already cut to what the page holds. */
  otherDamages: string[]
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

/**
 * Same length ceiling as the remarks, but empty stays EMPTY rather than becoming a placeholder: an
 * absent note prints nothing at all, while "no remarks" is a statement the remarks box has to make.
 */
function clipEquipmentNote(value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length <= PRINT_MAX_REMARKS ? trimmed : `${trimmed.slice(0, PRINT_MAX_REMARKS)}…`
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
  const otherDamages = order.extraDamages.slice(0, PRINT_MAX_OTHER_DAMAGES)
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
    /**
     * Catalog rows first, then the ones the serviser wrote in — the same order step 2 and the
     * detail show, so the paper in the customer's hand matches the screen it came from. A
     * written-in row prints through the SAME three-state map: untouched is `—`, never `✗`.
     */
    checklist: [
      ...resolveIntakeChecklistRows(order.checklist, checklistItems, locale),
      ...order.extraChecklist.map((row, index) => ({
        code: `extra-${index}`,
        name: row.name,
        value: row.value,
      })),
    ].map(printChecklistRow),
    equipmentNote: clipEquipmentNote(order.equipmentNote),
    otherDamages: otherDamages,
    fuelLevel: order.fuelLevel,
    // Markers PLUS the ones with no place on the drawing: the figure the customer reads first must
    // never disagree with the list under it.
    damageCount: order.damages.length + order.extraDamages.length,
    photoCount: order.photos.length,
    ownerRemarks: clipRemarks(order.ownerRemarks, locale),
    damages,
    /**
     * ONE number for both lists. The sentence tells the customer how many defects did not fit on
     * the page, not which of our two lists they were in — that distinction is ours, not his.
     */
    damagesOverflow:
      order.damages.length - damages.length + (order.extraDamages.length - otherDamages.length),
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
