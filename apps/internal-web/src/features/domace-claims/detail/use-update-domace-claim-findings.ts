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

  return useMutation<
    DomaceClaimDetail,
    Error,
    ClaimFindingsEdit,
    { previous: DomaceClaimDetail | undefined }
  >({
    mutationFn: (input) =>
      fetchJson<DomaceClaimDetail>(`/api/domace-claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: detailKey })
      const previous = queryClient.getQueryData<DomaceClaimDetail>(detailKey)
      if (previous !== undefined) {
        queryClient.setQueryData<DomaceClaimDetail>(detailKey, {
          ...previous,
          internalNotes: input.internalNotes,
        })
      }
      return { previous }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(detailKey, updated)
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(detailKey, context.previous)
      }
    },
  })
}
