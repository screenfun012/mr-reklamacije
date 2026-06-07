import { redirect } from '@tanstack/react-router'
import type { ReactNode } from 'react'

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
    error: unknown
  }
}

function parseClientSessionPayload(raw: unknown): SessionLike | null {
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

/** Normalizes Better-Auth client `{ data }` and direct API `{ user }` shapes. */
function resolveSessionPayload(raw: unknown): SessionLike | null {
  const fromClient = parseClientSessionPayload(raw)
  if (fromClient) {
    return fromClient
  }

  if (raw === null || raw === undefined) {
    return null
  }

  if (typeof raw !== 'object' || !('user' in raw)) {
    return null
  }

  const user = (raw as { user?: unknown }).user
  if (user === null || user === undefined || typeof user !== 'object') {
    return null
  }

  return { user: user as UserLike }
}

type SessionLike = {
  user?: UserLike | null
}

type UserLike = {
  roles?: unknown
  permissions?: unknown
}

function normalizeRoles(userRoles: unknown): readonly string[] {
  if (!Array.isArray(userRoles)) return []
  return userRoles.filter((r): r is string => typeof r === 'string')
}

function normalizePermissions(perms: unknown): readonly string[] {
  if (!Array.isArray(perms)) return []
  return perms.filter((p): p is string => typeof p === 'string')
}

export type ServerSessionLoader = () => Promise<unknown>

function isBrowser(): boolean {
  const g = globalThis as typeof globalThis & { window?: unknown }
  return typeof g.window !== 'undefined'
}

/**
 * TanStack Router `beforeLoad` guard factory (ANY logic across role codes).
 *
 * - Browser: `authClient.getSession()`
 * - SSR: `loadServerSession` (pass `createServerSessionLoader(apiOrigin)` from
 *   the app). Without a loader, SSR redirects to `/login` so protected HTML
 *   never leaks to unauthenticated users.
 *
 * - No session → redirect to `/login`
 * - Session without allowed role → `signOut()` (client only) then redirect to
 *   `/login?reason=insufficient-role`
 */
export function requireRoles(
  authClient: MRAuthClientForRouteRoles,
  allowedRoles: readonly string[],
  loadServerSession?: ServerSessionLoader,
): () => Promise<void> {
  const allowed = new Set(allowedRoles)
  return async () => {
    const onServer = !isBrowser()

    if (onServer && !loadServerSession) {
      throw redirect({ to: '/login' })
    }

    const raw = onServer ? await loadServerSession!() : await authClient.getSession()

    const sessionData = resolveSessionPayload(raw)
    const user = sessionData?.user
    if (!user) {
      throw redirect({ to: '/login' })
    }

    const roles = normalizeRoles(user.roles)
    const hasAllowedRole = roles.some((r) => allowed.has(r))
    if (!hasAllowedRole) {
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

export { createServerSessionLoader } from './server-session-loader.js'

/**
 * Hook that returns the current user's permissions from the Better-Auth session.
 * Returns boolean check helpers and the raw permission list.
 *
 * Reads from user.permissions populated by the customSession plugin (Phase 1.0a).
 * No additional API calls — uses cached session data.
 *
 * Returns empty/false results during loading or when no session exists; consumers do
 * not need to special-case loading.
 */
export function usePermissions(authClient: MRAuthClientForPermissions): {
  has: (permission: string) => boolean
  hasAny: (permissions: readonly string[]) => boolean
  hasAll: (permissions: readonly string[]) => boolean
  list: readonly string[]
  isLoading: boolean
} {
  const { data: session, isPending } = authClient.useSession()
  const permissions = normalizePermissions(session?.user?.['permissions'])
  const permissionSet = new Set(permissions)

  return {
    has: (permission) => permissionSet.has(permission),
    hasAny: (perms) => perms.some((p) => permissionSet.has(p)),
    hasAll: (perms) => perms.every((p) => permissionSet.has(p)),
    list: permissions,
    isLoading: isPending,
  }
}

/**
 * Hook that checks if the current user has a specific role or any of the given roles.
 * ANY logic.
 */
export function useHasRole(
  authClient: MRAuthClientForPermissions,
  roleOrRoles: string | readonly string[],
): boolean {
  const { data: session } = authClient.useSession()
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

/**
 * Conditional rendering wrapper. Renders `children` only when the current user passes
 * the permission/role check.
 *
 * Exactly ONE of `permission`, `anyOf`, `allOf`, `role`, `anyRole` must be provided
 * (TypeScript discriminated union enforces this).
 *
 * When the check fails, renders `fallback` if provided, otherwise renders nothing.
 *
 * Usage:
 *   <Can authClient={authClient} permission="users.create">
 *     <button type="button">Create user</button>
 *   </Can>
 *
 *   <Can authClient={authClient} anyOf={['users.update', 'users.delete']}>
 *     <button type="button">Edit</button>
 *   </Can>
 *
 *   <Can authClient={authClient} role="admin" fallback={<DisabledButton />}>
 *     <button type="button">Admin only</button>
 *   </Can>
 */
export function Can(
  props: CanProps & {
    authClient: MRAuthClientForPermissions
    children: ReactNode
    fallback?: ReactNode
  },
): ReactNode {
  const { authClient, children, fallback = null } = props

  const permissions = usePermissions(authClient)
  const { data: session } = authClient.useSession()
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

/**
 * TanStack Router `beforeLoad` guard — user must have ANY of the listed permissions.
 * Unauthenticated users redirect to `/login`; authenticated without permission to `/`.
 */
export function requirePermissions(
  authClient: MRAuthClientForRouteRoles,
  requiredPermissions: readonly string[],
  loadServerSession?: ServerSessionLoader,
): () => Promise<void> {
  return async () => {
    const onServer = !isBrowser()

    if (onServer && !loadServerSession) {
      throw redirect({ to: '/login' })
    }

    const raw = onServer ? await loadServerSession!() : await authClient.getSession()

    const sessionData = resolveSessionPayload(raw)
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

export type LoginAuthErrorKind = 'invalid' | 'rate_limited' | 'generic'

/** Maps Better-Auth / API error codes to login UI message keys. */
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
