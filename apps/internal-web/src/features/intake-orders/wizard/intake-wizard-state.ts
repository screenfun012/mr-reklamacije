import {
  INTAKE_CHECKLIST_KEYS,
  IntakeArrivalMode,
  IntakeVehicleType,
  type IntakeChecklist,
  type IntakeDamage,
  type IntakeOrderCreateInput,
  type IntakeOrderDetail,
  type IntakeOrderUpdateInput,
} from '@mr/shared'

export const INTAKE_WIZARD_STEP_COUNT = 5

/** Everything the wizard collects, as the form holds it (numbers stay strings while typing). */
export interface IntakeWizardValues {
  orderNumber: string
  vehicleType: IntakeVehicleType
  plate: string
  vehicle: string
  vin: string
  mileage: string
  arrivalMode: IntakeArrivalMode
  ownerName: string
  ownerAddress: string
  ownerPhone: string
  ownerRemarks: string
  fuelLevel: number
  checklist: IntakeChecklist
  equipmentNote: string
  /** Array order IS the ①②③ numbering on the map, in the list and on the print. */
  damages: IntakeDamage[]
  /** Plain lines, no catalogue, no quantities, no prices — the work order carries none. */
  services: string[]
  materials: string[]
}

const EMPTY_CHECKLIST: IntakeChecklist = Object.fromEntries(
  INTAKE_CHECKLIST_KEYS.map((key) => [key, null]),
) as IntakeChecklist

export function emptyIntakeWizardValues(): IntakeWizardValues {
  return {
    orderNumber: '',
    vehicleType: IntakeVehicleType.Car,
    plate: '',
    vehicle: '',
    vin: '',
    mileage: '',
    arrivalMode: IntakeArrivalMode.Driven,
    ownerName: '',
    ownerAddress: '',
    ownerPhone: '',
    ownerRemarks: '',
    fuelLevel: 4,
    checklist: EMPTY_CHECKLIST,
    equipmentNote: '',
    damages: [],
    services: [],
    materials: [],
  }
}

/** Step 1 cannot be left without these — the four the handoff marks plus the order number. */
export function step1Complete(values: IntakeWizardValues): boolean {
  return (
    values.orderNumber.trim().length > 0 &&
    values.plate.trim().length >= 2 &&
    values.vehicle.trim().length > 0 &&
    values.ownerName.trim().length > 0 &&
    values.ownerPhone.trim().length >= 3
  )
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function parsedMileage(value: string): number | undefined {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) {
    return undefined
  }
  return Number(digits)
}

export function toCreateInput(values: IntakeWizardValues): IntakeOrderCreateInput {
  const vin = optionalText(values.vin)
  const address = optionalText(values.ownerAddress)
  const remarks = optionalText(values.ownerRemarks)
  const mileage = parsedMileage(values.mileage)

  return {
    orderNumber: values.orderNumber.trim(),
    vehicleType: values.vehicleType,
    plate: values.plate.trim(),
    vehicle: values.vehicle.trim(),
    arrivalMode: values.arrivalMode,
    ownerName: values.ownerName.trim(),
    ownerPhone: values.ownerPhone.trim(),
    ...(vin !== undefined ? { vin } : {}),
    ...(mileage !== undefined ? { mileage } : {}),
    ...(address !== undefined ? { ownerAddress: address } : {}),
    ...(remarks !== undefined ? { ownerRemarks: remarks } : {}),
  }
}

/**
 * What the server needs after a step. Sends the whole known state rather than a diff: the
 * payload is a couple of kilobytes and a diff would need the wizard to track what changed
 * across a tablet sleeping mid-intake.
 */
export function toUpdateInput(values: IntakeWizardValues, step: number): IntakeOrderUpdateInput {
  return {
    orderNumber: values.orderNumber.trim(),
    vehicleType: values.vehicleType,
    plate: values.plate.trim(),
    vehicle: values.vehicle.trim(),
    vin: optionalText(values.vin) ?? null,
    mileage: parsedMileage(values.mileage) ?? null,
    arrivalMode: values.arrivalMode,
    ownerName: values.ownerName.trim(),
    ownerAddress: optionalText(values.ownerAddress) ?? null,
    ownerPhone: values.ownerPhone.trim(),
    ownerRemarks: optionalText(values.ownerRemarks) ?? null,
    fuelLevel: values.fuelLevel,
    checklist: values.checklist,
    equipmentNote: optionalText(values.equipmentNote) ?? null,
    damages: values.damages,
    services: values.services,
    materials: values.materials,
    draftStep: Math.min(INTAKE_WIZARD_STEP_COUNT, Math.max(1, step)),
  }
}

/**
 * A marker's stable id. Deliberately NOT `crypto.randomUUID()`: that is gated to secure contexts,
 * and the serviser's tablet reaches the dev server over plain `http://192.168.x.x:3002` on the
 * hall LAN (docs/25 §3.8), where it throws. The id only has to be unique within one intake and
 * only exists so a photo can point at a damage that keeps its identity while the list renumbers.
 */
