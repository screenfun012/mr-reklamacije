import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import { emotiveClaimKeys, fetchJson, type EmotiveClaimDetail } from '@mr/shared'

export interface ClaimInspectionReportEdit {
  inspectionReport: string | null
}

export function useUpdateEmotiveClaimInspectionReport(
  id: string,
): UseMutationResult<EmotiveClaimDetail, Error, ClaimInspectionReportEdit> {
  const queryClient = useQueryClient()
  const detailKey = emotiveClaimKeys.detail(id)

  return useMutation<
    EmotiveClaimDetail,
    Error,
    ClaimInspectionReportEdit,
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
          inspectionReport: input.inspectionReport,
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
