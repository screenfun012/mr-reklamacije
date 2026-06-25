import { ApiError, fetchJson } from '@mr/shared'
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import type { ResourceDefinition } from './types.js'

export function resourceSaveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return fallback
}

export function createResourceCrudHooks<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
>(definition: ResourceDefinition<TItem, TCreate, TUpdate>) {
  function useCreateResource(): UseMutationResult<TItem, Error, TCreate> {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (input: TCreate): Promise<TItem> => {
        const body = definition.createSchema.parse(input)
        return fetchJson<TItem>(definition.apiBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: definition.listQueryKeyPrefix })
      },
    })
  }

  function useUpdateResource(id: string): UseMutationResult<TItem, Error, TUpdate> {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (input: TUpdate): Promise<TItem> => {
        const body = definition.updateSchema.parse(input)
        return fetchJson<TItem>(`${definition.apiBase}/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: definition.listQueryKeyPrefix })
      },
    })
  }

  function useDeactivateResource(id: string): UseMutationResult<TItem, Error, void> {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (): Promise<TItem> =>
        fetchJson<TItem>(`${definition.apiBase}/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false }),
        }),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: definition.listQueryKeyPrefix })
      },
    })
  }

  return {
    useCreateResource,
    useUpdateResource,
    useDeactivateResource,
  }
}
