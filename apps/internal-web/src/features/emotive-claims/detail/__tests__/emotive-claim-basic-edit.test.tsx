import {
  ClaimKind,
  ClaimOutcome,
  CustomerKind,
  customersReferenceOptions,
  claimCategoriesReferenceOptions,
  departmentsReferenceOptions,
  externalPartiesReferenceOptions,
  assignedWorkerReferenceOptions,
  employeesReferenceOptions,
  engineManufacturersReferenceOptions,
  engineTypesReferenceOptions,
  type ClaimCategoryListItem,
  type CustomerListItem,
  type EmotiveClaimDetail,
  type EngineManufacturerListItem,
  type EngineTypeListItem,
} from '@mr/shared'
import { m, setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EmotiveClaimBasicSection } from '../emotive-claim-basic-section.js'
import { EmotiveClaimDataEdit } from '../emotive-claim-data-edit.js'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'
const CUSTOMER_ID = '55555555-5555-4555-8555-555555555555'
const ENGINE_TYPE_ID = '66666666-6666-4666-8666-666666666666'
const MANUFACTURER_ID = '77777777-7777-4777-8777-777777777777'
const CATEGORY_ID = '99999999-9999-4999-8999-999999999999'

const CUSTOMERS: CustomerListItem[] = [
  {
    id: CUSTOMER_ID,
    name: 'Auto Stanić',
    kind: CustomerKind.EmotivePartner,
    country: 'RS',
    city: 'Beograd',
    isActive: true,
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
    usageCount: 3,
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

const LEGACY_ENGINE_TYPE_ID = '88888888-8888-4888-8888-888888888888'
const LEGACY_ENGINE_TYPE_CODE = 'ENG-1782'

function makeLegacyOrphanClaim(): EmotiveClaimDetail {
  return {
    ...makeClaim(),
    manufacturerId: null,
    manufacturerName: null,
    engineTypeId: LEGACY_ENGINE_TYPE_ID,
    engineTypeCode: LEGACY_ENGINE_TYPE_CODE,
    engineTypeManufacturer: null,
  } as unknown as EmotiveClaimDetail
}

function renderLegacyOrphanSection(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(
    customersReferenceOptions({ kind: CustomerKind.EmotivePartner, activeOnly: true }).queryKey,
    CUSTOMERS,
  )
  client.setQueryData(
    engineManufacturersReferenceOptions({ activeOnly: true }).queryKey,
    MANUFACTURERS,
  )
  client.setQueryData(claimCategoriesReferenceOptions({ activeOnly: true }).queryKey, CATEGORIES)
  client.setQueryData(employeesReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(assignedWorkerReferenceOptions().queryKey, [])
  client.setQueryData(departmentsReferenceOptions().queryKey, [])
  client.setQueryData(externalPartiesReferenceOptions().queryKey, [])

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <EmotiveClaimDataEdit claim={makeLegacyOrphanClaim()} onDone={vi.fn()} />
    </QueryClientProvider>
  )
  render(node)
}

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
    manufacturerId: MANUFACTURER_ID,
    manufacturerName: 'Mercedes-Benz',
    category: { id: CATEGORY_ID, code: 'REMONT_MOTORA', name: 'Generalni remont motora' },
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

/**
 * Editing is no longer a mode inside the card: "Izmeni podatke" in the title row swaps the
 * read-only cards for {@link EmotiveClaimDataEdit}, so the two are rendered separately here.
 */
function renderSection(canEdit: boolean, onDone: () => void = vi.fn()): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(
    customersReferenceOptions({ kind: CustomerKind.EmotivePartner, activeOnly: true }).queryKey,
    CUSTOMERS,
  )
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
  client.setQueryData(departmentsReferenceOptions().queryKey, [])
  client.setQueryData(externalPartiesReferenceOptions().queryKey, [])

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      {canEdit ? (
        <EmotiveClaimDataEdit claim={makeClaim()} onDone={onDone} />
      ) : (
        <EmotiveClaimBasicSection claim={makeClaim()} />
      )}
    </QueryClientProvider>
  )
  render(node)
}

