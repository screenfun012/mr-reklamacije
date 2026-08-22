import {
  IntakeArrivalMode,
  IntakeOwnerType,
  IntakeVehicleType,
  type IntakeChecklistItemListItem,
  type IntakeDamage,
  type IntakeExtraChecklist,
  type IntakeExtraDamages,
  type IntakeOrderCreateInput,
  type IntakeOrderDetail,
  type IntakeOrderUpdateInput,
} from '@mr/shared'

import { untouchedIntakeChecklist, type IntakeChecklistByCode } from '@mr/intake-document'

/**
 * The steps, by name. They were bare numbers scattered through the wizard until 2026-08-10, when
 * removing one of them meant hunting `step === 4` and `step === 5` across two hundred lines and
 * guessing which four was which. Renumbering is now a change here and nowhere else.
 *
 * Step 4 used to be Specifikacija. It is gone from the wizard: services and materials are the
 * serviser's work, not the receiving worker's, and the intake ends when the two signatures are in
 * (Nikola, 2026-08-10). The list itself lives on in the detail's Specifikacija tab.
 */
export const INTAKE_WIZARD_STEPS = {
  Vehicle: 1,
  Checklist: 2,
  Damage: 3,
  Signatures: 4,
} as const

export const INTAKE_WIZARD_STEP_COUNT = INTAKE_WIZARD_STEPS.Signatures

/**
 * The step to PRINT for a stored draft. The column still allows 1..5 from the wizard's earlier
 * shape, and the dev database holds such rows — without this the list says "Nedovršen · 5/4".
 */
export function displayDraftStep(step: number | null): number {
  return Math.min(Math.max(step ?? 1, 1), INTAKE_WIZARD_STEP_COUNT)
}

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
  /** Who is handing the vehicle over — it decides what the identifier below means. */
  ownerType: IntakeOwnerType
  /** ID card for a person, tax number for a firm. Cleared whenever the type changes. */
  ownerIdNumber: string
  ownerEmail: string
  ownerAddress: string
  ownerPhone: string
  ownerRemarks: string
  fuelLevel: number
  /** Keyed by catalog code, so the shop can rename or extend the list without touching this form. */
  checklist: IntakeChecklistByCode
  equipmentNote: string
  /** Array order IS the ①②③ numbering on the map, in the list and on the print. */
  damages: IntakeDamage[]
  /** Rows the shop's lists do not offer, written in on this order alone. */
  extraChecklist: IntakeExtraChecklist
  extraDamages: IntakeExtraDamages
  /** Plain lines, no catalogue, no quantities, no prices — the work order carries none. */
  services: string[]
  materials: string[]
}

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
    ownerType: IntakeOwnerType.Person,
    ownerIdNumber: '',
    ownerEmail: '',
    ownerAddress: '',
    ownerPhone: '',
    ownerRemarks: '',
    fuelLevel: 4,
    // Empty, not eight nulls: which rows an intake records is the shop's catalog to decide, and
    // `toUpdateInput` fills it in from that catalog on the way to the server.
    checklist: {},
    equipmentNote: '',
    damages: [],
    extraChecklist: [],
    extraDamages: [],
    services: [],
    materials: [],
  }
}

/** The step-1 fields DALJE waits for, in the order the form shows them. */
export const INTAKE_STEP1_FIELDS = [
  'orderNumber',
  'plate',
  'vehicle',
  'ownerName',
  'ownerIdNumber',
  'ownerPhone',
] as const

export type IntakeStep1Field = (typeof INTAKE_STEP1_FIELDS)[number]

/**
 * Which of them are still empty — the whole rule, in one place.
 *
 * The footer used to recite a fixed list of four while the button waited on six, so a serviser who
 * had only the ID card left read about the plate and the phone he had already typed. The sentence
 * and the button now read the same answer, which is the only way they cannot drift again.
 */
export function step1Missing(values: IntakeWizardValues): IntakeStep1Field[] {
  return INTAKE_STEP1_FIELDS.filter((field) => {
    switch (field) {
      case 'orderNumber':
        return values.orderNumber.trim().length === 0
      // Two characters, not one: a single letter is always a slip, never a plate.
      case 'plate':
        return values.plate.trim().length < 2
      case 'vehicle':
        return values.vehicle.trim().length === 0
      case 'ownerName':
        return values.ownerName.trim().length === 0
      case 'ownerIdNumber':
        return !ownerIdentityComplete(values)
      case 'ownerPhone':
        return values.ownerPhone.trim().length < 3
    }
  })
}

/** Step 1 cannot be left while anything is missing. */
export function step1Complete(values: IntakeWizardValues): boolean {
  return step1Missing(values).length === 0
}

/**
 * A private person must show an ID card; a firm's tax number is optional.
 *
 * Deliberately a rule of THIS screen and not of the schema: the column is nullable because a firm
 * legitimately has no number and every order taken before 2026-08-12 has none, so a check in the
 * database would have to know the type — which the serviser can change.
 */
export function ownerIdentityComplete(values: IntakeWizardValues): boolean {
  return values.ownerType !== IntakeOwnerType.Person || values.ownerIdNumber.trim().length > 0
}

