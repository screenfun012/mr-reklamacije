import { UserAccountStatus, type UserListItem } from '@mr/shared'

export interface UserStatusCounts {
  /** Approved (active) accounts. */
  active: number
  /** Registrations awaiting admin approval. */
  pendingApproval: number
}

/** Derive admin dashboard user metrics from the full users list (no extra API call). */
export function countUsersByStatus(users: readonly UserListItem[]): UserStatusCounts {
  let active = 0
  let pendingApproval = 0

  for (const user of users) {
    if (user.accountStatus === UserAccountStatus.Approved) {
      active += 1
    } else if (user.accountStatus === UserAccountStatus.Pending) {
      pendingApproval += 1
    }
  }

  return { active, pendingApproval }
}
