import { z } from 'zod'

import { ClaimOutcome } from '../enums.js'
import { emotiveClaimKeys } from './emotive-claim-keys.js'
import { emotiveClaimsListQueryKey, type EmotiveClaimsListFilters } from './emotive-claims.js'

const claimOutcomeValues = [
  ClaimOutcome.Pending,
  ClaimOutcome.Accepted,
  ClaimOutcome.Rejected,
  ClaimOutcome.Archived,
] as const

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/
export const EmotiveClaimsSearchSchema = z.object({
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

export type EmotiveClaimsSearch = z.infer<typeof EmotiveClaimsSearchSchema>

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10

function parseIsoDate(value: string | undefined): Date | undefined {
  if (value === undefined) {
    return undefined
  }

  return new Date(`${value}T00:00:00.000Z`)
}

export function emotiveClaimsFiltersFromSearch(
  search: EmotiveClaimsSearch,
): EmotiveClaimsListFilters {
  return {
    outcome: search.outcome,
    search: search.search,
    dateFrom: parseIsoDate(search.dateFrom),
    dateTo: parseIsoDate(search.dateTo),
  }
}

export function emotiveClaimsPaginationFromSearch(search: EmotiveClaimsSearch): {
  page: number
  pageSize: 10 | 25 | 50
} {
  return {
    page: search.page ?? DEFAULT_PAGE,
    pageSize: search.pageSize ?? DEFAULT_PAGE_SIZE,
  }
}

export function emotiveClaimsSearchFromFilters(
  filters: EmotiveClaimsListFilters,
  pagination: { page: number; pageSize: number },
): EmotiveClaimsSearch {
  const search: EmotiveClaimsSearch = {
    page: pagination.page,
    pageSize: pagination.pageSize as EmotiveClaimsSearch['pageSize'],
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

export function emotiveClaimsListQueryKeyFromSearch(
  search: EmotiveClaimsSearch,
): ReturnType<typeof emotiveClaimKeys.list> {
  const { page, pageSize } = emotiveClaimsPaginationFromSearch(search)
  return emotiveClaimsListQueryKey(emotiveClaimsFiltersFromSearch(search), page, pageSize)
}

export function emotiveClaimsListOptionsFromSearch(search: EmotiveClaimsSearch) {
  const { page, pageSize } = emotiveClaimsPaginationFromSearch(search)
  const filters = emotiveClaimsFiltersFromSearch(search)
  return { filters, page, pageSize }
}
