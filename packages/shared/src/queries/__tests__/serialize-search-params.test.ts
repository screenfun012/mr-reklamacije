import { describe, expect, it } from 'vitest'

import {
  serializeEmotiveClaimsListParams,
  serializeReferenceListParams,
} from '../serialize-search-params.js'

describe('serializeEmotiveClaimsListParams', () => {
  it('serializes filters and pagination', () => {
    const query = serializeEmotiveClaimsListParams({
      outcome: 'pending',
      page: 2,
      pageSize: 25,
      includeDeleted: false,
      dateFrom: new Date('2026-04-17T12:00:00Z'),
    })

    expect(query).toBe(
      'outcome=pending&page=2&pageSize=25&includeDeleted=false&dateFrom=2026-04-17',
    )
  })

  it('omits undefined values', () => {
    expect(serializeEmotiveClaimsListParams({ page: 1, pageSize: 10 })).toBe('page=1&pageSize=10')
  })

  it('serializes sortBy and sortDir for claims list API', () => {
    const query = serializeEmotiveClaimsListParams({
      page: 1,
      pageSize: 10,
      sortBy: 'dateOfClaim',
      sortDir: 'asc',
    })

    expect(query).toBe('page=1&pageSize=10&sortBy=dateOfClaim&sortDir=asc')
  })
})

describe('serializeReferenceListParams', () => {
  it('serializes boolean and cursor values', () => {
    const query = serializeReferenceListParams({ activeOnly: true, search: 'auto' }, 'next')
    expect(query).toBe('activeOnly=true&search=auto&cursor=next')
  })
})
