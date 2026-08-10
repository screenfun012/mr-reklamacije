import { m, type Locale } from '@mr/i18n'
import {
  IntakeDamageType,
  type IntakeArrivalMode,
  type IntakeChecklistKey,
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
 */
export const INTAKE_CHECKLIST_LABELS: Record<IntakeChecklistKey, IntakeLabel> = {
  rezervna: m.intake_checklist_rezervna,
  dizalica: m.intake_checklist_dizalica,
  komplet: m.intake_checklist_komplet,
  saobracajna: m.intake_checklist_saobracajna,
  vozacka: m.intake_checklist_vozacka,
  prvaPomoc: m.intake_checklist_prva_pomoc,
  prsluk: m.intake_checklist_prsluk,
  lanci: m.intake_checklist_lanci,
}

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

export const INTAKE_DAMAGE_TYPE_LABELS: Record<IntakeDamageType, IntakeLabel> = {
  [IntakeDamageType.Scratch]: m.intake_damage_type_ogrebotina,
  [IntakeDamageType.Dent]: m.intake_damage_type_udubljenje,
  [IntakeDamageType.Cracked]: m.intake_damage_type_puknuto,
  [IntakeDamageType.Rust]: m.intake_damage_type_rdja,
}
