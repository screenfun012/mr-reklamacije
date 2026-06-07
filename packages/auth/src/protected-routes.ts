import { redirect } from '@tanstack/react-router'

import {
  LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE,
  type MRAuthClientForRouteRoles,
} from './auth-client-types.js'
import {
  resolveAuthSessionForGuard,
  type RouteBeforeLoadArgs,
  type ServerSessionLoader,
} from './router-auth.js'

function normalizeRoles(userRoles: unknown): readonly string[] {
  if (!Array.isArray(userRoles)) return []
  return userRoles.filter((r): r is string => typeof r === 'string')
}

function normalizePermissions(perms: unknown): readonly string[] {
  if (!Array.isArray(perms)) return []
  return perms.filter((p): p is string => typeof p === 'string')
}

/**
 * TanStack Router `beforeLoad` guard factory (ANY logic across role codes).
 *
 * - Browser: reads settled `context.authSession` from root `beforeLoad` (no refetch)
 * - SSR: `loadServerSession` (pass `createServerSessionLoader(apiOrigin)` from the app)
 */
export function requireRoles(
  authClient: MRAuthClientForRouteRoles,
  allowedRoles: readonly string[],
  loadServerSession?: ServerSessionLoader,
): (args: RouteBeforeLoadArgs) => Promise<void> {
  const allowed = new Set(allowedRoles)
  return async (args) => {
    const sessionData = await resolveAuthSessionForGuard(args, authClient, loadServerSession)
    const user = sessionData?.user
    if (!user) {
      throw redirect({ to: '/login' })
    }

    const roles = normalizeRoles(user.roles)
    const hasAllowedRole = roles.some((r) => allowed.has(r))
    if (!hasAllowedRole) {
      const onServer = typeof globalThis.window === 'undefined'
      if (!onServer) {
        await authClient.signOut()
      }
      throw redirect({
        to: '/login',
        search: { reason: LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE },
      })
    }
  }
}

/**
 * TanStack Router `beforeLoad` guard — user must have ANY of the listed permissions.
 */
export function requirePermissions(
  authClient: MRAuthClientForRouteRoles,
  requiredPermissions: readonly string[],
  loadServerSession?: ServerSessionLoader,
): (args: RouteBeforeLoadArgs) => Promise<void> {
  return async (args) => {
    const sessionData = await resolveAuthSessionForGuard(args, authClient, loadServerSession)
    const user = sessionData?.user
    if (!user) {
      throw redirect({ to: '/login' })
    }

    const permissions = normalizePermissions(user['permissions'])
    const hasAny = requiredPermissions.some((p) => permissions.includes(p))
    if (!hasAny) {
      throw redirect({ to: '/' })
    }
  }
}
