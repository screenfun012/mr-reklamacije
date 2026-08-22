import {
  ClaimKind,
  domaceClaimKeys,
  emotiveClaimKeys,
  fetchJson,
  invalidateInternalClaimQueries,
  type ClaimCategoryFieldValues,
} from '@mr/shared'
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

/**
 * Saves ONLY the category's answers.
 *
 * Every editor on the claim screen sends its own part (CLAUDE.md §2) — the whole point of this
 * one is that writing down what failed must not mean opening the form that edits the MR number,
 * the dates and the fault rows. The server takes the key on its own and leaves the rest alone.
 */
export function useSaveCategoryFieldValues(
  kind: ClaimKind,
  id: string,
): UseMutationResult<unknown, Error, ClaimCategoryFieldValues> {
  const queryClient = useQueryClient()
  const path = kind === ClaimKind.Emotive ? 'emotive-claims' : 'domace-claims'

  return useMutation<unknown, Error, ClaimCategoryFieldValues>({
    mutationFn: (categoryFieldValues) =>
      fetchJson<unknown>(`/api/${path}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryFieldValues }),
      }),
    onSuccess: (updated) => {
      const key =
        kind === ClaimKind.Emotive ? emotiveClaimKeys.detail(id) : domaceClaimKeys.detail(id)
      queryClient.setQueryData(key, updated)
    },
    onSettled: () => {
      invalidateInternalClaimQueries(queryClient, { kind, id })
    },
  })
}
