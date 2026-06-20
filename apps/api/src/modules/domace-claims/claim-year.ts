/**
 * DOMACE claim_year derives from date_of_claim when present, otherwise the
 * current year. UTC calendar components keep the result timezone-independent.
 */
export function domaceClaimYearFromDate(date: Date | null | undefined): number {
  return (date ?? new Date()).getUTCFullYear()
}
