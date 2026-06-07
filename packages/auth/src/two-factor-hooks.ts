import type { MRAuthClientForPermissions } from './auth-client-types.js'

export function useTwoFactor(authClient: MRAuthClientForPermissions): {
  isEnabled: boolean
  isLoading: boolean
} {
  const { data: session, isPending } = authClient.useSession()
  return {
    isEnabled: Boolean(
      session?.user &&
      'twoFactorEnabled' in session.user &&
      session.user['twoFactorEnabled'] === true,
    ),
    isLoading: isPending,
  }
}
