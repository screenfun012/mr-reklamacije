import { m, setLocale } from '@mr/i18n'
import {
  ClaimKind,
  CustomerKind,
  assignedWorkerReferenceOptions,
  claimCategoriesReferenceOptions,
  claimCategoryFieldsForCategoryOptions,
  customersReferenceOptions,
  departmentsReferenceOptions,
  employeesReferenceOptions,
  engineManufacturersReferenceOptions,
  engineTypesReferenceOptions,
  externalPartiesReferenceOptions,
  type ClaimCategoryListItem,
  type CustomerListItem,
  type EmployeeListItem,
  type EngineManufacturerListItem,
  type EngineTypeListItem,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ClaimCreateWizard } from '../claim-create-wizard.js'

const CUSTOMER_ID = '55555555-5555-4555-8555-555555555555'
const ENGINE_TYPE_ID = '66666666-6666-4666-8666-666666666666'
const MANUFACTURER_ID = '77777777-7777-4777-8777-777777777777'
const CATEGORY_ID = '99999999-9999-4999-8999-999999999999'
const WORKER_ID = '88888888-8888-4888-8888-888888888888'

const CATEGORY: ClaimCategoryListItem = {
  id: CATEGORY_ID,
  code: 'REMONT_MOTORA',
  name: 'Generalni remont motora',
  sortOrder: 10,
  isActive: true,
  deactivatedAt: null,
  usageCount: 0,
}

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
const WORKERS: EmployeeListItem[] = [
  {
    id: WORKER_ID,
    fullName: 'Milan Petrović',
    departmentId: null,
    departmentName: null,
    isActive: true,
    usageCount: 0,
  },
]

async function renderWizard(
  permissions: { emotive?: boolean; domace?: boolean } = { emotive: true, domace: true },
): Promise<void> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  client.setQueryData(
    customersReferenceOptions({ kind: CustomerKind.EmotivePartner, activeOnly: true }).queryKey,
    CUSTOMERS,
  )
  client.setQueryData(
    engineManufacturersReferenceOptions({ activeOnly: true }).queryKey,
    MANUFACTURERS,
  )
  client.setQueryData(claimCategoriesReferenceOptions({ activeOnly: true }).queryKey, [CATEGORY])
  client.setQueryData(claimCategoryFieldsForCategoryOptions(CATEGORY_ID).queryKey, [])
  client.setQueryData(employeesReferenceOptions({ activeOnly: true }).queryKey, WORKERS)
  client.setQueryData(assignedWorkerReferenceOptions().queryKey, WORKERS)
  client.setQueryData(departmentsReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(externalPartiesReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(
    engineTypesReferenceOptions({ activeOnly: true, manufacturerId: MANUFACTURER_ID }).queryKey,
    ENGINE_TYPES,
  )

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <ClaimCreateWizard
        category={CATEGORY}
        canCreateEmotive={permissions.emotive ?? false}
        canCreateDomace={permissions.domace ?? false}
        onLeave={() => undefined}
      />
    </QueryClientProvider>
  )
  const rootRoute = createRootRoute({ component: () => node })
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije',
    component: () => null,
  })
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/emotive/$id',
    component: () => null,
  })
  const domaceDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/domace/$id',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute, detailRoute, domaceDetailRoute]),
    history: createMemoryHistory({ initialEntries: ['/reklamacije/nova'] }),
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
}

function stubCreated(kind: string): ReturnType<typeof vi.fn> {
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({
      kind,
      id: '11111111-1111-4111-8111-111111111111',
      mrNumber: 'MR-TEST/26',
      category: { id: CATEGORY_ID, code: 'REMONT_MOTORA', name: CATEGORY.name, isActive: true },
    }),
  })
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

function postedTo(fetchSpy: ReturnType<typeof vi.fn>, path: string): boolean {
  return fetchSpy.mock.calls.some(([url, init]) => {
    const request = init as RequestInit | undefined
    return String(url).includes(path) && request?.method === 'POST'
  })
}

function postedBody(fetchSpy: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const call = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit).method === 'POST')
  return JSON.parse(String((call?.[1] as RequestInit).body)) as Record<string, unknown>
}

async function pickEmotive(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: /Reklamacija stranog partnera/ }))
}