export function newDamageId(): string {
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/** Rebuilds the form from a server order — resuming on another tablet. */
export function valuesFromOrder(order: IntakeOrderDetail): IntakeWizardValues {
  return {
    orderNumber: order.orderNumber,
    vehicleType: order.vehicleType,
    plate: order.plate,
    vehicle: order.vehicle,
    vin: order.vin ?? '',
    mileage: order.mileage === null ? '' : String(order.mileage),
    arrivalMode: order.arrivalMode,
    ownerName: order.ownerName,
    ownerAddress: order.ownerAddress ?? '',
    ownerPhone: order.ownerPhone,
    ownerRemarks: order.ownerRemarks ?? '',
    fuelLevel: order.fuelLevel,
    checklist: order.checklist,
    equipmentNote: order.equipmentNote ?? '',
    damages: [...order.damages],
    services: [...order.services],
    materials: [...order.materials],
  }
}

/**
 * The tablet-side buffer. The server owns how far the intake got (docs/25 §3.3); this only
 * has to survive a sleeping tablet or a dropped connection between two step patches.
 */
export const INTAKE_DRAFT_STORAGE_KEY = 'mrr:internal:intake-draft'

/**
 * One shift plus the night after it. Past that an offer to resume is not help: the car has left,
 * and on a tablet several serviseri share, the draft most likely belongs to the shift before.
 */
export const INTAKE_DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000

export interface IntakeDraftBuffer {
  orderId: string | null
  step: number
  values: IntakeWizardValues
  /** Stamped by `writeIntakeDraft` itself, so no caller can forget it. */
  savedAt: number
}

function hasOrderNumber(values: IntakeWizardValues): boolean {
  return values.orderNumber.trim().length > 0
}

/**
 * Worth keeping while the server already backs the intake, or while it could still be offered back.
 * Deliberately WIDER than `isOfferable`: the order-number field is live on every step, so blanking
 * it mid-intake must not freeze the buffer on a snapshot the serviser has since moved past — a
 * frozen snapshot resumed later writes stale damage markers over newer ones.
 */
function isWorthKeeping(draft: Omit<IntakeDraftBuffer, 'savedAt'>): boolean {
  return draft.orderId !== null || hasOrderNumber(draft.values)
}

/**
 * Worth offering back: the offer names the intake by its order number, and a draft older than a
 * shift is not an offer but a trap. The reader and the writer used to decide this separately — and
 * the writer did not decide at all, so a fresh mount overwrote a real draft with an empty one before
 * the serviser could answer the offer. Both now ask the same module, so they cannot disagree again.
 *
 * `Number.isFinite` earns its place against ONE shape, and it is not the obvious one: a missing or
 * unparseable stamp already fails the comparison below, because `NaN <= x` is false. What slips
 * through is a stamp written as a NUMERIC STRING, which the subtraction happily coerces. This is
 * `localStorage`, writable by whoever holds the tablet, so a stamp that is not a number is treated
 * like every other shape that is not ours. (Phrase the comparison the other way round — as an
 * is-expired test — and `NaN` inverts into "fresh"; it is written positively for that reason.)
 */
function isOfferable(draft: IntakeDraftBuffer): boolean {
  return (
    hasOrderNumber(draft.values) &&
    Number.isFinite(draft.savedAt) &&
    Date.now() - draft.savedAt <= INTAKE_DRAFT_MAX_AGE_MS
  )
}

export function readIntakeDraft(): IntakeDraftBuffer | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(INTAKE_DRAFT_STORAGE_KEY)
    if (raw === null) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || !('values' in parsed)) {
      return null
    }
    // Inside the try on purpose: the check above still lets through a `values` that is null, an
    // empty object or an array (`'values' in []` is true), and `isOfferable` reads into it. Out
    // here that throw would escape into the wizard's mount effect, which has no try of its own,
    // and take the whole screen down — with the customer standing at the car.
    const draft = parsed as IntakeDraftBuffer
    return isOfferable(draft) ? draft : null
  } catch {
    // A corrupt buffer must never block a new intake — the customer is standing there.
    return null
  }
}

export function writeIntakeDraft(draft: Omit<IntakeDraftBuffer, 'savedAt'>): void {
  if (typeof window === 'undefined') {
    return
  }
  if (!isWorthKeeping(draft)) {
    return
  }
  const stamped: IntakeDraftBuffer = { ...draft, savedAt: Date.now() }
  try {
    window.localStorage.setItem(INTAKE_DRAFT_STORAGE_KEY, JSON.stringify(stamped))
  } catch {
    // Private mode or a full quota: the server copy is the one that matters.
  }
}

export function clearIntakeDraft(): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(INTAKE_DRAFT_STORAGE_KEY)
}
