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

export interface IntakeDraftBuffer {
  orderId: string | null
  step: number
  values: IntakeWizardValues
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
    return parsed as IntakeDraftBuffer
  } catch {
    // A corrupt buffer must never block a new intake — the customer is standing there.
    return null
  }
}

export function writeIntakeDraft(draft: IntakeDraftBuffer): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(INTAKE_DRAFT_STORAGE_KEY, JSON.stringify(draft))
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
