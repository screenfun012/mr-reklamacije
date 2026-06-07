import { z } from 'zod'

import { ClaimOutcome } from '../enums.js'
import type { EmotiveClaimsListFilters } from './emotive-claims.js'
import { emotiveClaimsListQueryKey } from './emotive-claims.js'

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
})

export type EmotiveClaimsSearch = z.infer<typeof EmotiveClaimsSearchSchema>

const DEFAULT_LIST_LIMIT = 50

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
    limit: DEFAULT_LIST_LIMIT,
    outcome: search.outcome,
    search: search.search,
    dateFrom: parseIsoDate(search.dateFrom),
    dateTo: parseIsoDate(search.dateTo),
  }
}

export function emotiveClaimsSearchFromFilters(
  filters: EmotiveClaimsListFilters,
): EmotiveClaimsSearch {
  const search: EmotiveClaimsSearch = {}

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
): ReturnType<typeof emotiveClaimsListQueryKey> {
  return emotiveClaimsListQueryKey(emotiveClaimsFiltersFromSearch(search))
}
