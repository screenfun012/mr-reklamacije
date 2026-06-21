import { createServerSessionLoader, requirePermissions, requireRoles } from '@mr/auth/route-guards'
import {
  DOMACE_CLAIMS_LIST_VIEW_PERMISSIONS,
  EMOTIVE_CLAIMS_LIST_VIEW_PERMISSIONS,
} from '@mr/shared'

import { authClient } from './auth-client'

const apiOrigin = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000'
export const loadServerSession = createServerSessionLoader(apiOrigin)

export function internalRequireRoles(allowedRoles: readonly string[]) {
  return requireRoles(authClient, allowedRoles, loadServerSession)
}

export function internalRequireEmotiveClaimsView() {
  return requirePermissions(authClient, EMOTIVE_CLAIMS_LIST_VIEW_PERMISSIONS, loadServerSession)
}

export function internalRequireEmotiveClaimsCreate() {
  return requirePermissions(authClient, ['emotive_claims.create'], loadServerSession)
}

export function internalRequireDomaceClaimsCreate() {
  return requirePermissions(authClient, ['domace_claims.create'], loadServerSession)
}

export function internalRequireDomaceClaimsView() {
  return requirePermissions(authClient, DOMACE_CLAIMS_LIST_VIEW_PERMISSIONS, loadServerSession)
}
