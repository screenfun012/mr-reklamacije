import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { invalidateInternalSubmissionQueries } from '../invalidate-internal-submission-queries.js'

describe('invalidateInternalSubmissionQueries', () => {
  it('invalidates the inbox list and the pending-count nav badge', () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    invalidateInternalSubmissionQueries(queryClient)

    expect(spy).toHaveBeenCalledWith({ queryKey: ['client-submissions', 'list'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['client-submissions', 'pending-count'] })
  })

  it('also invalidates a specific submission detail when an id is given', () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    invalidateInternalSubmissionQueries(queryClient, 'sub-1')

    expect(spy).toHaveBeenCalledWith({ queryKey: ['client-submissions', 'detail', 'sub-1'] })
  })
})
