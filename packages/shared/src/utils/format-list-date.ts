/** Formats API date string (YYYY-MM-DD…) as dd.MM.yyyy. */
export function formatListDate(isoDate: string): string {
  const datePart = isoDate.slice(0, 10)
  const [year, month, day] = datePart.split('-')
  if (!year || !month || !day) {
    return isoDate
  }

  return `${day}.${month}.${year}.`
}
