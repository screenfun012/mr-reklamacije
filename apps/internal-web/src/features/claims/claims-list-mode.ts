import type { ClaimCategoryCount, ClaimsSearch } from '@mr/shared'

/**
 * The claims list is one screen in two modes (V2 spec §7): everything, or one kind of work.
 * In category mode the code comes from the PATH, not the search — it is a place you are in,
 * not a filter you set, and the two behave differently when filters are cleared.
 */
export type ClaimsListMode =
  | { kind: 'all' }
  | { kind: 'category'; code: string; category: ClaimCategoryCount | null }

export function resolveClaimsListMode(
  categoryCode: string | undefined,
  counts: readonly ClaimCategoryCount[],
): ClaimsListMode {
  if (categoryCode === undefined) {
    return { kind: 'all' }
  }

  // `null` when the code names no category the reader can see — the list then simply comes back
  // empty, with the code as its title. An unknown code is not an error, the same way the filter
  // has always treated one.
  return {
    kind: 'category',
    code: categoryCode,
    category: counts.find((item) => item.code === categoryCode) ?? null,
  }
}

/** Is any filter set, besides the place itself? */
export function hasActiveClaimsFilters(search: ClaimsSearch): boolean {
  return (
    search.kind !== undefined ||
    search.outcome !== undefined ||
    search.manufacturerId !== undefined ||
    search.engineTypeId !== undefined ||
    search.categoryCode !== undefined ||
    search.dateFrom !== undefined ||
    search.dateTo !== undefined ||
    (search.search !== undefined && search.search.length > 0)
  )
}

/**
 * "Nothing here yet" and "nothing matches" are different sentences and must not be swapped: the
 * first invites the first claim, the second says to check the filters.
 */
export function isCategoryEmpty(search: ClaimsSearch, total: number): boolean {
  return !hasActiveClaimsFilters(search) && total === 0
}
