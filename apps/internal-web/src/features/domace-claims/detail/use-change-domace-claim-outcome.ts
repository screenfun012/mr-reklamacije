import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import {
  claimKeys,
  domaceClaimKeys,
  fetchJson,
  invalidateStatisticsSummary,
  type ClaimOutcome,
  type DomaceClaimDetail,
} from '@mr/shared'

interface ChangeOutcomeContext {
  previous: DomaceClaimDetail | undefined
}

export function useChangeDomaceClaimOutcome(
  id: string,
): UseMutationResult<DomaceClaimDetail, Error, ClaimOutcome, ChangeOutcomeContext> {
  const queryClient = useQueryClient()
  const detailKey = domaceClaimKeys.detail(id)

  return useMutation<DomaceClaimDetail, Error, ClaimOutcome, ChangeOutcomeContext>({
    mutationFn: (outcome) =>
      fetchJson<DomaceClaimDetail>(`/api/domace-claims/${id}/change-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome }),
      }),
    onMutate: async (outcome) => {
      await queryClient.cancelQueries({ queryKey: detailKey })
      const previous = queryClient.getQueryData<DomaceClaimDetail>(detailKey)
      if (previous !== undefined) {
        queryClient.setQueryData<DomaceClaimDetail>(detailKey, { ...previous, outcome })
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
      await queryClient.invalidateQueries({ queryKey: domaceClaimKeys.lists() })
      await queryClient.invalidateQueries({ queryKey: claimKeys.lists() })
      await invalidateStatisticsSummary(queryClient)
    },
  })
}
