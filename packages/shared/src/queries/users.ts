import { queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import { fetchNoContent } from '../api/fetch-no-content.js'
import { fetchAllReferencePages } from './fetch-all-reference-pages.js'
import type {
  UserAccountStatusPatchInput,
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

export async function patchUserAccountStatus(
  userId: string,
  input: UserAccountStatusPatchInput,
): Promise<UserListItem> {
  return fetchJson<UserListItem>(`/api/users/${userId}/account-status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
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
