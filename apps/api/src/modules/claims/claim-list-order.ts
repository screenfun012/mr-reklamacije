import { ClaimSortBy, ClaimSortDir, type ClaimListQuery } from '@mr/shared'
import { sql, type SQL } from 'drizzle-orm'

const SORT_COLUMN_BY_FIELD = {
  [ClaimSortBy.DateOfClaim]: 'date_of_claim',
  [ClaimSortBy.DateOfFinish]: 'date_of_finish',
} as const satisfies Record<(typeof ClaimSortBy)[keyof typeof ClaimSortBy], string>

export function resolveClaimListOrderClause(query: ClaimListQuery): string {
  if (query.sortBy === undefined) {
    return 'date_of_claim DESC NULLS LAST, id DESC'
  }

  const column = SORT_COLUMN_BY_FIELD[query.sortBy]
  const direction = query.sortDir ?? ClaimSortDir.Desc

  if (direction === ClaimSortDir.Asc) {
    return `${column} ASC NULLS LAST, id ASC`
  }

  return `${column} DESC NULLS LAST, id DESC`
}

export function buildClaimListOrderBy(query: ClaimListQuery): SQL {
  return sql.raw(resolveClaimListOrderClause(query))
}
