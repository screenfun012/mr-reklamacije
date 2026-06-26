import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import { domaceClaimKeys, fetchJson, type DomaceClaimDetail } from '@mr/shared'

export interface ClaimFindingsEdit {
  internalNotes: string | null
}

export function useUpdateDomaceClaimFindings(
  id: string,
): UseMutationResult<DomaceClaimDetail, Error, ClaimFindingsEdit> {
  const queryClient = useQueryClient()
  const detailKey = domaceClaimKeys.detail(id)

  return useMutation<DomaceClaimDetail, Error, ClaimFindingsEdit>({
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
    },
  })
}
