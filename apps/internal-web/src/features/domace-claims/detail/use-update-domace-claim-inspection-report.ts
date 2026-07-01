import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import { domaceClaimKeys, fetchJson, type DomaceClaimDetail } from '@mr/shared'

export interface ClaimInspectionReportEdit {
  inspectionReport: string | null
}

export function useUpdateDomaceClaimInspectionReport(
  id: string,
): UseMutationResult<DomaceClaimDetail, Error, ClaimInspectionReportEdit> {
  const queryClient = useQueryClient()
  const detailKey = domaceClaimKeys.detail(id)

  return useMutation<
    DomaceClaimDetail,
    Error,
    ClaimInspectionReportEdit,
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