/**
 * PATCH calls only. The edit form also reads the category's field catalogue, so counting every
 * fetch would count a read as a save.
 */
function patchCalls(fetchSpy: ReturnType<typeof vi.fn>): unknown[] {
  return fetchSpy.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
  )
}

describe('the claim data card and its edit', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the read-only card with nothing to save on it', () => {
    renderSection(false)

    expect(
      screen.queryByRole('button', { name: m.emotive_claims_detail_basic_save() }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('MR-1/26')).toBeInTheDocument()
  })

  it('shows Razlog label in read-only detail', () => {
    renderSection(false)

    expect(screen.getByText(m.emotive_claims_create_field_warranty_report())).toBeInTheDocument()
    expect(screen.getByText('Report text')).toBeInTheDocument()
  })

  it('saves an updated Razlog via PATCH and closes the edit', async () => {
    const onDone = vi.fn()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...makeClaim(), warrantyReport: 'Ažuriran razlog' }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    renderSection(true, onDone)

    fireEvent.change(screen.getByLabelText(m.emotive_claims_create_field_warranty_report()), {
      target: { value: 'Ažuriran razlog' },
    })
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }))

    await waitFor(() => expect(patchCalls(fetchSpy)).toHaveLength(1))

    const body = JSON.parse(String((patchCalls(fetchSpy)[0] as [string, RequestInit])[1].body)) as {
      warrantyReport: string
    }
    expect(body.warrantyReport).toBe('Ažuriran razlog')

    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('saves an added engine code via PATCH and closes the edit', async () => {
    const onDone = vi.fn()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...makeClaim(), engineCode: 'NEW-CODE' }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    renderSection(true, onDone)

    fireEvent.change(screen.getByLabelText(m.emotive_claims_create_field_engine_code()), {
      target: { value: 'NEW-CODE' },
    })
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }))

    await waitFor(() => expect(patchCalls(fetchSpy)).toHaveLength(1))

    const [url, init] = patchCalls(fetchSpy)[0] as [string, RequestInit]
    expect(String(url)).toContain(`/api/emotive-claims/${CLAIM_ID}`)
    expect(init.method).toBe('PATCH')
    const body = JSON.parse(String(init.body)) as { engineCode: string; mrNumber: string }
    expect(body.engineCode).toBe('NEW-CODE')
    expect(body.mrNumber).toBe('MR-1/26')

    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('blocks the PATCH and stays in edit mode when a required field is cleared', () => {
    const onDone = vi.fn()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    renderSection(true, onDone)

    // exact: false — the required marker (" *") is part of the label now.
    fireEvent.change(
      screen.getByLabelText(m.emotive_claims_create_field_mr_number(), { exact: false }),
      {
        target: { value: '' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }))

    // Client-side guard: no network call, and we remain in edit mode (Save still shown).
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }),
    ).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('shows legacy engine type when manufacturer is missing and preserves it on save', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeLegacyOrphanClaim(),
    })
    vi.stubGlobal('fetch', fetchSpy)

    renderLegacyOrphanSection()

    expect(
      screen.getByRole('combobox', { name: m.emotive_claims_create_field_engine_type() }),
    ).toHaveTextContent(LEGACY_ENGINE_TYPE_CODE)
    expect(
      screen.getByRole('combobox', { name: m.emotive_claims_create_field_engine_type() }),
    ).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }))

    await waitFor(() => expect(patchCalls(fetchSpy)).toHaveLength(1))

    const body = JSON.parse(String((patchCalls(fetchSpy)[0] as [string, RequestInit])[1].body)) as {
      engineTypeId: string
      manufacturerId: string | null
    }
    expect(body.engineTypeId).toBe(LEGACY_ENGINE_TYPE_ID)
    expect(body.manufacturerId).toBeNull()
  })
})
