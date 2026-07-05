import { m } from '@mr/i18n'
import { ClaimKind, invalidateInternalClaimQueries, type ClaimListItem } from '@mr/shared'
import { toast } from '@mr/ui'
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import { showInternalToast } from '~/lib/internal-toast'

export type DeletableClaim = Pick<ClaimListItem, 'kind' | 'id'>

/**
 * Soft-deletes a claim from the unified list. Routes to the kind's own endpoint
 * (each gated by its `<kind>_claims.delete` permission server-side). On settle
 * it refreshes the same views a claim mutation touches — and the SSE claim
 * event carries the deletion to every other connected user.
 */
export function useDeleteClaim(): UseMutationResult<void, Error, DeletableClaim, unknown> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, DeletableClaim, unknown>({
    mutationFn: async (claim) => {
      const resource = claim.kind === ClaimKind.Domace ? 'domace-claims' : 'emotive-claims'
      const response = await fetch(`/api/${resource}/${claim.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error('Delete failed')
      }
    },
    onSuccess: () => {
      showInternalToast(m.claims_delete_success())
    },
    onError: () => {
      toast.error(m.claims_delete_error())
    },
    onSettled: (_data, _error, claim) => {
      invalidateInternalClaimQueries(queryClient, { kind: claim.kind, id: claim.id })
    },
  })
}
