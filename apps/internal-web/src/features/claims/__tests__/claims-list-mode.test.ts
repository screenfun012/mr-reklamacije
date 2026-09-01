import type { ClaimCategoryCount, ClaimsSearch } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import {
  hasActiveClaimsFilters,
  isCategoryEmpty,
  resolveClaimsListMode,
} from '../claims-list-mode.js'

const MACHINING: ClaimCategoryCount = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'MASINSKA_OBRADA',
  name: 'Mašinska obrada',
  sortOrder: 20,
  isActive: true,
  total: 14,
  pending: 9,
}

const EMPTY_SEARCH: ClaimsSearch = { page: 1, pageSize: 10 }

describe('resolveClaimsListMode', () => {
  it('is the list of everything without a code in the path', () => {
    expect(resolveClaimsListMode(undefined, [MACHINING])).toEqual({ kind: 'all' })
  })

  it('names the category when the counts know it', () => {
    expect(resolveClaimsListMode('MASINSKA_OBRADA', [MACHINING])).toEqual({
      kind: 'category',
      code: 'MASINSKA_OBRADA',
      category: MACHINING,
    })
  })

  it('stays a category even when the code names nothing the reader can see', () => {
    // An unknown code is an empty list, never an error — the same way the filter always read one.
    expect(resolveClaimsListMode('NE_POSTOJI', [MACHINING])).toEqual({
      kind: 'category',
      code: 'NE_POSTOJI',
      category: null,
    })
  })
})

describe('isCategoryEmpty', () => {
  it('says "nothing here yet" only when the place itself is empty', () => {
    expect(isCategoryEmpty(EMPTY_SEARCH, 0)).toBe(true)
    expect(isCategoryEmpty(EMPTY_SEARCH, 3)).toBe(false)
  })

  it('says "no match" as soon as any filter is set', () => {
    // Two different silences: one invites the first claim, the other says to check the filter.
    expect(isCategoryEmpty({ ...EMPTY_SEARCH, outcome: 'pending' }, 0)).toBe(false)
    expect(isCategoryEmpty({ ...EMPTY_SEARCH, search: 'bmw' }, 0)).toBe(false)
  })
})

describe('hasActiveClaimsFilters', () => {
  it('ignores paging and sorting — they are not filters', () => {
    expect(hasActiveClaimsFilters({ page: 3, pageSize: 25, sortBy: 'dateOfClaim' })).toBe(false)
  })

  it('counts every real filter, including a category chosen from the select', () => {
    expect(hasActiveClaimsFilters({ ...EMPTY_SEARCH, categoryCode: 'NOVI_DELOVI' })).toBe(true)
    expect(hasActiveClaimsFilters({ ...EMPTY_SEARCH, kind: 'emotive' })).toBe(true)
    expect(hasActiveClaimsFilters({ ...EMPTY_SEARCH, manufacturerId: 'x' })).toBe(true)
    expect(hasActiveClaimsFilters({ ...EMPTY_SEARCH, engineTypeId: 'x' })).toBe(true)
  })
})
