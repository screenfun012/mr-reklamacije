/**
 * DOMACE UKUPNO (Excel M) = parts (K) + labor (L), both ex-VAT — a plain sum.
 *
 * Shared by the API (stored into total_amount on every write, so statistics and
 * the dashboard keep reading one column) and the form (the live UKUPNO the
 * operator sees). Kept here so the two can never drift.
 *
 * Both empty → null (no amount entered), so an untouched claim keeps a blank
 * UKUPNO rather than a misleading 0. Either present → the other counts as 0.
 */
export function computeDomaceTotal(
  partsAmount: number | null | undefined,
  laborAmount: number | null | undefined,
): number | null {
  if (
    (partsAmount === null || partsAmount === undefined) &&
    (laborAmount === null || laborAmount === undefined)
  ) {
    return null
  }
  return (partsAmount ?? 0) + (laborAmount ?? 0)
}
