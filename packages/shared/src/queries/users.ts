import { queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import { fetchNoContent } from '../api/fetch-no-content.js'
import { type AccountApprovalRoleCode } from '../constants/approve-registration-roles.js'
import { SYSTEM_ROLE_CLIENT, SYSTEM_ROLE_VIEWER } from '../constants/roles.js'
import { UserAccountStatus } from '../enums.js'
import { fetchAllReferencePages } from './fetch-all-reference-pages.js'
import type {
  UserAccountStatusPatchBody,
  UserAccountStatusResult,
  UserListItem,
  UserPasswordResetInput,
  UserRolesReplaceInput,
} from '../schemas/user.schema.js'

const USERS_LIST_STALE_MS = 30_000

export function usersListQueryKey(): readonly ['users'] {
  return ['users'] as const
}

export function usersListOptions() {
  return queryOptions({
    queryKey: usersListQueryKey(),
    queryFn: () => fetchAllReferencePages<UserListItem>('/api/users', {}),
    staleTime: USERS_LIST_STALE_MS,
  })
}

/**
 * Builds the account-status PATCH body from an admin decision. `customerIds` is
 * included ONLY for the client role — the API rejects it for every other role,
 * so it must be omitted (not sent as an empty array) when approving others.
 */
export function buildAccountStatusPatchBody(decision: {
  status: typeof UserAccountStatus.Approved | typeof UserAccountStatus.Rejected
  roleCode?: AccountApprovalRoleCode | undefined
  customerIds?: readonly string[] | undefined
}): UserAccountStatusPatchBody {
  if (decision.status !== UserAccountStatus.Approved) {
    return { status: decision.status }
  }

  const roleCode = decision.roleCode ?? SYSTEM_ROLE_VIEWER
  if (roleCode === SYSTEM_ROLE_CLIENT) {
    return { status: decision.status, roleCode, customerIds: [...(decision.customerIds ?? [])] }
  }

  return { status: decision.status, roleCode }
}

export async function patchUserAccountStatus(
  userId: string,
  input: UserAccountStatusPatchBody,
): Promise<UserAccountStatusResult> {
  return fetchJson<UserAccountStatusResult>(`/api/users/${userId}/account-status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/** Resend the activation email for an approved client (mints a fresh token). */
export async function resendClientActivation(userId: string): Promise<{ sent: boolean }> {
  return fetchJson<{ sent: boolean }>(`/api/users/${userId}/resend-activation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function patchUserRoles(
  userId: string,
  input: UserRolesReplaceInput,
): Promise<UserListItem> {
  return fetchJson<UserListItem>(`/api/users/${userId}/roles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function resetUserPassword(
  userId: string,
  input: UserPasswordResetInput,
): Promise<void> {
  return fetchNoContent(`/api/users/${userId}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
