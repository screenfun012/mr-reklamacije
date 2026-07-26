import { IntakeVehicleType } from '../enums.js'

/**
 * Damage-map zones, transferred verbatim from `prijem-prototip-v2`'s `zoneOf(type, x, y)`.
 *
 * Do not "clean up" the thresholds. They are tied to each silhouette's proportions — a kombi
 * has no boot and its cab is short, a kamionet splits into cab and bed — and the numbers were
 * read off the drawings. Even the left/right boundaries differ: 100/240 for most, 98/242 for
 * the džip.
 *
 * Lives in `@mr/shared` because the SERVER derives the zone when a damage is saved rather than
 * trusting the string a client sends: the zone is printed on the work order, so a wrong one is
 * a permanent error on a document the customer signed.
 *
 * Coordinates are in the silhouette's own space (`viewBox="0 0 340 556"`, front at the bottom),
 * never screen pixels.
 */
export function intakeDamageZoneOf(type: IntakeVehicleType, x: number, y: number): string {
  const left = x < 100
  const right = x > 240

  if (type === IntakeVehicleType.Van) {
    if (y < 80) return 'zadnja vrata'
    if (y > 466) return 'prednji branik'
    if (left) return y < 300 ? 'leva bočna strana (teretni deo)' : 'leva bočna strana (kabina)'
    if (right) return y < 300 ? 'desna bočna strana (teretni deo)' : 'desna bočna strana (kabina)'
    if (y < 394) return 'krov teretnog dela'
    if (y < 432) return 'vetrobran'
    return 'hauba'
  }

  if (type === IntakeVehicleType.Pickup) {
    if (y < 62) return 'zadnji branik'
    if (y > 458) return 'prednji branik'
    if (left) return y < 300 ? 'leva strana sanduka' : 'leva strana kabine'
    if (right) return y < 300 ? 'desna strana sanduka' : 'desna strana kabine'
    if (y < 292) return 'sanduk (korito)'
    if (y < 308) return 'zadnje staklo kabine'
    if (y < 374) return 'krov kabine'
    if (y < 410) return 'vetrobran'
    return 'hauba'
  }

  if (type === IntakeVehicleType.Suv) {
    if (y < 70) return 'zadnji branik'
    if (y > 474) return 'prednji branik'
    if (x < 98) return y < 280 ? 'zadnja leva strana' : 'prednja leva strana'
    if (x > 242) return y < 280 ? 'zadnja desna strana' : 'prednja desna strana'
    if (y < 134) return 'zadnja vrata / gepek'
    if (y < 172) return 'zadnje staklo'
    if (y < 362) return 'krov'
    if (y < 402) return 'vetrobran'
    return 'hauba'
  }

  if (y < 70) return 'zadnji branik'
  if (y > 472) return 'prednji branik'
  if (left) return y < 270 ? 'zadnja leva strana' : 'prednja leva strana'
  if (right) return y < 270 ? 'zadnja desna strana' : 'prednja desna strana'
  if (y < 100) return 'gepek / poklopac'
  if (y < 134) return 'zadnje staklo'
  if (y < 368) return 'krov'
  if (y < 406) return 'vetrobran'
  return 'hauba'
}
