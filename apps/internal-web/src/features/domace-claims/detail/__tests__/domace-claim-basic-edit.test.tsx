import {
  ClaimKind,
  ClaimOutcome,
  domaceClaimDetailOptions,
  claimCategoriesReferenceOptions,
  assignedWorkerReferenceOptions,
  employeesReferenceOptions,
  engineManufacturersReferenceOptions,
  engineTypesReferenceOptions,
  type ClaimCategoryListItem,
  type DomaceClaimDetail,
  type EngineManufacturerListItem,
  type EngineTypeListItem,
} from '@mr/shared'
import { m, setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DomaceClaimBasicSection } from '../domace-claim-basic-section.js'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'
const ENGINE_TYPE_ID = '66666666-6666-4666-8666-666666666666'
const MANUFACTURER_ID = '77777777-7777-4777-8777-777777777777'
const CATEGORY_ID = '99999999-9999-4999-8999-999999999999'

const CATEGORIES: ClaimCategoryListItem[] = [
  {
    id: CATEGORY_ID,
    code: 'REMONT_MOTORA',
    name: 'Generalni remont motora',
    sortOrder: 10,
    isActive: true,
    deactivatedAt: null,
    usageCount: 0,
  },
]

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

function makeClaim(): DomaceClaimDetail {
  return {
    kind: ClaimKind.Domace,
    id: CLAIM_ID,
    sequenceNumber: 1,
    claimNumber: 'CLM-1',
    customerName: 'Auto Stanić',
    warrantyReport: 'Report text',
    category: { id: CATEGORY_ID, code: 'REMONT_MOTORA', name: 'Generalni remont motora' },
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
    invoiceNumber: null,
    originalInvoiceAmount: null,
    partsAmount: null,
    laborAmount: null,
    totalAmount: null,
    createdAt: '2026-05-01T10:00:00.000Z',
    internalNotes: null,
    inspectionReport: null,
    updatedBy: null,
    updatedAt: '2026-05-02T10:00:00.000Z',
    faults: [],
    findings: [],
  }
}

function renderSection(canEdit: boolean): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(domaceClaimDetailOptions(CLAIM_ID).queryKey, makeClaim())
  client.setQueryData(
    engineTypesReferenceOptions({ activeOnly: true, manufacturerId: MANUFACTURER_ID }).queryKey,
    ENGINE_TYPES,
  )
  client.setQueryData(
    engineManufacturersReferenceOptions({ activeOnly: true }).queryKey,
    MANUFACTURERS,
  )
  client.setQueryData(claimCategoriesReferenceOptions({ activeOnly: true }).queryKey, CATEGORIES)
  client.setQueryData(employeesReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(assignedWorkerReferenceOptions().queryKey, [])

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <DomaceClaimBasicSection claim={makeClaim()} canEdit={canEdit} />
    </QueryClientProvider>
  )
  render(node)
}

const DEACTIVATED_CATEGORY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function makeDeactivatedCategoryClaim(): DomaceClaimDetail {
  return {
    ...makeClaim(),
    category: { id: DEACTIVATED_CATEGORY_ID, code: 'UGASENA', name: 'Ugašena kategorija' },
  }
}

function renderDeactivatedCategorySection(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const claim = makeDeactivatedCategoryClaim()
  client.setQueryData(domaceClaimDetailOptions(CLAIM_ID).queryKey, claim)
  client.setQueryData(
    engineTypesReferenceOptions({ activeOnly: true, manufacturerId: MANUFACTURER_ID }).queryKey,
    ENGINE_TYPES,
  )
  client.setQueryData(
    engineManufacturersReferenceOptions({ activeOnly: true }).queryKey,
    MANUFACTURERS,
  )
  // Active catalog no longer contains the claim's own category — it was switched off.
  client.setQueryData(claimCategoriesReferenceOptions({ activeOnly: true }).queryKey, CATEGORIES)
  client.setQueryData(employeesReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(assignedWorkerReferenceOptions().queryKey, [])

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <DomaceClaimBasicSection claim={claim} canEdit={true} />
    </QueryClientProvider>
  )
  render(node)
}

describe('DomaceClaimBasicSection', () => {
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
    expect(screen.getByText('Auto Stanić')).toBeInTheDocument()
  })

  it('saves a customer name change via PATCH and returns to read-only', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...makeClaim(), customerName: 'Novi Kupac' }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    renderSection(true)
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_edit() }))
    fireEvent.change(screen.getByLabelText(m.domace_claims_create_field_customer_name()), {
      target: { value: 'Novi Kupac' },
    })
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toMatchObject({ customerName: 'Novi Kupac' })
  })

  it('keeps the current category selectable even if it has since been deactivated', async () => {
    const user = userEvent.setup()
    renderDeactivatedCategorySection()
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_edit() }))

    await user.click(screen.getByRole('combobox', { name: m.field_claim_category() }))

    expect(screen.getByRole('option', { name: 'Ugašena kategorija' })).toBeInTheDocument()
  })
})
