import { redirect } from '@tanstack/react-router'

/** Query value for `/login` when the user was signed out due to wrong app role. */
export const LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE = 'insufficient-role' as const

export type MRAuthClientForRouteRoles = {
  getSession(): Promise<unknown>
  signOut(): Promise<unknown>
}

function parseSessionPayload(raw: unknown): SessionLike | null {
  if (!raw || typeof raw !== 'object' || !('data' in raw)) {
    return null
  }
  const data = (raw as { data: unknown }).data
  if (data === null || data === undefined) {
    return null
  }
  if (typeof data !== 'object') {
    return null
  }
  return data as SessionLike
}

type SessionLike = {
  user?: UserLike | null
}

type UserLike = {
  roles?: unknown
}

function normalizeRoles(userRoles: unknown): readonly string[] {
  if (!Array.isArray(userRoles)) return []
  return userRoles.filter((r): r is string => typeof r === 'string')
}

/**
 * TanStack Router `beforeLoad` guard factory (ANY logic across role codes).
 *
 * Runs only in the browser. During SSR/Vite/RSC, Better-Auth's client pulls
 * Node-only primitives (Buffer/events) incorrectly when bundled — so we noop
 * on the server; the guard runs immediately after hydration.
 *
 * - No session → redirect to `/login`
 * - Session without allowed role → `signOut()` then redirect to
 *   `/login?reason=insufficient-role`
 *
 * Reads `user.roles` from the Better-Auth + customSession client payload.
 */
export function requireRoles(
  authClient: MRAuthClientForRouteRoles,
  allowedRoles: readonly string[],
): () => Promise<void> {
  const allowed = new Set(allowedRoles)
  return async () => {
    // Better-Auth client is browser-only here; SSR would pull externalized polyfills.
    const g = globalThis as typeof globalThis & { window?: unknown }
    if (typeof g.window === 'undefined') {
      return
    }

    const raw = await authClient.getSession()
    const sessionData = parseSessionPayload(raw)
    const user = sessionData?.user
    if (!user) {
      throw redirect({ to: '/login' })
    }

    const roles = normalizeRoles(user.roles)
    const hasAllowedRole = roles.some((r) => allowed.has(r))
    if (!hasAllowedRole) {
      await authClient.signOut()
      throw redirect({
        to: '/login',
        search: { reason: LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE },
      })
    }
  }
}
