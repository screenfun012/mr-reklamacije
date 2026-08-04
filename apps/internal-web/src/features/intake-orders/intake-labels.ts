import { m } from '@mr/i18n'
import type { IntakeArrivalMode, IntakeChecklistKey, IntakeVehicleType } from '@mr/shared'

/**
 * Label maps shared by the wizard and the detail. They lived private inside the wizard's
 * components; the detail needs the same words, and a second copy means a rename updates one
 * screen and silently not the other.
 */
export const INTAKE_CHECKLIST_LABELS: Record<IntakeChecklistKey, () => string> = {
  rezervna: m.intake_checklist_rezervna,
  dizalica: m.intake_checklist_dizalica,
  komplet: m.intake_checklist_komplet,
  saobracajna: m.intake_checklist_saobracajna,
  vozacka: m.intake_checklist_vozacka,
  prvaPomoc: m.intake_checklist_prva_pomoc,
  prsluk: m.intake_checklist_prsluk,
  lanci: m.intake_checklist_lanci,
}

export const INTAKE_VEHICLE_TYPE_LABELS: Record<IntakeVehicleType, () => string> = {
  auto: m.intake_vehicle_type_auto,
  kombi: m.intake_vehicle_type_kombi,
  kamionet: m.intake_vehicle_type_kamionet,
  dzip: m.intake_vehicle_type_dzip,
}

export const INTAKE_ARRIVAL_MODE_LABELS: Record<IntakeArrivalMode, () => string> = {
  dovezeno: m.intake_arrival_dovezeno,
  doslepano: m.intake_arrival_doslepano,
  dovuceno: m.intake_arrival_dovuceno,
}
