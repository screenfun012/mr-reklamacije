/**
 * What a signed order still accepts, and it narrows twice.
 *
 * Nikola, 11.08.: the intake signatures close everything the receiving worker entered; the handover
 * signatures close the Specification as well. Between them the Specification stays alive, because
 * the serviser must be able to remove material he does not need.
 *
 * `contactPhone` survives both deliberately — it is the shop's working note, it is NEVER printed,
 * and the need to correct a wrong number does not end when the car leaves.
 *
 * `null` means no freeze at all. Takes the two dates rather than two booleans so a swapped argument
 * at the call site is a type error.
 */
export function freeFieldsFor(
  signedAt: Date | null,
  handoverSignedAt: Date | null,
): readonly string[] | null {
  if (signedAt === null) {
    return null
  }
  return handoverSignedAt === null ? ['services', 'materials', 'contactPhone'] : ['contactPhone']
}
