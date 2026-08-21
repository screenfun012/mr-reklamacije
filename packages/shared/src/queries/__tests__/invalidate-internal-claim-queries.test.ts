import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { ClaimKind } from '../../enums.js'
import { invalidateInternalClaimQueries } from '../invalidate-internal-claim-queries.js'

describe('invalidateInternalClaimQueries', () => {
  it('invalidates the dashboard summary so the overview counts refresh after a claim mutation', () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Emotive, id: 'claim-1' })

    // The `dashboard` prefix, not `['dashboard','summary']`: since the chart window became a query
    // parameter the summary is cached once per window (internal asks for six months, admin for
    // twenty-four), and naming one window would leave the other showing pre-mutation counts.
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
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

  it('refreshes the per-category counts — a created or re-outcomed claim moves a sidebar badge', () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Emotive, id: 'claim-1' })

    expect(spy).toHaveBeenCalledWith({ queryKey: ['claims', 'category-counts'] })
  })

  it('invalidates the claim attachment list so a colleague upload/delete refreshes the Photos tab', () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Domace, id: 'claim-7' })

    expect(spy).toHaveBeenCalledWith({ queryKey: ['attachments', 'list', 'domace', 'claim-7'] })
  })

  it('invalidates the mr-registry lookup so the create-form duplicate warning sees a new/removed MR', () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Emotive, id: 'claim-1' })

    expect(spy).toHaveBeenCalledWith({ queryKey: ['mr-registry'] })
  })
})
