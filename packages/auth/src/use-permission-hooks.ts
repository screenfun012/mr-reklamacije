import type { MRAuthClientForPermissions } from './auth-client-types.js'

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
