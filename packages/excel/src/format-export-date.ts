/**
 * Formats an ISO date (YYYY-MM-DD) for legacy Excel cells: DD.MM.YYYY.
 */
export function formatExportDate(isoDate: string | null): string | null {
  if (isoDate === null || isoDate.length === 0) {
    return null
  }

  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match === null) {
    return null
  }

  const [, year, month, day] = match
  return `${day}.${month}.${year}.`
}

/** Sheet title date for UKUPNO SA DD.MM.YYYY. */
export function formatSheetDateLabel(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = date.getUTCFullYear()
  return `${day}.${month}.${year}`
}
