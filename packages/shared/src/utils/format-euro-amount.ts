/**
 * Formats a monetary amount in EUR for DOMACE repair cost display (e.g. 1234.56 → "1.234,56 €").
 */
export function formatEuroAmount(value: number): string {
  const formatted = new Intl.NumberFormat('sr-RS', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  return `${formatted} €`
}