/** Trims a form field to `undefined` when empty, so an untouched optional field patches as absent. */
export function optionalText(value: string): string | undefined {
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
    ownerType: values.ownerType,
    ownerPhone: values.ownerPhone.trim(),
    ...(optionalText(values.ownerIdNumber) === undefined
      ? {}
      : { ownerIdNumber: optionalText(values.ownerIdNumber) as string }),
    ...(optionalText(values.ownerEmail) === undefined
      ? {}
      : { ownerEmail: optionalText(values.ownerEmail) as string }),
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
export function toUpdateInput(
  values: IntakeWizardValues,
  step: number,
  checklistItems: readonly IntakeChecklistItemListItem[],
): IntakeOrderUpdateInput {
  return {
    orderNumber: values.orderNumber.trim(),
    vehicleType: values.vehicleType,
    plate: values.plate.trim(),
    vehicle: values.vehicle.trim(),
    vin: optionalText(values.vin) ?? null,
    mileage: parsedMileage(values.mileage) ?? null,
    arrivalMode: values.arrivalMode,
    ownerName: values.ownerName.trim(),
    ownerType: values.ownerType,
    ownerIdNumber: optionalText(values.ownerIdNumber) ?? null,
    ownerEmail: optionalText(values.ownerEmail) ?? null,
    ownerAddress: optionalText(values.ownerAddress) ?? null,
    ownerPhone: values.ownerPhone.trim(),
    ownerRemarks: optionalText(values.ownerRemarks) ?? null,
    fuelLevel: values.fuelLevel,
    /**
     * Every item the catalog offers gets a row, ticked or not, and what the serviser actually said
     * wins over it. A row nobody touched has to be recorded, because that is what prints as `—`; a
     * row simply absent from the map prints as nothing and the document loses a line (docs/25 §4.4).
     *
     * No cast any more: the wire type is an open `{code: DA/NE}` map since task 4, so this spread IS
     * the wire type. Every code in it comes from the catalog the API validates against.
     */
    checklist: {
      ...untouchedIntakeChecklist(checklistItems),
      ...values.checklist,
    },
    equipmentNote: optionalText(values.equipmentNote) ?? null,
    damages: values.damages,
    extraChecklist: values.extraChecklist,
    extraDamages: values.extraDamages,
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
    ownerType: order.ownerType,
    ownerIdNumber: order.ownerIdNumber ?? '',
    ownerEmail: order.ownerEmail ?? '',
    ownerAddress: order.ownerAddress ?? '',
    ownerPhone: order.ownerPhone,
    ownerRemarks: order.ownerRemarks ?? '',
    fuelLevel: order.fuelLevel,
    checklist: order.checklist,
    equipmentNote: order.equipmentNote ?? '',
    damages: [...order.damages],
    extraChecklist: [...order.extraChecklist],
    extraDamages: [...order.extraDamages],
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
  /**
   * Who left it here. The tablet is shared between serviseri and holds no session of its own, so
   * without this the next person to open the wizard is offered a colleague's customer — name,
   * phone and address included — which is exactly what the API refuses to serve him.
   */
  savedBy: string
}

function hasOrderNumber(values: IntakeWizardValues): boolean {
  return values.orderNumber.trim().length > 0
}

/**
 * Within one shift of now, in EITHER direction. One-sided arithmetic would read a stamp from the
 * future as negative age, and negative is always inside the window — a tablet whose clock ran ahead
 * would carry a draft that never expires.
 *
 * `Number.isFinite` is not decoration, and not for the shape it looks like: a missing or
 * unparseable stamp already fails the comparison, because `NaN <= x` is false. It earns its place
 * against the two shapes that SURVIVE the arithmetic — a stamp written as a numeric string, which
 * subtraction happily coerces, and one that overflowed to `Infinity` (`JSON.parse` turns `1e999`
 * into exactly that). This is `localStorage`: whoever holds the tablet can write it.
 */
function isFresh(draft: IntakeDraftBuffer): boolean {
  return (
    Number.isFinite(draft.savedAt) &&
    Math.abs(Date.now() - draft.savedAt) <= INTAKE_DRAFT_MAX_AGE_MS
  )
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
 * Worth offering back: it belongs to the person reading it, the offer can name the intake by its
 * order number, and it is not older than a shift. The reader and the writer used to decide this
 * separately — and the writer did not decide at all, so a fresh mount overwrote a real draft with an
 * empty one before the serviser could answer the offer. Both now ask the same module.
 */
function isOfferable(draft: IntakeDraftBuffer, reader: string): boolean {
  return (
    reader.length > 0 && draft.savedBy === reader && hasOrderNumber(draft.values) && isFresh(draft)
  )
}

/**
 * `reader` is the signed-in serviser's email — the only session identity available here
 * synchronously, so it cannot lose a race against hydration and refuse a man his own intake.
 *
 * Reading also EVICTS a draft that has gone stale. That is deliberate: nothing else ever deletes
 * one now that the writer no longer overwrites blindly, and a dead draft is a customer's name,
 * phone and address left on a tablet the whole shop shares. A draft belonging to someone else is
 * refused but NOT evicted — it may be the only copy of his step 1.
 */
export function readIntakeDraft(reader: string): IntakeDraftBuffer | null {
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
    if (!isFresh(draft)) {
      clearIntakeDraft()
      return null
    }
    return isOfferable(draft, reader) ? draft : null
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
