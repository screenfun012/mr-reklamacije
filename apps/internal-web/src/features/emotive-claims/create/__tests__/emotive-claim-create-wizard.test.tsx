import {
  CustomerKind,
  customersReferenceOptions,
  claimCategoriesReferenceOptions,
  departmentsReferenceOptions,
  assignedWorkerReferenceOptions,
  employeesReferenceOptions,
  engineManufacturersReferenceOptions,
  engineTypesReferenceOptions,
  externalPartiesReferenceOptions,
  type ClaimCategoryListItem,
  type CustomerListItem,
  type EngineManufacturerListItem,
  type EngineTypeListItem,
} from '@mr/shared'
import { m, setLocale } from '@mr/i18n'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  EMOTIVE_CLAIM_FORM_DEFAULTS,
  formValuesToCreateInput,
} from '../emotive-claim-create-schemas.js'
import { EmotiveClaimCreateWizard } from '../emotive-claim-create-wizard.js'

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
const MANUFACTURERS: EngineManufacturerListItem[] = [
  { id: MANUFACTURER_ID, code: 'MERCEDES', name: 'Mercedes-Benz', sortOrder: 1, isActive: true },
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

async function renderWizard(): Promise<void> {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
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
  client.setQueryData(departmentsReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(externalPartiesReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(
    engineTypesReferenceOptions({ activeOnly: true, manufacturerId: MANUFACTURER_ID }).queryKey,
    ENGINE_TYPES,
  )

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <EmotiveClaimCreateWizard />
    </QueryClientProvider>
  )
  const rootRoute = createRootRoute({ component: () => node })
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute]),
    history: createMemoryHistory({ initialEntries: ['/reklamacije/emotive/nova'] }),
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
}

function stubCreatedResponse(): ReturnType<typeof vi.fn> {
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ id: '11111111-1111-4111-8111-111111111111', mrNumber: 'MR-TEST/26' }),
  })
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

function postedToEmotive(fetchSpy: ReturnType<typeof vi.fn>): boolean {
  return fetchSpy.mock.calls.some(([url, init]) => {
    const request = init as RequestInit | undefined
    return String(url).includes('/api/emotive-claims') && request?.method === 'POST'
  })
}

async function completeBasicStepExceptCategory(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.type(
    screen.getByLabelText(m.emotive_claims_create_field_mr_number(), { exact: false }),
    'MR-TEST/26',
  )

  await user.click(screen.getByRole('combobox', { name: m.emotive_claims_create_field_customer() }))
  await user.click(screen.getByRole('option', { name: 'Auto Stanić' }))

  await user.click(
    screen.getByRole('combobox', { name: m.emotive_claims_create_field_manufacturer() }),
  )
  await user.click(screen.getByRole('option', { name: 'Mercedes-Benz' }))

  await user.click(
    screen.getByRole('combobox', { name: m.emotive_claims_create_field_engine_type() }),
  )
  await user.click(screen.getByRole('option', { name: /OM651/ }))

  await user.click(screen.getByRole('button', { name: m.emotive_claims_create_field_date_claim() }))
  await user.click(screen.getByRole('button', { name: /(^|\D)15(\D|$)/ }))
}

async function completeBasicStep(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await completeBasicStepExceptCategory(user)

  await user.click(screen.getByRole('combobox', { name: m.field_claim_category() }))
  await user.click(screen.getByRole('option', { name: 'Generalni remont motora' }))
}

describe('EmotiveClaimCreateWizard', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // A claim can never leave create uncategorised (spec §3.3, categoryId required on
  // create/update). Client-side validation on the basic step blocks the transition
  // to the next step the same way it already blocks a missing customer/engine type.
  it('will not advance from the basic step until a category is chosen', async () => {
    const user = userEvent.setup()
    await renderWizard()

    await completeBasicStepExceptCategory(user)
    await user.click(screen.getByRole('button', { name: m.emotive_claims_create_next() }))

    // Still on the basic step: Back only enables once we have left it.
    expect(screen.getByRole('button', { name: m.emotive_claims_create_back() })).toBeDisabled()
    expect(
      screen.getByRole('combobox', { name: m.emotive_claims_create_field_customer() }),
    ).toBeInTheDocument()
  })

  // Regression: advancing from the faults step to the review step must NOT save.
  // The step CTA reuses one <button> node, so a native submit button used to fire
  // on this transition and create the claim before the review step was ever shown.
  it('reaches the review step without saving, then saves on explicit confirm', async () => {
    const fetchSpy = stubCreatedResponse()
    const user = userEvent.setup()
    await renderWizard()

    await completeBasicStep(user)

    // basic -> faults
    await user.click(screen.getByRole('button', { name: m.emotive_claims_create_next() }))
    // faults -> review (must not save here)
    await user.click(screen.getByRole('button', { name: m.emotive_claims_create_next() }))

    // We are on the review step — its Save CTA is present — and nothing was saved yet.
    const saveButton = screen.getByRole('button', { name: m.action_save() })
    expect(postedToEmotive(fetchSpy)).toBe(false)

    // Saving happens only on this explicit confirm.
    await user.click(saveButton)
    await waitFor(() => expect(postedToEmotive(fetchSpy)).toBe(true))
  })
})

describe('formValuesToCreateInput', () => {
  it('maps the assigned employee id', () => {
    const employeeId = '88888888-8888-4888-8888-888888888888'
    const input = formValuesToCreateInput({
      ...EMOTIVE_CLAIM_FORM_DEFAULTS,
      mrNumber: 'MR-1/26',
      customerId: '55555555-5555-4555-8555-555555555555',
      categoryId: CATEGORY_ID,
      engineTypeId: '66666666-6666-4666-8666-666666666666',
      dateOfClaim: '2026-05-01',
      employeeId,
    })

    expect(input.employeeId).toBe(employeeId)
  })
})
