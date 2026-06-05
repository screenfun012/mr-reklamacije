/** claim_year is derived from date_of_claim in application code (not a DB trigger). */
export function claimYearFromDate(date: Date): number {
  return date.getFullYear()
}
