import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import {
  ClaimKind,
  domaceClaimKeys,
  fetchJson,
  invalidateInternalClaimQueries,
  type ClaimOutcome,
  type DomaceClaimDetail,
} from '@mr/shared'
import { ClaimOutcome as ClaimOutcomeValues } from '@mr/shared'
import { m } from '@mr/i18n'

import { showInternalToast } from '~/lib/internal-toast'

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
      if (updated.outcome === ClaimOutcomeValues.Accepted) {
        showInternalToast(m.internal_toast_outcome_accepted())
      } else if (updated.outcome === ClaimOutcomeValues.Rejected) {
        showInternalToast(m.internal_toast_outcome_rejected())
      }
    },
    onSettled: () => {
      invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Domace, id })
    },
  })
}
