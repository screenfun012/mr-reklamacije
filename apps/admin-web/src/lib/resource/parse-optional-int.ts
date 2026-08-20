/**
 * Reads a whole number out of a resource form field, or `undefined` when the field is empty.
 *
 * Strict full-string parse: a separated value like "1.998" / "1,998" / "1 998" is REJECTED
 * (`undefined`), not silently truncated to 1 the way `Number.parseInt` would — a sort order
 * typed with a thousands separator must not quietly become a different number.
 */
export function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') {
    return undefined
  }
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) ? parsed : undefined
}
