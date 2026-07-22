import type { QueryClient } from '@tanstack/react-query'

import { clientSubmissionKeys } from './client-submissions.js'

/**
 * Invalidate the internal Pristiglo inbox views a submission mutation affects —
 * the SINGLE set the convert/reject hooks and the SSE submission handler route
 * through, so none can drift and forget the nav-badge count: the list (every
 * page), the pending-count badge and, when a specific submission changed, its
 * detail. Signal-only: never writes data into the cache.
 */
export function invalidateInternalSubmissionQueries(
  queryClient: QueryClient,
  submissionId?: string,
): void {
  void queryClient.invalidateQueries({ queryKey: clientSubmissionKeys.lists() })
  if (submissionId !== undefined) {
    void queryClient.invalidateQueries({ queryKey: clientSubmissionKeys.detail(submissionId) })
  }
}
