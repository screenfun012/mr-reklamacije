import { UserAccountStatus, type UserListItem } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { countUsersByStatus } from '../dashboard-user-counts'

function user(accountStatus: UserListItem['accountStatus'], id: string): UserListItem {
  return {
    id,
    email: `${id}@mrengines.rs`,
    name: id,
    accountStatus,
    createdAt: '2026-01-01T00:00:00.000Z',
    roles: [],
  }
}

describe('countUsersByStatus', () => {
  it('counts approved as active and pending as awaiting approval', () => {
    const counts = countUsersByStatus([
      user(UserAccountStatus.Approved, 'a'),
      user(UserAccountStatus.Approved, 'b'),
      user(UserAccountStatus.Pending, 'c'),
      user(UserAccountStatus.Rejected, 'd'),
    ])

    expect(counts).toEqual({ active: 2, pendingApproval: 1 })
  })

  it('returns zeros for an empty list', () => {
    expect(countUsersByStatus([])).toEqual({ active: 0, pendingApproval: 0 })
  })
})
