import {
  ClaimKind,
  ClaimOutcome,
  domaceClaimDetailOptions,
  type DomaceClaimDetail,
} from '@mr/shared'
import { m, setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DomaceClaimAmountSection } from '../domace-claim-amount-section.js'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'

function makeClaim(
  outcome: DomaceClaimDetail['outcome'],
  totalAmount: number | null,
): DomaceClaimDetail {
  return {
    kind: ClaimKind.Domace,
    id: CLAIM_ID,
    sequenceNumber: 1,
    claimNumber: null,
    customerName: 'Auto Stanić',
    warrantyReport: null,
    engineTypeId: null,
    engineTypeCode: null,
    engineCode: null,
    dateOfClaim: null,
    mrNumber: 'MR-1',
    dateOfFinish: null,
    employeeId: null,
    employeeName: null,
    outcome,
    claimYear: 2026,
    totalAmount,
    createdAt: '2026-05-01T10:00:00.000Z',
    engineTypeManufacturer: null,
    internalNotes: null,
    updatedBy: null,
    updatedAt: '2026-05-02T10:00:00.000Z',
    faults: [],
  }
}

function renderSection(claim: DomaceClaimDetail, canEdit: boolean): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(domaceClaimDetailOptions(CLAIM_ID).queryKey, claim)

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <DomaceClaimAmountSection claim={claim} canEdit={canEdit} />
    </QueryClientProvider>
  )
  render(node)
}

describe('DomaceClaimAmountSection', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing when the claim is pending', () => {
    renderSection(makeClaim(ClaimOutcome.Pending, null), true)
    expect(screen.queryByText(m.domace_claims_detail_section_amount())).not.toBeInTheDocument()
  })

  it('renders nothing when the claim is rejected even if amount exists in data', () => {
    renderSection(makeClaim(ClaimOutcome.Rejected, 1500), true)
    expect(screen.queryByText(m.domace_claims_detail_section_amount())).not.toBeInTheDocument()
  })

  it('shows the amount editor on an accepted claim and saves via the amount endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeClaim(ClaimOutcome.Accepted, 2500),
    })
    vi.stubGlobal('fetch', fetchSpy)

    renderSection(makeClaim(ClaimOutcome.Accepted, null), true)

    expect(screen.getByText(m.domace_claims_detail_section_amount())).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(m.domace_claims_detail_field_repair_cost()), {
      target: { value: '2500' },
    })
    fireEvent.click(screen.getByRole('button', { name: m.domace_claims_detail_amount_save() }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain(`/api/domace-claims/${CLAIM_ID}/amount`)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ totalAmount: 2500 })
  })
})
