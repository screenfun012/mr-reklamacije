import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import { domaceClaimKeys, fetchJson, type DomaceClaimDetail } from '@mr/shared'

import type { DomaceClaimBasicEdit } from './domace-claim-detail-schemas.js'

export function useUpdateDomaceClaimBasic(
  id: string,
): UseMutationResult<DomaceClaimDetail, Error, DomaceClaimBasicEdit> {
  const queryClient = useQueryClient()
  const detailKey = domaceClaimKeys.detail(id)

  return useMutation<DomaceClaimDetail, Error, DomaceClaimBasicEdit>({
    mutationFn: (input) =>
      fetchJson<DomaceClaimDetail>(`/api/domace-claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
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
