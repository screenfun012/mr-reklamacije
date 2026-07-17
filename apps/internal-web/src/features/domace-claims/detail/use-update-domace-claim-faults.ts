import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import {
  ClaimKind,
  domaceClaimKeys,
  fetchJson,
  invalidateInternalClaimQueries,
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
    onSettled: () => {
      invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Domace, id })
    },
  })
}
