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

  return useMutation<
    EmotiveClaimDetail,
    Error,
    ClaimFindingsEdit,
    { previous: EmotiveClaimDetail | undefined }
  >({
    mutationFn: (input) =>
      fetchJson<EmotiveClaimDetail>(`/api/emotive-claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: detailKey })
      const previous = queryClient.getQueryData<EmotiveClaimDetail>(detailKey)
      if (previous !== undefined) {
        queryClient.setQueryData<EmotiveClaimDetail>(detailKey, {
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
