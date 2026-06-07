import type { ReactNode } from 'react'

import type { MRAuthClientForPermissions } from './auth-client-types.js'
import { usePermissions } from './use-permission-hooks.js'

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

function normalizeRoles(userRoles: unknown): readonly string[] {
  if (!Array.isArray(userRoles)) return []
  return userRoles.filter((r): r is string => typeof r === 'string')
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
