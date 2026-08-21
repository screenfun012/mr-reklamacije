import type { RouteBeforeLoadArgs } from '@mr/auth/route-guards'
import {
  createServerSessionLoader,
  requirePermissions,
  requireRoles,
  resolveSessionPayload,
} from '@mr/auth/route-guards'
import {
  INTAKE_ORDERS_VIEW_PERMISSIONS,
  INTERNAL_APP_PERMISSIONS,
  STATISTICS_VIEW_PERMISSIONS,
  INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS,
  INTERNAL_DOMACE_CLAIMS_VIEW_PERMISSIONS,
  INTERNAL_EMOTIVE_CLAIMS_VIEW_PERMISSIONS,
  INTERNAL_APP_ROLES,
} from '@mr/shared'
import { redirect } from '@tanstack/react-router'

import { authClient } from './auth-client'

export const loadServerSession = createServerSessionLoader()

export function internalRequireRoles(allowedRoles: readonly string[]) {
  return requireRoles(authClient, allowedRoles, loadServerSession)
}

export function internalRequireClaimsListView() {
  return requirePermissions(authClient, INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS, loadServerSession)
}

export function internalRequireEmotiveClaimsView() {
  return requirePermissions(authClient, INTERNAL_EMOTIVE_CLAIMS_VIEW_PERMISSIONS, loadServerSession)
}

export function internalRequireEmotiveClaimsCreate() {
  return requirePermissions(authClient, ['emotive_claims.create'], loadServerSession)
}

export function internalRequireDomaceClaimsCreate() {
  return requirePermissions(authClient, ['domace_claims.create'], loadServerSession)
}

/**
 * The create wizard asks which KIND the claim is, so holding either permission is enough to open
 * it — the step then offers only the cards the actor may actually use, and the server refuses
 * anything else regardless.
 */
export function internalRequireClaimsCreate() {
  return requirePermissions(
    authClient,
    ['emotive_claims.create', 'domace_claims.create'],
    loadServerSession,
  )
}

export function internalRequireDomaceClaimsView() {
  return requirePermissions(authClient, INTERNAL_DOMACE_CLAIMS_VIEW_PERMISSIONS, loadServerSession)
}

/**
 * Any screen that belongs to the internal app but to no single module — a person's own security
 * settings. Written in permissions rather than role codes so a role the office builds tomorrow
 * (say "Statistika") is not locked out by a list nobody remembered to extend.
 */
export function internalRequireAppAccess() {
  return requirePermissions(authClient, INTERNAL_APP_PERMISSIONS, loadServerSession)
}

export function internalRequireStatisticsView() {
  return requirePermissions(authClient, STATISTICS_VIEW_PERMISSIONS, loadServerSession)
}

export function internalRequireClientSubmissionsManage() {
  return requirePermissions(authClient, ['client_submissions.manage'], loadServerSession)
}

/**
 * Vehicle service intake. Deliberately gated on permissions rather than roles: a serviser
 * has no claims access, so the role list used by the claims routes would lock him out of
 * the one screen he exists for.
 */
export function internalRequireIntakeOrdersView() {
  return requirePermissions(authClient, INTAKE_ORDERS_VIEW_PERMISSIONS, loadServerSession)
}

export function internalRequireIntakeOrdersCreate() {
  return requirePermissions(authClient, ['intake_orders.create'], loadServerSession)
}

function normalizePermissions(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function hasAny(permissions: readonly string[], required: readonly string[]): boolean {
  const held = new Set(permissions)
  return required.some((permission) => held.has(permission))
}

/**
 * The home route's guard. Beyond the usual role check it decides *whose* home this is: the
 * dashboard is claim-shaped and its loader calls `/api/dashboard/summary`, which a serviser
 * has no permission for — landing him there would mean a 403 error screen on every login.
 *
 * Doing it here rather than in the login form means every entry point (sign-in, a bookmark,
 * clicking the logo) obeys one rule instead of three copies of it.
 */
export function internalHomeGuard(): (args: RouteBeforeLoadArgs) => Promise<void> {
  const roleGuard = internalRequireRoles(INTERNAL_APP_ROLES)

  return async (args) => {
    await roleGuard(args)

    // Browser: the settled session from the root beforeLoad. Server: load it, since route
    // context is not populated there.
    const contextSession = args.context.authSession
    const permissions = normalizePermissions(
      contextSession !== undefined && contextSession !== null
        ? contextSession.user?.permissions
        : resolveSessionPayload(await loadServerSession())?.user?.permissions,
    )

    if (
      !hasAny(permissions, INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS) &&
      hasAny(permissions, INTAKE_ORDERS_VIEW_PERMISSIONS)
    ) {
      throw redirect({ to: '/prijem' })
    }
  }
}
