import {
  ClaimDetailTab,
  ClaimKind,
  ClaimOutcome,
  CustomerKind,
  customersReferenceOptions,
  claimCategoriesReferenceOptions,
  emotiveClaimDetailOptions,
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

import { EmotiveClaimDetailView } from '../emotive-claim-detail.js'

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

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    getRouteApi: () => ({
      useRouteContext: () => ({
        authSession: {
          user: {
            permissions: ['emotive_claims.update', 'emotive_claims.change_outcome'],
          },
        },
      }),
    }),
  }
})

function makeClaim(overrides: Partial<EmotiveClaimDetail> = {}): EmotiveClaimDetail {
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
    outcome: ClaimOutcome.Accepted,
    claimYear: 2026,
    customerId: CUSTOMER_ID,
    customerName: 'Auto Stanić',
    internalNotes: 'Initial note',
    updatedBy: null,
    updatedAt: '2026-05-02T10:00:00.000Z',
    createdAt: '2026-05-01T10:00:00.000Z',
    faults: [],
    ...overrides,
  } as unknown as EmotiveClaimDetail
}

function renderDetail(
  claim: EmotiveClaimDetail,
  tab: ClaimDetailTab = ClaimDetailTab.Pregled,
): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(emotiveClaimDetailOptions(CLAIM_ID).queryKey, claim)
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

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <EmotiveClaimDetailView id={CLAIM_ID} tab={tab} onTabChange={vi.fn()} />
    </QueryClientProvider>
  )
  render(node)
}

describe('EmotiveClaimDetailView orchestrated edit', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows overview, findings and inspection-report saves on accepted claims', async () => {
    renderDetail(makeClaim())

    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_edit() }))

    // Basic overview + findings + inspection report each save separately.
    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: m.emotive_claims_detail_basic_save() }),
      ).toHaveLength(3)
    })
  })

  it('shows the faults edit control on the Kvarovi tab for an accepted claim', () => {
    renderDetail(makeClaim(), ClaimDetailTab.Kvarovi)

    expect(
      screen.getByRole('button', { name: m.emotive_claims_detail_faults_edit() }),
    ).toBeInTheDocument()
  })
})
