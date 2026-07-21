export const SEARCH_MIN_CHARS = 2

/**
 * True while a claim search is in flight for the currently-typed query — either
 * the debounce hasn't caught up yet (`debouncedQuery` still lags `trimmedQuery`)
 * or the request is fetching. Used to suppress the "no results" empty state so
 * it never flashes before results arrive on a fresh search.
 */
export function isSearchPending(
  trimmedQuery: string,
  debouncedQuery: string,
  isFetching: boolean,
): boolean {
  if (trimmedQuery.length < SEARCH_MIN_CHARS) {
    return false
  }
  return debouncedQuery !== trimmedQuery || isFetching
}
