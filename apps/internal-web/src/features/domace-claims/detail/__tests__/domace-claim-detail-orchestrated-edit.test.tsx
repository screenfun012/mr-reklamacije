import {
  ClaimDetailTab,
  ClaimKind,
  ClaimOutcome,
  domaceClaimDetailOptions,
  claimCategoriesReferenceOptions,
  engineManufacturersReferenceOptions,
  employeesReferenceOptions,
  engineTypesReferenceOptions,
  type ClaimCategoryListItem,
  type DomaceClaimDetail,
  type EngineManufacturerListItem,
  type EngineTypeListItem,
} from '@mr/shared'
import { m, setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DomaceClaimDetailView } from '../domace-claim-detail.js'

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

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    getRouteApi: () => ({
      useRouteContext: () => ({
        authSession: {
          user: {
            permissions: ['domace_claims.update', 'domace_claims.change_outcome'],
          },
        },
      }),
    }),
  }
})

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
    category: { id: CATEGORY_ID, code: 'REMONT_MOTORA', name: 'Generalni remont motora' },
    engineCode: null,
    dateOfClaim: '2026-05-01',
    mrNumber: 'MR-1/26',
    dateOfFinish: null,
    employeeId: null,
    employeeName: null,
    outcome: ClaimOutcome.Accepted,
    claimYear: 2026,
    invoiceNumber: null,
    originalInvoiceAmount: null,
    partsAmount: null,
    laborAmount: null,
    totalAmount: 1000,
    createdAt: '2026-05-01T10:00:00.000Z',
    internalNotes: 'Initial note',
    inspectionReport: null,
    updatedBy: null,
    updatedAt: '2026-05-02T10:00:00.000Z',
    faults: [],
    findings: [],
    ...overrides,
  }
}

async function renderDetail(claim: DomaceClaimDetail): Promise<void> {
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
  client.setQueryData(claimCategoriesReferenceOptions({ activeOnly: true }).queryKey, CATEGORIES)
  client.setQueryData(employeesReferenceOptions({ activeOnly: true }).queryKey, [])

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <DomaceClaimDetailView id={CLAIM_ID} tab={ClaimDetailTab.Pregled} onTabChange={vi.fn()} />
    </QueryClientProvider>
  )

  // The overview carries links now (the attachments card opens the Prilozi tab), and a <Link>
  // outside a router throws — the screen has always been inside one.
  const rootRoute = createRootRoute({ component: () => node })
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/domace/$id',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
}

describe('DomaceClaimDetailView orchestrated edit', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows overview, findings and inspection-report saves on accepted claims', async () => {
    await renderDetail(makeClaim())

    expect(
      screen.queryByRole('button', { name: m.domace_claims_detail_amount_save() }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_edit() }))

    // Overview + findings + the new client-visible inspection report each save separately.
    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: m.emotive_claims_detail_basic_save() }),
      ).toHaveLength(3)
    })
  })

  it('enters overview edit from the header for accepted claims', async () => {
    await renderDetail(makeClaim())

    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_edit() }))

    // Accepted claims now use the full basic edit — amounts are fields, not a
    // separate repair-cost box.
    expect(screen.getByLabelText(m.domace_claims_create_field_parts_amount())).toBeInTheDocument()
  })

  it('shows the faults edit control on the Kvarovi tab for an accepted claim', () => {
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
    client.setQueryData(employeesReferenceOptions({ activeOnly: true }).queryKey, [])

    const node: ReactElement = (
      <QueryClientProvider client={client}>
        <DomaceClaimDetailView id={CLAIM_ID} tab={ClaimDetailTab.Kvarovi} onTabChange={vi.fn()} />
      </QueryClientProvider>
    )
    render(node)

    expect(
      screen.getByRole('button', { name: m.emotive_claims_detail_faults_edit() }),
    ).toBeInTheDocument()
  })
})
