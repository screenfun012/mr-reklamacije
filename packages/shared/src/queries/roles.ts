import { queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import { fetchNoContent } from '../api/fetch-no-content.js'
import type {
  PermissionCatalogItem,
  RoleCreateInput,
  RoleDetail,
  RoleDuplicateInput,
  RoleListItem,
  RoleUpdateInput,
} from '../schemas/role.schema.js'

export const rolesQueryKeys = {
  all: ['roles'] as const,
  list: () => [...rolesQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...rolesQueryKeys.all, 'detail', id] as const,
  permissionCatalog: () => ['permission-catalog'] as const,
}

export function rolesListOptions() {
  return queryOptions({
    queryKey: rolesQueryKeys.list(),
    queryFn: async () => (await fetchJson<{ items: RoleListItem[] }>('/api/roles')).items,
  })
}

/**
 * The list carries only a COUNT of actions, so the editor has to fetch the set itself. Kept apart
 * on purpose: the list is drawn far more often than a set is opened, and dragging 84 codes per row
 * through it would buy nothing.
 */
export function roleDetailOptions(id: string) {
  return queryOptions({
    queryKey: rolesQueryKeys.detail(id),
    queryFn: () => fetchJson<RoleDetail>(`/api/roles/${id}`),
  })
}

/** Every action with its human name, grouped on screen by `module`. Gated by `roles.view`. */
export function permissionCatalogOptions() {
  return queryOptions({
    queryKey: rolesQueryKeys.permissionCatalog(),
    queryFn: async () =>
      (await fetchJson<{ items: PermissionCatalogItem[] }>('/api/permissions')).items,
    // The catalog changes only when the code does, so it never goes stale within a session.
    staleTime: Infinity,
  })
}

export async function createRole(input: RoleCreateInput): Promise<RoleDetail> {
  return fetchJson<RoleDetail>('/api/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function updateRole(id: string, input: RoleUpdateInput): Promise<RoleDetail> {
  return fetchJson<RoleDetail>(`/api/roles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function duplicateRole(id: string, names: RoleDuplicateInput): Promise<RoleDetail> {
  return fetchJson<RoleDetail>(`/api/roles/${id}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(names),
  })
}

export async function deleteRole(id: string): Promise<void> {
  return fetchNoContent(`/api/roles/${id}`, { method: 'DELETE' })
}
