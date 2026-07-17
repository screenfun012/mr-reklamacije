import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import {
  ClaimKind,
  emotiveClaimKeys,
  fetchJson,
  invalidateInternalClaimQueries,
  type EmotiveClaimDetail,
  type EmotiveClaimFaultInput,
} from '@mr/shared'

/**
 * Replaces a claim's fault rows via PATCH (replace-all).
 *
 * Non-optimistic on purpose: fault editing is a deliberate save (not a one-tap
 * toggle), the server resolves names/`updatedAt`, and the locking wall may
 * reject the write with 409. We surface the saved server snapshot on success
 * and let the error bubble to the caller for inline display.
 */
export function useUpdateEmotiveClaimFaults(
  id: string,
): UseMutationResult<EmotiveClaimDetail, Error, EmotiveClaimFaultInput[]> {
  const queryClient = useQueryClient()
  const detailKey = emotiveClaimKeys.detail(id)

  return useMutation<EmotiveClaimDetail, Error, EmotiveClaimFaultInput[]>({
    mutationFn: (faults) =>
      fetchJson<EmotiveClaimDetail>(`/api/emotive-claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faults }),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(detailKey, updated)
    },
    onSettled: () => {
      invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Emotive, id })
    },
  })
}
