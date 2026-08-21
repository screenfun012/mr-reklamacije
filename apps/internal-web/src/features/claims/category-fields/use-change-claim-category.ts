import {
  ClaimKind,
  domaceClaimKeys,
  emotiveClaimKeys,
  fetchJson,
  invalidateInternalClaimQueries,
  type ClaimKind as ClaimKindValue,
} from '@mr/shared'
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

/**
 * Moves a saved claim to another kind of work — the one field, on its own.
 *
 * A partial PATCH on purpose: the basic-fields save sends the whole form, and reusing it here
 * would make correcting a category depend on every other field still being valid. The server
 * takes `categoryId` alone, keeps what was answered under the old category, and marks the claim
 * if the new one asks for something it has not got (handoff „promena kategorije").
 */
export function useChangeClaimCategory(
  kind: ClaimKindValue,
  id: string,
): UseMutationResult<unknown, Error, string> {
  const queryClient = useQueryClient()
  const isEmotive = kind === ClaimKind.Emotive
  const detailKey = isEmotive ? emotiveClaimKeys.detail(id) : domaceClaimKeys.detail(id)
  const path = isEmotive ? `/api/emotive-claims/${id}` : `/api/domace-claims/${id}`

  return useMutation<unknown, Error, string>({
    mutationFn: (categoryId) =>
      fetchJson<unknown>(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(detailKey, updated)
    },
    onSettled: () => {
      invalidateInternalClaimQueries(queryClient, { kind, id })
    },
  })
}
