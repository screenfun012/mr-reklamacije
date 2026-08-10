import {
  INTAKE_CHECKLIST_KEYS,
  type IntakeChecklist,
  type IntakeDamage,
} from '../schemas/intake-order.schema.js'

/**
 * Whether two recorded conditions say the same thing. Shared between the API — which refuses to
 * stamp a signed document when a patch changes nothing — and the detail screen, which builds that
 * patch. Two copies would drift, and either direction of drift is silent: one drops a real
 * correction, the other marks a document nobody edited.
 */
export function sameIntakeChecklist(a: IntakeChecklist, b: IntakeChecklist): boolean {
  return INTAKE_CHECKLIST_KEYS.every((key) => a[key] === b[key])
}

/**
 * Identity, position, type and note, in order — the array order IS the ①②③ numbering, so two
 * markers swapped is a change even though the set is untouched.
 *
 * `zone` is deliberately left out: the server derives it from (vehicleType, x, y), so comparing it
 * would report a change whenever a client sent a stale word for a marker that never moved.
 */
export function sameIntakeDamages(a: readonly IntakeDamage[], b: readonly IntakeDamage[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  return a.every((damage, index) => {
    const other = b[index]
    return (
      other !== undefined &&
      damage.id === other.id &&
      damage.type === other.type &&
      damage.x === other.x &&
      damage.y === other.y &&
      damage.note === other.note
    )
  })
}
