import { z } from 'zod'

import { ClaimKind, ClaimOutcome } from '../enums.js'
import { claimKeys } from './claim-keys.js'
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
  search: z.string().trim().min(1).optional(),
  dateFrom: z.string().regex(isoDatePattern).optional(),
  dateTo: z.string().regex(isoDatePattern).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(10), z.literal(25), z.literal(50)]))
    .default(10),
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

export function claimsSearchFromFilters(
  filters: ClaimsListFilters,
  pagination: { page: number; pageSize: number },
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
  if (filters.search !== undefined && filters.search.length > 0) {
    search.search = filters.search
  }
  if (filters.dateFrom !== undefined) {
    search.dateFrom = filters.dateFrom.toISOString().slice(0, 10)
  }
  if (filters.dateTo !== undefined) {
    search.dateTo = filters.dateTo.toISOString().slice(0, 10)
  }

  return search
}

export function claimsListQueryKeyFromSearch(
  search: ClaimsSearch,
): ReturnType<typeof claimKeys.list> {
  const { page, pageSize } = claimsPaginationFromSearch(search)
  return claimsListQueryKey(claimsFiltersFromSearch(search), page, pageSize)
}
