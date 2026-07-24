/**
 * Excel D VOZILO — the sheet holds one free-text vehicle string ("Mercedes 651",
 * "Fiat 1.3 mjtd"); the app splits it across manufacturer + engine type + engine
 * code catalogs, so the export composes the string back from those parts. Empty
 * parts are skipped; nothing set → null (a blank cell).
 */
export function formatVehicle(
  manufacturerName: string | null,
  engineTypeCode: string | null,
  engineCode: string | null,
): string | null {
  const composed = [manufacturerName, engineTypeCode, engineCode]
    .map((part) => part?.trim())
    .filter((part): part is string => part !== undefined && part !== '')
    .join(' ')
  return composed === '' ? null : composed
}
