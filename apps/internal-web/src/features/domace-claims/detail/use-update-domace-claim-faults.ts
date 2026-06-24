import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import {
  domaceClaimKeys,
  fetchJson,
  invalidateStatisticsSummary,
  type DomaceClaimDetail,
  type DomaceClaimFaultInput,
} from '@mr/shared'

export function useUpdateDomaceClaimFaults(
  id: string,
): UseMutationResult<DomaceClaimDetail, Error, DomaceClaimFaultInput[]> {
  const queryClient = useQueryClient()
  const detailKey = domaceClaimKeys.detail(id)

  return useMutation<DomaceClaimDetail, Error, DomaceClaimFaultInput[]>({
    mutationFn: (faults) =>
      fetchJson<DomaceClaimDetail>(`/api/domace-claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faults }),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(detailKey, updated)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: detailKey })
      await queryClient.invalidateQueries({ queryKey: domaceClaimKeys.lists() })
      await invalidateStatisticsSummary(queryClient)
    },
  })
}
