/** Query value for `/login` when the user was signed out due to wrong app role. */
export const LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE = 'insufficient-role' as const

export type MRAuthClientForRouteRoles = {
  getSession(): Promise<unknown>
  signOut(): Promise<unknown>
}

/**
 * Minimal interface for Better-Auth client when consumed by
 * permission hooks/components. Real authClient has more methods,
 * but this lets tests stub easily.
 */
export type MRAuthClientForPermissions = {
  useSession: () => {
    data:
      | {
          /** Better-Auth user payload; fields depend on plugins (e.g. roles, twoFactorEnabled). */
          user?: Record<string, unknown> | null
        }
      | null
      | undefined
    isPending: boolean
    isRefetching?: boolean
    error: unknown
  }
}
