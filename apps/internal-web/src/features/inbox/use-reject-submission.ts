import { invalidateInternalSubmissionQueries, rejectClientSubmission } from '@mr/shared'
import { m } from '@mr/i18n'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { showInternalToast } from '~/lib/internal-toast'

/**
 * Dismisses a pending submission with an optional internal reason (not shown to the
 * client). On success it refreshes the Inbox list + badge and returns to /pristiglo.
 */
export function useRejectSubmission(submissionId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (reason: string | undefined): Promise<void> =>
      rejectClientSubmission(submissionId, reason),
    onSuccess: async () => {
      showInternalToast(m.internal_inbox_reject_success())
      invalidateInternalSubmissionQueries(queryClient, submissionId)
      await navigate({ to: '/pristiglo', search: { page: 1 } })
    },
  })
}
