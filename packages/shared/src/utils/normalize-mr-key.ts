/**
 * Canonical MR registry key: trim, collapse internal whitespace, lowercase.
 * Does NOT strip an "MR" prefix — "MR5376" and "mr5376" match; "MR5376" ≠ "5376".
 */
export function normalizeMrKey(raw: string | null | undefined): string | null {
  if (raw == null) {
    return null
  }

  const trimmed = raw.trim()
  if (trimmed === '') {
    return null
  }

  return trimmed.replace(/\s+/g, ' ').toLowerCase()
}
