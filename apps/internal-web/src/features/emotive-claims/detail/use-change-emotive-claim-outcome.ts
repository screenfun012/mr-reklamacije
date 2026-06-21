import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import {
  claimKeys,
  emotiveClaimKeys,
  fetchJson,
  type ClaimOutcome,
  type EmotiveClaimDetail,
} from '@mr/shared'

interface ChangeOutcomeContext {
  previous: EmotiveClaimDetail | undefined
}

/**
 * Optimistically flips a claim's outcome with rollback on failure.
 *
 * The detail badge reads from the cached detail query, so writing the new
 * outcome into the cache in `onMutate` updates the UI instantly; the server
 * response (with the authoritative `updatedAt`) replaces it on success, and a
 * failed request restores the pre-mutation snapshot.
 */
export function useChangeEmotiveClaimOutcome(
  id: string,
): UseMutationResult<EmotiveClaimDetail, Error, ClaimOutcome, ChangeOutcomeContext> {
  const queryClient = useQueryClient()
  const detailKey = emotiveClaimKeys.detail(id)

  return useMutation<EmotiveClaimDetail, Error, ClaimOutcome, ChangeOutcomeContext>({
    mutationFn: (outcome) =>
      fetchJson<EmotiveClaimDetail>(`/api/emotive-claims/${id}/change-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome }),
      }),
    onMutate: async (outcome) => {
      await queryClient.cancelQueries({ queryKey: detailKey })
      const previous = queryClient.getQueryData<EmotiveClaimDetail>(detailKey)
      if (previous !== undefined) {
        queryClient.setQueryData<EmotiveClaimDetail>(detailKey, { ...previous, outcome })
      }
      return { previous }
    },
    onError: (_error, _outcome, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(detailKey, context.previous)
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(detailKey, updated)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: detailKey })
      await queryClient.invalidateQueries({ queryKey: emotiveClaimKeys.lists() })
      await queryClient.invalidateQueries({ queryKey: claimKeys.lists() })
    },
  })
}
