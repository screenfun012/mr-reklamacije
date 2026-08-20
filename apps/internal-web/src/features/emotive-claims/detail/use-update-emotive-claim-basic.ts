import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import {
  ClaimKind,
  emotiveClaimKeys,
  fetchJson,
  invalidateInternalClaimQueries,
  type EmotiveClaimDetail,
} from '@mr/shared'

/**
 * Editable basic fields of an emotive claim. Optional fields use `null` to
 * clear a stored value (server maps `null` → cleared column).
 */
export interface EmotiveClaimBasicEdit {
  mrNumber: string
  claimNumber: string | null
  customerId: string
  manufacturerId: string | null
  categoryId: string
  engineTypeId: string
  engineCode: string | null
  dateOfClaim: string
  dateOfFinish: string | null
  employeeId: string | null
  warrantyReport?: string
}

/**
 * Patches a claim's basic fields.
 *
 * Non-optimistic on purpose: this is a deliberate save, the server recomputes
 * derived fields (`claimYear`) and resolves names/`updatedAt`, and the locking
 * wall may reject the write with 409. We surface the saved server snapshot on
 * success and let the error bubble to the caller for inline display.
 */
export function useUpdateEmotiveClaimBasic(
  id: string,
): UseMutationResult<EmotiveClaimDetail, Error, EmotiveClaimBasicEdit> {
  const queryClient = useQueryClient()
  const detailKey = emotiveClaimKeys.detail(id)

  return useMutation<EmotiveClaimDetail, Error, EmotiveClaimBasicEdit>({
    mutationFn: (input) =>
      fetchJson<EmotiveClaimDetail>(`/api/emotive-claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(detailKey, updated)
    },
    onSettled: () => {
      invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Emotive, id })
    },
  })
}
