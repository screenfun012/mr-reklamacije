import { ClaimSortBy, ClaimSortDir } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { resolveClaimListOrderClause } from '../claim-list-order.js'

describe('resolveClaimListOrderClause', () => {
  it('uses default date_of_claim desc when sortBy is omitted', () => {
    expect(
      resolveClaimListOrderClause({
        page: 1,
        pageSize: 10,
        includeDeleted: false,
      }),
    ).toBe('date_of_claim DESC NULLS LAST, id DESC')
  })

  it('sorts dateOfClaim ascending with nulls last', () => {
    expect(
      resolveClaimListOrderClause({
        page: 1,
        pageSize: 10,
        includeDeleted: false,
        sortBy: ClaimSortBy.DateOfClaim,
        sortDir: ClaimSortDir.Asc,
      }),
    ).toBe('date_of_claim ASC NULLS LAST, id ASC')
  })

  it('sorts dateOfFinish descending with nulls last when sortDir omitted', () => {
    expect(
      resolveClaimListOrderClause({
        page: 1,
        pageSize: 10,
        includeDeleted: false,
        sortBy: ClaimSortBy.DateOfFinish,
      }),
    ).toBe('date_of_finish DESC NULLS LAST, id DESC')
  })
})
