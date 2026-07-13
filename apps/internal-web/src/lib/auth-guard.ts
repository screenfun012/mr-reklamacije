import { createServerSessionLoader, requirePermissions, requireRoles } from '@mr/auth/route-guards'
import {
  CLAIMS_LIST_VIEW_PERMISSIONS,
  DOMACE_CLAIMS_LIST_VIEW_PERMISSIONS,
  EMOTIVE_CLAIMS_LIST_VIEW_PERMISSIONS,
} from '@mr/shared'

import { authClient } from './auth-client'

export const loadServerSession = createServerSessionLoader()

export function internalRequireRoles(allowedRoles: readonly string[]) {
  return requireRoles(authClient, allowedRoles, loadServerSession)
}

export function internalRequireClaimsListView() {
  return requirePermissions(authClient, CLAIMS_LIST_VIEW_PERMISSIONS, loadServerSession)
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

export function internalRequireClientSubmissionsManage() {
  return requirePermissions(authClient, ['client_submissions.manage'], loadServerSession)
}
