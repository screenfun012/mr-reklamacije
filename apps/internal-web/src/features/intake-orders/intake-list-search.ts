import type { IntakeOrdersSearch } from '@mr/shared'

/**
 * The `Prikaz` select is office-only, but the search PARAM is not — a pasted
 * `/prijem?view=deleted` reaches the route for whoever opens it. Left alone the server refuses
 * it (403) before the screen renders, the route falls to its error component, and a serviser is
 * left with no table, no filter bar and no way to clear the param from the page: recoverable
 * only by navigating in again from the sidebar. So a caller who cannot see the whole shop has
 * the param dropped and gets his ordinary list.
 *
 * It lives here rather than inside the route because the loader and the screen build the query
 * key SEPARATELY. Sanitising only one of them puts them on different keys and the refused
 * request happens anyway — both call this.
 */
export function visibleIntakeSearch(
  search: IntakeOrdersSearch,
  permissions: readonly string[],
): IntakeOrdersSearch {
  if (permissions.includes('intake_orders.view')) {
    return search
  }
  const { view, ...rest } = search
  return view === undefined ? search : rest
}
