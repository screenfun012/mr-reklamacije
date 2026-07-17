import {
  CLAIM_DETAIL_DEFAULT_SEARCH,
  ClaimKind,
  convertClientSubmission,
  invalidateInternalClaimQueries,
  invalidateInternalSubmissionQueries,
  type EmotiveClaimCreateInput,
  type EmotiveClaimDetail,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { showInternalToast } from '~/lib/internal-toast'

/**
 * Converts a pending submission into an EMOTIVE claim via the dedicated convert
 * endpoint (create + attachment carry-over + status flip are one server-side
 * transaction — NOT the plain create endpoint). On success it refreshes the Inbox,
 * claim lists and statistics, then navigates to the created claim.
 */
export function useConvertSubmission(submissionId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (input: EmotiveClaimCreateInput): Promise<EmotiveClaimDetail> =>
      convertClientSubmission(submissionId, input),
    onSuccess: async (created) => {
      showInternalToast(m.internal_inbox_convert_success({ mrNumber: created.mrNumber }))
      invalidateInternalSubmissionQueries(queryClient, submissionId)
      invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Emotive, id: created.id })
      await navigate({
        to: '/reklamacije/emotive/$id',
        params: { id: created.id },
        search: CLAIM_DETAIL_DEFAULT_SEARCH,
      })
    },
  })
}
