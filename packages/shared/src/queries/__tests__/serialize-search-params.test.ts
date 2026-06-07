import { describe, expect, it } from 'vitest'

import {
  serializeEmotiveClaimsListParams,
  serializeReferenceListParams,
} from '../serialize-search-params.js'

describe('serializeEmotiveClaimsListParams', () => {
  it('serializes filters and cursor', () => {
    const query = serializeEmotiveClaimsListParams(
      {
        outcome: 'pending',
        limit: 25,
        includeDeleted: false,
        dateFrom: new Date('2026-04-17T12:00:00Z'),
      },
      'cursor-1',
    )

    expect(query).toBe(
      'outcome=pending&limit=25&includeDeleted=false&dateFrom=2026-04-17&cursor=cursor-1',
    )
  })

  it('omits undefined values', () => {
    expect(serializeEmotiveClaimsListParams({ limit: 50 })).toBe('limit=50')
  })
})

describe('serializeReferenceListParams', () => {
  it('serializes boolean and cursor values', () => {
    const query = serializeReferenceListParams({ activeOnly: true, search: 'auto' }, 'next')
    expect(query).toBe('activeOnly=true&search=auto&cursor=next')
  })
})
