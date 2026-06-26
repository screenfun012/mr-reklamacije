import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import { emotiveClaimKeys, fetchJson, type EmotiveClaimDetail } from '@mr/shared'

export interface ClaimFindingsEdit {
  internalNotes: string | null
}

export function useUpdateEmotiveClaimFindings(
  id: string,
): UseMutationResult<EmotiveClaimDetail, Error, ClaimFindingsEdit> {
  const queryClient = useQueryClient()
  const detailKey = emotiveClaimKeys.detail(id)

  return useMutation<EmotiveClaimDetail, Error, ClaimFindingsEdit>({
    mutationFn: (input) =>
      fetchJson<EmotiveClaimDetail>(`/api/emotive-claims/${id}`, {
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
