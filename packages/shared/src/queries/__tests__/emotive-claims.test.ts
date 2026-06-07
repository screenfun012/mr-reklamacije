import { describe, expect, it } from 'vitest'

import {
  emotiveClaimsListNextCursor,
  emotiveClaimsListOptions,
  emotiveClaimsListQueryKey,
  normalizeEmotiveClaimsListFilters,
} from '../emotive-claims.js'

describe('emotiveClaimsListQueryKey', () => {
  it('is stable for equivalent date filters', () => {
    const dateFrom = new Date('2026-04-17T08:00:00Z')
    const sameDay = new Date('2026-04-17T20:00:00Z')

    const first = emotiveClaimsListQueryKey({ limit: 50, dateFrom })
    const second = emotiveClaimsListQueryKey({ limit: 50, dateFrom: sameDay })

    expect(first).toEqual(second)
  })

  it('changes when filters change', () => {
    const pending = emotiveClaimsListQueryKey({ limit: 50, outcome: 'pending' })
    const accepted = emotiveClaimsListQueryKey({ limit: 50, outcome: 'accepted' })

    expect(pending).not.toEqual(accepted)
  })
})

describe('normalizeEmotiveClaimsListFilters', () => {
  it('normalizes date fields to UTC midnight for stable keys', () => {
    const dateFrom = new Date('2026-04-17T15:30:00Z')
    const normalized = normalizeEmotiveClaimsListFilters({ limit: 50, dateFrom })

    expect(normalized.dateFrom).not.toBe(dateFrom)
    expect(normalized.dateFrom?.toISOString()).toBe('2026-04-17T00:00:00.000Z')
  })
})

describe('emotiveClaimsListNextCursor', () => {
  it('returns next cursor when present', () => {
    expect(
      emotiveClaimsListNextCursor({
        items: [],
        nextCursor: 'abc',
        hasMore: true,
      }),
    ).toBe('abc')
  })

  it('returns undefined when cursor is null', () => {
    expect(
      emotiveClaimsListNextCursor({
        items: [],
        nextCursor: null,
        hasMore: false,
      }),
    ).toBeUndefined()
  })
})

describe('emotiveClaimsListOptions', () => {
  it('exposes infinite query key, stale time, and next page param from nextCursor', () => {
    const options = emotiveClaimsListOptions({ limit: 50 })
    expect(options.queryKey).toEqual(emotiveClaimsListQueryKey({ limit: 50 }))
    expect(options.staleTime).toBe(30_000)
    expect(
      options.getNextPageParam?.(
        { items: [], nextCursor: 'page-2', hasMore: true },
        [],
        undefined,
        [],
      ),
    ).toBe('page-2')
    expect(
      options.getNextPageParam?.(
        { items: [], nextCursor: null, hasMore: false },
        [],
        undefined,
        [],
      ),
    ).toBeUndefined()
  })
})
