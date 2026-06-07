import type { ReactNode } from 'react'

import {
  LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE,
  type MRAuthClientForPermissions,
} from './auth-client-types.js'
import { requirePermissions, requireRoles } from './protected-routes.js'

export {
  LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE,
  type MRAuthClientForPermissions,
  type MRAuthClientForRouteRoles,
} from './auth-client-types.js'
export { requirePermissions, requireRoles } from './protected-routes.js'
export {
  createRootAuthBeforeLoad,
  SESSION_ROUTE_STALE_MS,
  type AuthRouterContext,
  type RouteBeforeLoadArgs,
} from './router-auth.js'
export {
  resolveSessionPayload,
  toSerializableAuthSession,
  type AuthSessionPayload,
  type SerializableAuthSession,
} from './session-payload.js'
export { handleUnauthorizedSession } from './unauthorized-session.js'

export { createServerSessionLoader } from './server-session-loader.js'

function normalizeRoles(userRoles: unknown): readonly string[] {
  if (!Array.isArray(userRoles)) return []
  return userRoles.filter((r): r is string => typeof r === 'string')
}

function normalizePermissions(perms: unknown): readonly string[] {
  if (!Array.isArray(perms)) return []
  return perms.filter((p): p is string => typeof p === 'string')
}

/**
 * Hook that returns the current user's permissions from the Better-Auth session.
 */
export function usePermissions(authClient: MRAuthClientForPermissions): {
  has: (permission: string) => boolean
  hasAny: (permissions: readonly string[]) => boolean
  hasAll: (permissions: readonly string[]) => boolean
  list: readonly string[]
  isLoading: boolean
} {
  const { data: session, isPending, isRefetching } = authClient.useSession()
  const permissions = normalizePermissions(session?.user?.['permissions'])
  const permissionSet = new Set(permissions)
  const isLoading = isPending || isRefetching === true

  return {
    has: (permission) => (isLoading ? false : permissionSet.has(permission)),
    hasAny: (perms) => (isLoading ? false : perms.some((p) => permissionSet.has(p))),
    hasAll: (perms) => (isLoading ? false : perms.every((p) => permissionSet.has(p))),
    list: isLoading ? [] : permissions,
    isLoading,
  }
}

export function useHasRole(
  authClient: MRAuthClientForPermissions,
  roleOrRoles: string | readonly string[],
): boolean {
  const { data: session, isPending, isRefetching } = authClient.useSession()
  if (isPending || isRefetching === true) return false

  const userRoles = normalizeRoles(session?.user?.['roles'])
  const required = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]
  return required.some((r) => userRoles.includes(r))
}

export type CanProps =
  | { permission: string; anyOf?: never; allOf?: never; role?: never; anyRole?: never }
  | { permission?: never; anyOf: readonly string[]; allOf?: never; role?: never; anyRole?: never }
  | { permission?: never; anyOf?: never; allOf: readonly string[]; role?: never; anyRole?: never }
  | { permission?: never; anyOf?: never; allOf?: never; role: string; anyRole?: never }
  | {
      permission?: never
      anyOf?: never
      allOf?: never
      role?: never
      anyRole: readonly string[]
    }

export function Can(
  props: CanProps & {
    authClient: MRAuthClientForPermissions
    children: ReactNode
    fallback?: ReactNode
  },
): ReactNode {
  const { authClient, children, fallback = null } = props

  const permissions = usePermissions(authClient)
  const { data: session, isPending, isRefetching } = authClient.useSession()
  if (isPending || isRefetching === true) {
    return <>{fallback}</>
  }

  const userRoles = normalizeRoles(session?.user?.['roles'])

  let allowed = false

  if ('permission' in props && props.permission) {
    allowed = permissions.has(props.permission)
  } else if ('anyOf' in props && props.anyOf) {
    allowed = permissions.hasAny(props.anyOf)
  } else if ('allOf' in props && props.allOf) {
    allowed = permissions.hasAll(props.allOf)
  } else if ('role' in props && props.role) {
    allowed = userRoles.includes(props.role)
  } else if ('anyRole' in props && props.anyRole) {
    allowed = props.anyRole.some((r) => userRoles.includes(r))
  }

  return allowed ? <>{children}</> : <>{fallback}</>
}

export type LoginAuthErrorKind = 'invalid' | 'rate_limited' | 'generic'

export function loginAuthErrorKind(code: string | undefined): LoginAuthErrorKind {
  if (code === 'INVALID_EMAIL_OR_PASSWORD') {
    return 'invalid'
  }
  if (code === 'RATE_LIMITED') {
    return 'rate_limited'
  }
  return 'generic'
}

export function loginAuthErrorMessage(
  code: string | undefined,
  messages: {
    invalid: string
    rateLimited: string
    generic: string
  },
): string {
  switch (loginAuthErrorKind(code)) {
    case 'invalid':
      return messages.invalid
    case 'rate_limited':
      return messages.rateLimited
    default:
      return messages.generic
  }
}

export * from './two-factor-ui.js'
