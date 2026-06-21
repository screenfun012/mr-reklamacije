import { claimKeys, domaceClaimKeys, type DomaceClaimDetail } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useChangeDomaceClaimOutcome } from '../use-change-domace-claim-outcome.js'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'

const BASE_DETAIL: DomaceClaimDetail = {
  kind: 'domace',
  id: CLAIM_ID,
  sequenceNumber: 1,
  claimNumber: null,
  customerName: 'Auto Stanić',
  warrantyReport: null,
  mrNumber: null,
  engineTypeId: null,
  engineTypeCode: null,
  engineCode: null,
  engineTypeManufacturer: null,
  dateOfClaim: '2026-04-17',
  dateOfFinish: null,
  employeeId: null,
  employeeName: null,
  outcome: 'pending',
  claimYear: 2026,
  totalAmount: null,
  internalNotes: null,
  createdAt: '2026-04-17T10:00:00.000Z',
  updatedBy: null,
  updatedAt: '2026-04-17T10:00:00.000Z',
  faults: [],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useChangeDomaceClaimOutcome', () => {
  it.each(['accepted', 'rejected'] as const)(
    'invalidates unified and domace list keys after %s',
    async (outcome) => {
      const serverDetail: DomaceClaimDetail = {
        ...BASE_DETAIL,
        outcome,
        updatedAt: '2026-06-15T20:00:00.000Z',
      }
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => serverDetail,
        }),
      )

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      })
      const detailKey = domaceClaimKeys.detail(CLAIM_ID)
      queryClient.setQueryData<DomaceClaimDetail>(detailKey, BASE_DETAIL)
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const wrapper = ({ children }: { children: ReactNode }): React.ReactElement => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useChangeDomaceClaimOutcome(CLAIM_ID), { wrapper })

      act(() => {
        result.current.mutate(outcome)
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: domaceClaimKeys.lists() })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: claimKeys.lists() })
    },
  )
})
