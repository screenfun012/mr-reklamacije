import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import { domaceClaimKeys, fetchJson, type DomaceClaimDetail } from '@mr/shared'

export function useUpdateDomaceClaimAmount(
  id: string,
): UseMutationResult<DomaceClaimDetail, Error, number | null> {
  const queryClient = useQueryClient()
  const detailKey = domaceClaimKeys.detail(id)

  return useMutation<DomaceClaimDetail, Error, number | null>({
    mutationFn: (totalAmount) =>
      fetchJson<DomaceClaimDetail>(`/api/domace-claims/${id}/amount`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalAmount }),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(detailKey, updated)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: detailKey })
      await queryClient.invalidateQueries({ queryKey: domaceClaimKeys.lists() })
    },
  })
}
