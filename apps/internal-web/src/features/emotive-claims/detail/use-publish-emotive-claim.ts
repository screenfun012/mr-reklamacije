import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import {
  ClaimKind,
  fetchJson,
  invalidateInternalClaimQueries,
  type EmotiveClaimDetail,
} from '@mr/shared'

/**
 * Publishes the claim's current outcome/status to the client portal
 * ("Objavi klijentu"). Unlike `useChangeEmotiveClaimOutcome`, this is
 * invalidate-only — no optimistic write. Publishing is a deliberate, one-way
 * decision (not a routine toggle), so the UI waits for the server's
 * confirmed `publishedAt`, same as the SSE contract (signal, then refetch).
 */
export function usePublishEmotiveClaim(
  id: string,
): UseMutationResult<EmotiveClaimDetail, Error, void, unknown> {
  const queryClient = useQueryClient()

  return useMutation<EmotiveClaimDetail, Error, void, unknown>({
    mutationFn: () =>
      fetchJson<EmotiveClaimDetail>(`/api/emotive-claims/${id}/publish`, {
        method: 'POST',
      }),
    onSettled: () => {
      invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Emotive, id })
    },
  })
}
