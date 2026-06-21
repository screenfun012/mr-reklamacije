import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  ApiError,
  domaceClaimKeys,
  fetchJson,
  type DomaceClaimCreateInput,
  type DomaceClaimDetail,
} from '@mr/shared'

import { serializeDomaceCreateBody } from './serialize-domace-create-body.js'

export function useCreateDomaceClaim() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DomaceClaimCreateInput): Promise<DomaceClaimDetail> =>
      fetchJson<DomaceClaimDetail>('/api/domace-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeDomaceCreateBody(input)),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: domaceClaimKeys.lists() })
    },
  })
}

export function createDomaceClaimErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return 'Greška pri čuvanju reklamacije. Pokušajte ponovo.'
}
