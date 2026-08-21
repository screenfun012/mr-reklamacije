import type { ClaimCategoryFieldValues } from '@mr/shared'

/**
 * How a claim stores its category answers: keyed by the category they were entered under, so a
 * claim that is moved to another kind of work keeps what was typed instead of losing it.
 *
 * Only the server ever sees this shape — the wire carries one flat map for the claim's CURRENT
 * category plus the previous ones already turned into words, so no screen handles an id.
 */
export type StoredCategoryFieldValues = Record<string, ClaimCategoryFieldValues>

/** The answers a claim carries for one category — `{}` when it carries none. */
export function categoryFieldValuesFor(
  stored: StoredCategoryFieldValues | null,
  categoryId: string | null,
): ClaimCategoryFieldValues {
  if (stored === null || categoryId === null) {
    return {}
  }
  return stored[categoryId] ?? {}
}

/**
 * Storage after writing one category's answers. Every OTHER category's answers are left exactly
 * as they were — that is the whole point of the nesting. An empty answer set drops its key rather
 * than storing `{}`, so "carries nothing" has one representation.
 */
export function withCategoryFieldValues(
  stored: StoredCategoryFieldValues | null,
  categoryId: string,
  values: ClaimCategoryFieldValues,
): StoredCategoryFieldValues | null {
  const next: StoredCategoryFieldValues = { ...(stored ?? {}) }

  if (Object.keys(values).length === 0) {
    delete next[categoryId]
  } else {
    next[categoryId] = values
  }

  return Object.keys(next).length === 0 ? null : next
}

/** Category ids the claim still carries answers for, other than the one it is in now. */
export function previousCategoryIdsOf(
  stored: StoredCategoryFieldValues | null,
  categoryId: string | null,
): string[] {
  if (stored === null) {
    return []
  }
  return Object.keys(stored).filter((id) => id !== categoryId)
}
