import { z } from 'zod'

import { ClaimKind, ClaimOutcome } from '../enums.js'
import { claimSortByValues, claimSortDirValues } from '../schemas/claim-list.schema.js'
import { claimKeys, type ClaimsListSort } from './claim-keys.js'
import { claimsListQueryKey, type ClaimsListFilters } from './claims.js'

const claimOutcomeValues = [
  ClaimOutcome.Pending,
  ClaimOutcome.Accepted,
  ClaimOutcome.Rejected,
  ClaimOutcome.Archived,
] as const

const claimKindValues = [ClaimKind.Emotive, ClaimKind.Domace] as const

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

export const ClaimsSearchSchema = z.object({
  kind: z.enum(claimKindValues).optional(),
  outcome: z.enum(claimOutcomeValues).optional(),
  manufacturerId: z.string().uuid().optional(),
  engineTypeId: z.string().uuid().optional(),
  categoryCode: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  dateFrom: z.string().regex(isoDatePattern).optional(),
  dateTo: z.string().regex(isoDatePattern).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(10), z.literal(25), z.literal(50)]))
    .default(10),
  sortBy: z.enum(claimSortByValues).optional(),
  sortDir: z.enum(claimSortDirValues).optional(),
})

export type ClaimsSearch = z.infer<typeof ClaimsSearchSchema>

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10

function parseIsoDate(value: string | undefined): Date | undefined {
  if (value === undefined) {
    return undefined
  }

  return new Date(`${value}T00:00:00.000Z`)
}

export function claimsFiltersFromSearch(search: ClaimsSearch): ClaimsListFilters {
  return {
    kind: search.kind,
    outcome: search.outcome,
    manufacturerId: search.manufacturerId,
    engineTypeId: search.engineTypeId,
    // Forgotten here for four days while the select, the URL and the API each worked on their
    // own: the list silently ignored the category because this is the one step that joins them.
    categoryCode: search.categoryCode,
    search: search.search,
    dateFrom: parseIsoDate(search.dateFrom),
    dateTo: parseIsoDate(search.dateTo),
  }
}

export function claimsPaginationFromSearch(search: ClaimsSearch): {
  page: number
  pageSize: 10 | 25 | 50
} {
  return {
    page: search.page ?? DEFAULT_PAGE,
    pageSize: search.pageSize ?? DEFAULT_PAGE_SIZE,
  }
}

export function claimsSortFromSearch(search: ClaimsSearch): ClaimsListSort {
  const sort: ClaimsListSort = {}

  if (search.sortBy !== undefined) {
    sort.sortBy = search.sortBy
  }
  if (search.sortDir !== undefined) {
    sort.sortDir = search.sortDir
  }

  return sort
}

export function claimsSearchFromFilters(
  filters: ClaimsListFilters,
  pagination: { page: number; pageSize: number },
  sort: ClaimsListSort = {},
): ClaimsSearch {
  const search: ClaimsSearch = {
    page: pagination.page,
    pageSize: pagination.pageSize as ClaimsSearch['pageSize'],
  }

  if (filters.kind !== undefined) {
    search.kind = filters.kind
  }
  if (filters.outcome !== undefined) {
    search.outcome = filters.outcome
  }
  if (filters.manufacturerId !== undefined) {
    search.manufacturerId = filters.manufacturerId
  }
  if (filters.engineTypeId !== undefined) {
    search.engineTypeId = filters.engineTypeId
  }
  if (filters.categoryCode !== undefined) {
    search.categoryCode = filters.categoryCode
  }
  if (filters.search !== undefined && filters.search.length > 0) {
    search.search = filters.search
  }
  if (filters.dateFrom !== undefined) {
    search.dateFrom = filters.dateFrom.toISOString().slice(0, 10)
  }
  if (filters.dateTo !== undefined) {
    search.dateTo = filters.dateTo.toISOString().slice(0, 10)
  }
  if (sort.sortBy !== undefined) {
    search.sortBy = sort.sortBy
  }
  if (sort.sortDir !== undefined) {
    search.sortDir = sort.sortDir
  }

  return search
}

export function claimsListQueryKeyFromSearch(
  search: ClaimsSearch,
): ReturnType<typeof claimKeys.list> {
  const { page, pageSize } = claimsPaginationFromSearch(search)
  return claimsListQueryKey(
    claimsFiltersFromSearch(search),
    page,
    pageSize,
    claimsSortFromSearch(search),
  )
}
