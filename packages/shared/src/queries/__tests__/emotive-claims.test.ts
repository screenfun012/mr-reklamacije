import { describe, expect, it } from 'vitest'

import {
  emotiveClaimsListOptions,
  emotiveClaimsListQueryKey,
  normalizeEmotiveClaimsListFilters,
} from '../emotive-claims.js'

describe('emotiveClaimsListQueryKey', () => {
  it('is stable for equivalent date filters', () => {
    const dateFrom = new Date('2026-04-17T08:00:00Z')
    const sameDay = new Date('2026-04-17T20:00:00Z')

    const first = emotiveClaimsListQueryKey({ dateFrom }, 1, 10)
    const second = emotiveClaimsListQueryKey({ dateFrom: sameDay }, 1, 10)

    expect(first).toEqual(second)
  })

  it('changes when filters or pagination change', () => {
    const pending = emotiveClaimsListQueryKey({ outcome: 'pending' }, 1, 10)
    const accepted = emotiveClaimsListQueryKey({ outcome: 'accepted' }, 1, 10)
    const pageTwo = emotiveClaimsListQueryKey({ outcome: 'pending' }, 2, 10)

    expect(pending).not.toEqual(accepted)
    expect(pending).not.toEqual(pageTwo)
  })
})

describe('normalizeEmotiveClaimsListFilters', () => {
  it('normalizes date fields to UTC midnight for stable keys', () => {
    const dateFrom = new Date('2026-04-17T15:30:00Z')
    const normalized = normalizeEmotiveClaimsListFilters({ dateFrom })

    expect(normalized.dateFrom).not.toBe(dateFrom)
    expect(normalized.dateFrom?.toISOString()).toBe('2026-04-17T00:00:00.000Z')
  })
})

describe('emotiveClaimsListOptions', () => {
  it('exposes offset query key, stale time, and keepPreviousData placeholder', () => {
    const options = emotiveClaimsListOptions({}, 1, 10)
    expect(options.queryKey).toEqual(emotiveClaimsListQueryKey({}, 1, 10))
    expect(options.staleTime).toBe(30_000)
    expect(options.placeholderData).toBeDefined()
  })
})
