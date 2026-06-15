import { emotiveClaimKeys, type EmotiveClaimDetail } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useChangeEmotiveClaimOutcome } from '../use-change-emotive-claim-outcome.js'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'

const BASE_DETAIL: EmotiveClaimDetail = {
  kind: 'emotive',
  id: CLAIM_ID,
  sequenceNumber: 1,
  claimNumber: null,
  warrantyReport: 'Test',
  engineTypeId: '22222222-2222-4222-8222-222222222222',
  engineTypeCode: 'BMW N47D20D',
  engineCode: null,
  dateOfClaim: '2026-04-17',
  mrNumber: '5376/26',
  dateOfFinish: null,
  employeeId: null,
  employeeName: null,
  sourceId: null,
  outcome: 'pending',
  claimYear: 2026,
  customerId: null,
  customerName: null,
  createdAt: '2026-04-17T10:00:00.000Z',
  engineTypeManufacturer: null,
  sourceCode: null,
  sourceName: null,
  internalNotes: null,
  updatedBy: null,
  updatedAt: '2026-04-17T10:00:00.000Z',
  faults: [],
}

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const detailKey = emotiveClaimKeys.detail(CLAIM_ID)
  queryClient.setQueryData<EmotiveClaimDetail>(detailKey, BASE_DETAIL)

  const wrapper = ({ children }: { children: ReactNode }): React.ReactElement => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  const { result } = renderHook(() => useChangeEmotiveClaimOutcome(CLAIM_ID), { wrapper })
  const cached = (): EmotiveClaimDetail | undefined =>
    queryClient.getQueryData<EmotiveClaimDetail>(detailKey)

  return { result, cached }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useChangeEmotiveClaimOutcome', () => {
  it('writes the new outcome into the cache before the request resolves', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve
          }),
      ),
    )

    const { result, cached } = createHarness()

    act(() => {
      result.current.mutate('accepted')
    })

    await waitFor(() => {
      expect(cached()?.outcome).toBe('accepted')
    })

    const serverDetail: EmotiveClaimDetail = {
      ...BASE_DETAIL,
      outcome: 'accepted',
      updatedAt: '2026-06-15T20:00:00.000Z',
    }
    act(() => {
      resolveFetch?.({ ok: true, json: async () => serverDetail })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(cached()).toEqual(serverDetail)
  })

  it('rolls back to the previous outcome when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        statusText: 'fail',
        json: async () => ({}),
      })),
    )

    const { result, cached } = createHarness()

    act(() => {
      result.current.mutate('accepted')
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(cached()?.outcome).toBe('pending')
  })
})
