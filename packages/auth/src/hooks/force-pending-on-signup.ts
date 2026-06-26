import { UserAccountStatus } from '@mr/shared'

/**
 * Database hook: every email/password signup starts as pending approval.
 *
 * Runs in databaseHooks.user.create.before — overrides any client-supplied
 * account_status (additionalFields has input: false, but this is defense in depth).
 */
export function createForcePendingOnSignupHook() {
  return async (user: Record<string, unknown>) => {
    return {
      data: {
        ...user,
        accountStatus: UserAccountStatus.Pending,
      },
    }
  }
}
