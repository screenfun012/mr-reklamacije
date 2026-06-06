/**
 * claim_year is derived from date_of_claim in application code (not a DB trigger).
 * Uses UTC calendar components so the year is identical on any server timezone.
 */
export function claimYearFromDate(date: Date): number {
  return date.getUTCFullYear()
}
