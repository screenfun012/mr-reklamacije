import {
  ClaimKind,
  ClaimOutcome,
  CustomerKind,
  customersReferenceOptions,
  engineTypesReferenceOptions,
  type CustomerListItem,
  type EmotiveClaimDetail,
  type EngineTypeListItem,
} from '@mr/shared'
import { m, setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EmotiveClaimBasicSection } from '../emotive-claim-basic-section.js'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'
const CUSTOMER_ID = '55555555-5555-4555-8555-555555555555'
const ENGINE_TYPE_ID = '66666666-6666-4666-8666-666666666666'

const CUSTOMERS: CustomerListItem[] = [
  {
    id: CUSTOMER_ID,
    name: 'Auto Stanić',
    kind: CustomerKind.EmotivePartner,
    country: 'RS',
    city: 'Beograd',
    isActive: true,
  },
]
const ENGINE_TYPES: EngineTypeListItem[] = [
  {
    id: ENGINE_TYPE_ID,
    code: 'OM651',
    manufacturer: 'Mercedes',
    displacementCc: 2143,
    isActive: true,
    usageCount: 3,
  },
]

function makeClaim(): EmotiveClaimDetail {
  return {
    kind: ClaimKind.Emotive,
    id: CLAIM_ID,
    sequenceNumber: 1,
    claimNumber: 'CLM-1',
    warrantyReport: 'Report text',
    engineTypeId: ENGINE_TYPE_ID,
    engineTypeCode: 'OM651',
    engineTypeManufacturer: 'Mercedes',
    engineCode: null,
    dateOfClaim: '2026-05-01',
    mrNumber: 'MR-1/26',
    dateOfFinish: null,
    employeeId: null,
    employeeName: null,
    sourceId: null,
    sourceCode: null,
    sourceName: null,
    outcome: ClaimOutcome.Pending,
    claimYear: 2026,
    customerId: CUSTOMER_ID,
    customerName: 'Auto Stanić',
    internalNotes: null,
    updatedBy: null,
    updatedAt: '2026-05-02T10:00:00.000Z',
    createdAt: '2026-05-01T10:00:00.000Z',
    faults: [],
  } as unknown as EmotiveClaimDetail
}

function renderSection(canEdit: boolean): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(
    customersReferenceOptions({ kind: CustomerKind.EmotivePartner, activeOnly: true }).queryKey,
    CUSTOMERS,
  )
  client.setQueryData(engineTypesReferenceOptions({ activeOnly: true }).queryKey, ENGINE_TYPES)

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <EmotiveClaimBasicSection claim={makeClaim()} canEdit={canEdit} />
    </QueryClientProvider>
  )
  render(node)
}

describe('EmotiveClaimBasicSection', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders read-only without an edit button when editing is not allowed', () => {
    renderSection(false)

    expect(
      screen.queryByRole('button', { name: m.emotive_claims_detail_basic_edit() }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('MR-1/26')).toBeInTheDocument()
  })

  it('saves an added engine code via PATCH and returns to read-only', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...makeClaim(), engineCode: 'NEW-CODE' }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    renderSection(true)
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_edit() }))

    fireEvent.change(screen.getByLabelText(m.emotive_claims_create_field_engine_code()), {
      target: { value: 'NEW-CODE' },
    })
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain(`/api/emotive-claims/${CLAIM_ID}`)
    expect(init.method).toBe('PATCH')
    const body = JSON.parse(String(init.body)) as { engineCode: string; mrNumber: string }
    expect(body.engineCode).toBe('NEW-CODE')
    expect(body.mrNumber).toBe('MR-1/26')

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: m.emotive_claims_detail_basic_edit() }),
      ).toBeInTheDocument(),
    )
  })

  it('blocks the PATCH and stays in edit mode when a required field is cleared', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    renderSection(true)
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_edit() }))

    fireEvent.change(screen.getByLabelText(m.emotive_claims_create_field_mr_number()), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }))

    // Client-side guard: no network call, and we remain in edit mode (Save still shown).
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: m.emotive_claims_detail_basic_edit() }),
    ).not.toBeInTheDocument()
  })
})
