import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import {
  ApiError,
  claimKeys,
  emotiveClaimKeys,
  fetchJson,
  invalidateStatisticsSummary,
  type EmotiveClaimCreateInput,
  type EmotiveClaimDetail,
} from '@mr/shared'

import { serializeEmotiveCreateBody } from './serialize-emotive-create-body.js'

export function useCreateEmotiveClaim() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: EmotiveClaimCreateInput): Promise<EmotiveClaimDetail> =>
      fetchJson<EmotiveClaimDetail>('/api/emotive-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeEmotiveCreateBody(input)),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: emotiveClaimKeys.lists() })
      await queryClient.invalidateQueries({ queryKey: claimKeys.lists() })
      await invalidateStatisticsSummary(queryClient)
      await navigate({ to: '/reklamacije', search: { page: 1, pageSize: 10 } })
    },
  })
}

export function createEmotiveClaimErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return 'Greška pri čuvanju reklamacije. Pokušajte ponovo.'
}