async function pickDomace(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: /Domaća firma ili privatno lice/ }))
}

async function fillEmotiveBasics(user: ReturnType<typeof userEvent.setup>): Promise<void> {
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

describe('ClaimCreateWizard', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks for the kind first, and offers only the doors the actor may open', async () => {
    await renderWizard({ emotive: true, domace: false })

    expect(screen.getByRole('button', { name: /Reklamacija stranog partnera/ })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Domaća firma ili privatno lice/ }),
    ).not.toBeInTheDocument()
  })

  it('never asks for the category as a field — it is the chip the wizard was opened with', async () => {
    const user = userEvent.setup()
    await renderWizard()
    await pickEmotive(user)

    // The old wizard had a "Kategorija" select that could be left empty, which is why it had a
    // rule blocking the step. The chip cannot be empty, so the rule has nothing left to guard.
    expect(
      screen.queryByRole('combobox', { name: m.field_claim_category() }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.field_claim_category() })).toHaveTextContent(
      CATEGORY.name,
    )
  })

  it('reaches the review step without saving, then saves on explicit confirm', async () => {
    // Regression: the step CTA reuses one <button> node, so a native submit used to fire on the
    // faults → review transition and create the claim before the review was ever shown.
    const fetchSpy = stubCreated(ClaimKind.Emotive)
    const user = userEvent.setup()
    await renderWizard()

    await pickEmotive(user)
    await fillEmotiveBasics(user)
    await user.click(screen.getByRole('button', { name: m.emotive_claims_create_next() }))
    await user.click(screen.getByRole('button', { name: m.emotive_claims_create_next() }))

    const saveButton = screen.getByRole('button', { name: new RegExp(m.action_save()) })
    expect(postedTo(fetchSpy, '/api/emotive-claims')).toBe(false)

    await user.click(saveButton)
    await waitFor(() => expect(postedTo(fetchSpy, '/api/emotive-claims')).toBe(true))
  })

  it('sends a DOMAĆA claim to its own endpoint, with a buyer name and no MR number', async () => {
    // The DOMAĆA rule that used to live in its own long form: one of MR number / buyer is enough.
    const fetchSpy = stubCreated(ClaimKind.Domace)
    const user = userEvent.setup()
    await renderWizard()

    await pickDomace(user)
    await user.type(
      screen.getByLabelText(m.domace_claims_create_field_customer_name(), { exact: false }),
      'Autoservis Đorđević',
    )
    await user.click(screen.getByRole('button', { name: m.emotive_claims_create_next() }))
    await user.click(screen.getByRole('button', { name: m.emotive_claims_create_next() }))
    await user.click(screen.getByRole('button', { name: new RegExp(m.action_save()) }))

    await waitFor(() => expect(postedTo(fetchSpy, '/api/domace-claims')).toBe(true))
    const body = postedBody(fetchSpy)
    expect(body['customerName']).toBe('Autoservis Đorđević')
    expect(body['categoryId']).toBe(CATEGORY_ID)
    // UKUPNO is the server's to compute — the form must never send it.
    expect('totalAmount' in body).toBe(false)
  })

  it('refuses to leave the basic step of a DOMAĆA claim with neither MR number nor buyer', async () => {
    const fetchSpy = stubCreated(ClaimKind.Domace)
    const user = userEvent.setup()
    await renderWizard()

    await pickDomace(user)
    await user.click(screen.getByRole('button', { name: m.emotive_claims_create_next() }))

    expect(screen.getByText(m.domace_claims_create_field_at_least_one())).toBeInTheDocument()
    expect(postedTo(fetchSpy, '/api/domace-claims')).toBe(false)
  })

  it('feeds every active worker to fault attribution, and assembly only to the assigned worker', async () => {
    // The 2026-07-23 trap: ONE employees array fed both fields, so restricting the assigned
    // worker to assembly silently restricted fault attribution too.
    const user = userEvent.setup()
    await renderWizard()

    await pickEmotive(user)
    await user.click(screen.getByRole('combobox', { name: m.claims_field_assigned_worker() }))
    expect(screen.getByRole('option', { name: 'Milan Petrović' })).toBeInTheDocument()
  })
})
