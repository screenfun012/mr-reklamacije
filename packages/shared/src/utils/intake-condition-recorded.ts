import type { IntakeChecklist, IntakeExtraChecklist } from '../schemas/intake-order.schema.js'

/**
 * Did the intake record anything at all about the vehicle's condition?
 *
 * The owner signs the printed sheet while standing there, and that sheet is the only evidence if he
 * later says a jack was in the boot — so a signature over a band that asserts nothing is the thing
 * this rule exists to prevent. The bar is deliberately low: one tap or one written line, because a
 * serviser who cannot get past a screen learns to stop filling it in (docs/25 §3.0).
 *
 * An answer on a code the shop has since retired counts: the order still prints that row under its
 * own name, so the paper asserts something. A row the serviser wrote in himself counts for the same
 * reason — it prints in the same band, in the same shape.
 *
 * Shared by the wizard (which kills DALJE) and the API service (which refuses to sign), kept here so
 * the two can never drift.
 */
export function isIntakeConditionRecorded(
  checklist: IntakeChecklist,
  extraChecklist: IntakeExtraChecklist,
  equipmentNote: string | null,
  activeCatalogItemCount: number,
): boolean {
  // Nothing to fill in — an empty catalog is the office's mistake, and it must not strand a car in
  // the yard. The sheet says so in words instead.
  if (activeCatalogItemCount === 0) {
    return true
  }
  if (equipmentNote !== null && equipmentNote.trim().length > 0) {
    return true
  }

  const answered = (value: boolean | null): boolean => value === true || value === false

  return (
    Object.values(checklist).some(answered) || extraChecklist.some((row) => answered(row.value))
  )
}
