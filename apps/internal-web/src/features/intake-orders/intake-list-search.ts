import type { IntakeOrdersSearch } from '@mr/shared'

/**
 * The `Prikaz` select is office-only, but the search PARAM is not — a pasted
 * `/prijem?view=unfinished` reaches the route for whoever opens it. The own scope ignores the view
 * by design, so such a caller would be served his ordinary list under a query key nobody else
 * shares, for a control he cannot see or clear from the page. So the param is dropped for a caller
 * who cannot see the whole shop.
 *
 * It lives here rather than inside the route because the loader and the screen build the query
 * key SEPARATELY. Sanitising only one of them puts them on different keys and the extra request
 * happens anyway — both call this.
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
