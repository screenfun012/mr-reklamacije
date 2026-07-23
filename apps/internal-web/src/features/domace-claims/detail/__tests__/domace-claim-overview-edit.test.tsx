import {
  ClaimKind,
  ClaimOutcome,
  domaceClaimDetailOptions,
  assignedWorkerReferenceOptions,
  employeesReferenceOptions,
  engineManufacturersReferenceOptions,
  engineTypesReferenceOptions,
  type DomaceClaimDetail,
  type EngineManufacturerListItem,
  type EngineTypeListItem,
} from '@mr/shared'
import { m, setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DomaceClaimOverviewEdit } from '../domace-claim-overview-edit.js'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'
const ENGINE_TYPE_ID = '66666666-6666-4666-8666-666666666666'
const MANUFACTURER_ID = '77777777-7777-4777-8777-777777777777'

const ENGINE_TYPES: EngineTypeListItem[] = [
  {
    id: ENGINE_TYPE_ID,
    code: 'OM651',
    manufacturerId: MANUFACTURER_ID,
    manufacturerName: 'Mercedes-Benz',
    displacementCc: 2143,
    notes: null,
    isActive: true,
    usageCount: 0,
  },
]

const MANUFACTURERS: EngineManufacturerListItem[] = [
  {
    id: MANUFACTURER_ID,
    code: 'MERCEDES',
    name: 'Mercedes-Benz',
    sortOrder: 1,
    isActive: true,
  },
]

function makeClaim(overrides: Partial<DomaceClaimDetail> = {}): DomaceClaimDetail {
  return {
    kind: ClaimKind.Domace,
    id: CLAIM_ID,
    sequenceNumber: 1,
    claimNumber: 'CLM-1',
    customerName: 'Auto Stanić',
    warrantyReport: 'Report text',
    engineTypeId: ENGINE_TYPE_ID,
    engineTypeCode: 'OM651',
    engineTypeManufacturer: 'Mercedes',
    manufacturerId: MANUFACTURER_ID,
    manufacturerName: 'Mercedes-Benz',
    engineCode: null,
    dateOfClaim: '2026-05-01',
    mrNumber: 'MR-1/26',
    dateOfFinish: null,
    employeeId: null,
    employeeName: null,
    outcome: ClaimOutcome.Pending,
    claimYear: 2026,
    totalAmount: null,
    createdAt: '2026-05-01T10:00:00.000Z',
    internalNotes: null,
    updatedBy: null,
    updatedAt: '2026-05-02T10:00:00.000Z',
    faults: [],
    ...overrides,
  }
}

function renderOverviewEdit(
  claim: DomaceClaimDetail,
  onDone: () => void = vi.fn(),
): ReturnType<typeof vi.fn> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(domaceClaimDetailOptions(CLAIM_ID).queryKey, claim)
  client.setQueryData(
    engineTypesReferenceOptions({ activeOnly: true, manufacturerId: MANUFACTURER_ID }).queryKey,
    ENGINE_TYPES,
  )
  client.setQueryData(
    engineManufacturersReferenceOptions({ activeOnly: true }).queryKey,
    MANUFACTURERS,
  )
  client.setQueryData(employeesReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(assignedWorkerReferenceOptions().queryKey, [])

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <DomaceClaimOverviewEdit claim={claim} onDone={onDone} />
    </QueryClientProvider>
  )
  render(node)
  return onDone
}

describe('DomaceClaimOverviewEdit', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a single save and cancel footer for pending basic edits', () => {
    renderOverviewEdit(makeClaim())

    expect(
      screen.getAllByRole('button', { name: m.emotive_claims_detail_basic_save() }),
    ).toHaveLength(1)
    expect(
      screen.getAllByRole('button', { name: m.emotive_claims_detail_basic_cancel() }),
    ).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: m.domace_claims_detail_amount_save() }),
    ).not.toBeInTheDocument()
  })

  it('saves pending basic fields via PATCH and calls onDone', async () => {
    const onDone = vi.fn()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...makeClaim(), customerName: 'Novi Kupac' }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    renderOverviewEdit(makeClaim(), onDone)
    fireEvent.change(screen.getByLabelText(m.domace_claims_create_field_customer_name()), {
      target: { value: 'Novi Kupac' },
    })
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toBe(`/api/domace-claims/${CLAIM_ID}`)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toMatchObject({ customerName: 'Novi Kupac' })
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
  })

  it('renders read-only basic fields and a single footer for accepted amount edits', () => {
    renderOverviewEdit(makeClaim({ outcome: ClaimOutcome.Accepted, totalAmount: 1500 }))

    expect(screen.getByText('Auto Stanić')).toBeInTheDocument()
    expect(screen.getByLabelText(m.domace_claims_detail_field_repair_cost())).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: m.emotive_claims_detail_basic_save() }),
    ).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: m.domace_claims_detail_amount_save() }),
    ).not.toBeInTheDocument()
  })

  it('saves accepted amount via the amount endpoint and calls onDone', async () => {
    const onDone = vi.fn()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeClaim({ outcome: ClaimOutcome.Accepted, totalAmount: 2500 }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    renderOverviewEdit(makeClaim({ outcome: ClaimOutcome.Accepted, totalAmount: null }), onDone)
    fireEvent.change(screen.getByLabelText(m.domace_claims_detail_field_repair_cost()), {
      target: { value: '2500' },
    })
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain(`/api/domace-claims/${CLAIM_ID}/amount`)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ totalAmount: 2500 })
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
  })

  it('calls onDone on cancel without saving', () => {
    const onDone = vi.fn()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    renderOverviewEdit(makeClaim(), onDone)
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_cancel() }))

    expect(onDone).toHaveBeenCalledTimes(1)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('renders full basic edit (not read-only) for a rejected claim', () => {
    renderOverviewEdit(makeClaim({ outcome: ClaimOutcome.Rejected }))

    expect(screen.getByLabelText(m.domace_claims_create_field_customer_name())).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: m.emotive_claims_detail_basic_save() }),
    ).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: m.domace_claims_detail_amount_save() }),
    ).not.toBeInTheDocument()
  })

  it('saves rejected basic fields via PATCH and calls onDone', async () => {
    const onDone = vi.fn()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...makeClaim({ outcome: ClaimOutcome.Rejected }),
        customerName: 'Novi Kupac',
      }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    renderOverviewEdit(makeClaim({ outcome: ClaimOutcome.Rejected }), onDone)
    fireEvent.change(screen.getByLabelText(m.domace_claims_create_field_customer_name()), {
      target: { value: 'Novi Kupac' },
    })
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toBe(`/api/domace-claims/${CLAIM_ID}`)
    expect(init.method).toBe('PATCH')
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
  })
})
