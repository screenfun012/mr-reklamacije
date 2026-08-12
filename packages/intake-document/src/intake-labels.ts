import { m, type Locale } from '@mr/i18n'
import {
  IntakeDamageType,
  type IntakeArrivalMode,
  type IntakeOwnerType,
  type IntakeVehicleType,
} from '@mr/shared'

/**
 * A message as Paraglide compiles it: callable bare for the screen, or with an explicit locale for
 * the printed work order, which speaks the CUSTOMER's language rather than the operator's — a
 * foreigner may bring the car in. Typing these as `() => string` quietly threw that argument away.
 */
type IntakeLabel = (inputs?: Record<string, never>, options?: { locale?: Locale }) => string

/**
 * Label maps shared by the wizard and the detail. They lived private inside the wizard's
 * components; the detail needs the same words, and a second copy means a rename updates one
 * screen and silently not the other.
 *
 * The equipment checklist is NOT here any more: those names live in the `intake_checklist_items`
 * catalog the shop maintains, so they come from the database and are resolved per code
 * (`intake-checklist-catalog.ts`). A hardcoded map could only ever name the eight items the code
 * shipped with.
 */
export const INTAKE_VEHICLE_TYPE_LABELS: Record<IntakeVehicleType, IntakeLabel> = {
  auto: m.intake_vehicle_type_auto,
  kombi: m.intake_vehicle_type_kombi,
  kamionet: m.intake_vehicle_type_kamionet,
  dzip: m.intake_vehicle_type_dzip,
}

export const INTAKE_ARRIVAL_MODE_LABELS: Record<IntakeArrivalMode, IntakeLabel> = {
  dovezeno: m.intake_arrival_dovezeno,
  doslepano: m.intake_arrival_doslepano,
  dovuceno: m.intake_arrival_dovuceno,
}

export const INTAKE_OWNER_TYPE_LABELS: Record<IntakeOwnerType, IntakeLabel> = {
  fizicko_lice: m.intake_owner_type_fizicko_lice,
  firma: m.intake_owner_type_firma,
}

export const INTAKE_DAMAGE_TYPE_LABELS: Record<IntakeDamageType, IntakeLabel> = {
  [IntakeDamageType.Scratch]: m.intake_damage_type_ogrebotina,
  [IntakeDamageType.Dent]: m.intake_damage_type_udubljenje,
  [IntakeDamageType.Cracked]: m.intake_damage_type_puknuto,
  [IntakeDamageType.Rust]: m.intake_damage_type_rdja,
}
