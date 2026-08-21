export const CLAIMS_ALL_ENTRY = 'all'

const CATEGORY_LIST_PREFIX = '/reklamacije/kategorija/'

export interface ClaimsLocation {
  pathname: string
  search: Record<string, unknown>
}

/**
 * Which child of the "Reklamacije" group is the current place (V2 spec §5): the category on its
 * own list route; "all" on the plain list — an ordinary category FILTER there is a filter, not a
 * place, and the menu must not move under someone who used the select; on a detail or the wizard,
 * the category it was opened from. `null` outside claims.
 */
export function activeClaimsEntry(location: ClaimsLocation): string | null {
  const { pathname, search } = location

  if (pathname.startsWith(CATEGORY_LIST_PREFIX)) {
    const code = pathname.slice(CATEGORY_LIST_PREFIX.length).split('/')[0]
    return code !== undefined && code.length > 0 ? decodeURIComponent(code) : CLAIMS_ALL_ENTRY
  }

  if (pathname === '/reklamacije') {
    return CLAIMS_ALL_ENTRY
  }

  if (pathname.startsWith('/reklamacije/')) {
    const from = search['categoryCode']
    return typeof from === 'string' && from.length > 0 ? from : CLAIMS_ALL_ENTRY
  }

  return null
}
