import {
  ApiError,
  EngineManufacturerCreateInputSchema,
  EngineManufacturerUpdateInputSchema,
  engineManufacturersReferenceQueryKey,
  fetchJson,
  type EngineManufacturerCreateInput,
  type EngineManufacturerListItem,
  type EngineManufacturerUpdateInput,
} from '@mr/shared'
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

export function useCreateEngineManufacturer(): UseMutationResult<
  EngineManufacturerListItem,
  Error,
  EngineManufacturerCreateInput
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: EngineManufacturerCreateInput,
    ): Promise<EngineManufacturerListItem> => {
      const body = EngineManufacturerCreateInputSchema.parse(input)
      return fetchJson<EngineManufacturerListItem>('/api/engine-manufacturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: engineManufacturersReferenceQueryKey() })
    },
  })
}

export function useUpdateEngineManufacturer(
  id: string,
): UseMutationResult<EngineManufacturerListItem, Error, EngineManufacturerUpdateInput> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: EngineManufacturerUpdateInput,
    ): Promise<EngineManufacturerListItem> => {
      const body = EngineManufacturerUpdateInputSchema.parse(input)
      return fetchJson<EngineManufacturerListItem>(`/api/engine-manufacturers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: engineManufacturersReferenceQueryKey() })
    },
  })
}

export function useDeactivateEngineManufacturer(
  id: string,
): UseMutationResult<EngineManufacturerListItem, Error, void> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<EngineManufacturerListItem> =>
      fetchJson<EngineManufacturerListItem>(`/api/engine-manufacturers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: engineManufacturersReferenceQueryKey() })
    },
  })
}

export function engineManufacturerSaveErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return 'Greška pri čuvanju proizvođača.'
}
