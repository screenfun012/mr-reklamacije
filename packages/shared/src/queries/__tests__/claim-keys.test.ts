import { describe, expect, it } from 'vitest'

import { ClaimSortBy, ClaimSortDir } from '../../schemas/claim-list.schema.js'
import { claimKeys } from '../claim-keys.js'

describe('claimKeys', () => {
  it('builds stable list keys for equivalent filters and sort', () => {
    const first = claimKeys.list({ outcome: 'pending' }, 1, 10, {
      sortBy: ClaimSortBy.DateOfClaim,
      sortDir: ClaimSortDir.Asc,
    })
    const second = claimKeys.list({ outcome: 'pending' }, 1, 10, {
      sortBy: ClaimSortBy.DateOfClaim,
      sortDir: ClaimSortDir.Asc,
    })

    expect(first).toEqual(second)
  })

  it('changes list key when sort params change', () => {
    const unsorted = claimKeys.list({}, 1, 10)
    const sortedAsc = claimKeys.list({}, 1, 10, {
      sortBy: ClaimSortBy.DateOfFinish,
      sortDir: ClaimSortDir.Asc,
    })
    const sortedDesc = claimKeys.list({}, 1, 10, {
      sortBy: ClaimSortBy.DateOfFinish,
      sortDir: ClaimSortDir.Desc,
    })

    expect(unsorted).not.toEqual(sortedAsc)
    expect(sortedAsc).not.toEqual(sortedDesc)
  })

  it('omits sort fields from key when sort is empty', () => {
    expect(claimKeys.list({}, 1, 10)).toEqual(['claims', 'list', { page: 1, pageSize: 10 }])
  })
})
