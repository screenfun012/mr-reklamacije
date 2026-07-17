import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { ClaimKind } from '../../enums.js'
import { invalidateInternalClaimQueries } from '../invalidate-internal-claim-queries.js'

describe('invalidateInternalClaimQueries', () => {
  it('invalidates the dashboard summary so the overview counts refresh after a claim mutation', () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Emotive, id: 'claim-1' })

    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'summary'] })
  })

  it('still invalidates the unified list, the kind list and detail, and statistics', () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Emotive, id: 'claim-1' })

    expect(spy).toHaveBeenCalledWith({ queryKey: ['claims', 'list'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['emotive-claims', 'list'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['emotive-claims', 'detail', 'claim-1'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['statistics'] })
  })
})
