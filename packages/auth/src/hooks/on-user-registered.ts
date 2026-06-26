import { UserAccountStatus } from '@mr/shared'

/**
 * Database hook: notify the API when a new pending user registers.
 *
 * Runs in databaseHooks.user.create.after. The callback is injected by
 * apps/api (SSE publish) — @mr/auth must not import EventBus.
 */
export function createOnUserRegisteredHook(onUserRegistered?: (userId: string) => void) {
  return async (user: { id: string } & Record<string, unknown>) => {
    if (onUserRegistered === undefined) {
      return
    }

    const accountStatus = user['accountStatus'] ?? user['account_status']
    if (accountStatus !== UserAccountStatus.Pending && accountStatus !== 'pending') {
      return
    }

    try {
      onUserRegistered(user.id)
    } catch (error) {
      console.error('[auth] onUserRegistered callback failed:', error)
    }
  }
}
