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
 * `null` means no freeze at all.
 *
 * Read by BOTH sides: the service refuses a patch by it, and the Spec tab decides by it whether to
 * draw its add and ✕ controls at all. That is the whole reason it lives in `@mr/shared` — an enabled
 * field where the server would refuse is an offer the screen cannot keep.
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
