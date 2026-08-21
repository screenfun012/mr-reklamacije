import {
  departmentsReferenceOptions,
  claimCategoriesReferenceOptions,
  assignedWorkerReferenceOptions,
  employeesReferenceOptions,
  engineManufacturersReferenceOptions,
  externalPartiesReferenceOptions,
  type ClaimCategoryListItem,
  type EngineManufacturerListItem,
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DOMACE_CLAIM_FORM_DEFAULTS,
  formValuesToCreateInput,
} from '../domace-claim-create-schemas.js'
import { DomaceClaimCreateForm } from '../domace-claim-create-form.js'

const MANUFACTURER_ID = '77777777-7777-4777-8777-777777777777'
const CATEGORY_ID = '99999999-9999-4999-8999-999999999999'

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

async function renderForm(): Promise<void> {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  client.setQueryData(
    engineManufacturersReferenceOptions({ activeOnly: true }).queryKey,
    MANUFACTURERS,
  )
  client.setQueryData(claimCategoriesReferenceOptions({ activeOnly: true }).queryKey, CATEGORIES)
  client.setQueryData(employeesReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(assignedWorkerReferenceOptions().queryKey, [])
  client.setQueryData(departmentsReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(externalPartiesReferenceOptions({ activeOnly: true }).queryKey, [])

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <DomaceClaimCreateForm />
    </QueryClientProvider>
  )

  const rootRoute = createRootRoute({ component: () => node })
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/domace/$id',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/reklamacije/domace/nova'] }),
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
}

function stubCreatedResponse(): ReturnType<typeof vi.fn> {
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ id: '11111111-1111-4111-8111-111111111111' }),
  })
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

async function selectCategory(): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: m.field_claim_category() }))
  await user.click(screen.getByRole('option', { name: 'Generalni remont motora' }))
}

function findPostBody(fetchSpy: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const call = fetchSpy.mock.calls.find(([url, init]) => {
    const request = init as RequestInit | undefined
    return String(url).includes('/api/domace-claims') && request?.method === 'POST'
  })
  if (!call) {
    throw new Error('No POST /api/domace-claims call captured')
  }
  const [, init] = call as [string, RequestInit]
  return JSON.parse(String(init.body)) as Record<string, unknown>
}

describe('DomaceClaimCreateForm', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a claim with only customerName (no mrNumber)', async () => {
    const fetchSpy = stubCreatedResponse()
    await renderForm()

    fireEvent.change(screen.getByLabelText(m.domace_claims_create_field_customer_name()), {
      target: { value: 'Petar Petrović' },
    })
    await selectCategory()
    fireEvent.click(screen.getByRole('button', { name: m.action_save() }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())

    const body = findPostBody(fetchSpy)
    expect(body['customerName']).toBe('Petar Petrović')
    expect(body['mrNumber']).toBeUndefined()
    await waitFor(() =>
      expect(screen.getByText(m.domace_claims_create_success())).toBeInTheDocument(),
    )
    expect(
      screen.getByRole('link', { name: m.domace_claims_create_success_view() }),
    ).toHaveAttribute(
      'href',
      '/reklamacije/domace/11111111-1111-4111-8111-111111111111?tab=pregled',
    )
  })

  it('creates a claim with only mrNumber (no customerName)', async () => {
    const fetchSpy = stubCreatedResponse()
    await renderForm()

    fireEvent.change(screen.getByLabelText(m.domace_claims_create_field_mr_number()), {
      target: { value: 'MR1234/23' },
    })
    await selectCategory()
    fireEvent.click(screen.getByRole('button', { name: m.action_save() }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())

    const body = findPostBody(fetchSpy)
    expect(body['mrNumber']).toBe('MR1234/23')
    expect(body['customerName']).toBeUndefined()
  })

  it('blocks an empty form and shows the "at least one" error without calling the API', async () => {
    const fetchSpy = stubCreatedResponse()
    await renderForm()

    fireEvent.click(screen.getByRole('button', { name: m.action_save() }))

    // The "at least one" rule attaches its error to the mrNumber field. Assert by
    // its destructive styling rather than the message text: zod messages are
    // captured at module-import locale, which need not match the render locale.
    await waitFor(() => {
      const group = screen.getByLabelText(m.domace_claims_create_field_mr_number()).closest('div')
      expect(group?.querySelector('.text-mri-bad')).not.toBeNull()
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not send total_amount from the create form', async () => {
    const fetchSpy = stubCreatedResponse()
    await renderForm()

    fireEvent.change(screen.getByLabelText(m.domace_claims_create_field_customer_name()), {
      target: { value: 'AC Stanić' },
    })
    await selectCategory()
    fireEvent.click(screen.getByRole('button', { name: m.action_save() }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())

    const body = findPostBody(fetchSpy)
    expect(body['totalAmount']).toBeUndefined()
  })
})

describe('formValuesToCreateInput', () => {
  it('maps free-text mrNumber and drops empty optional fields', () => {
    const input = formValuesToCreateInput({
      ...DOMACE_CLAIM_FORM_DEFAULTS,
      mrNumber: 'bilo šta /23',
      categoryId: CATEGORY_ID,
      dateOfClaim: '2026-05-01',
    })

    expect(input.mrNumber).toBe('bilo šta /23')
    expect(input.customerName).toBeUndefined()
    expect(input.engineTypeId).toBeUndefined()
    expect(input.dateOfClaim?.toISOString().slice(0, 10)).toBe('2026-05-01')
  })

  it('never sets total_amount (entered during processing, not creation)', () => {
    const input = formValuesToCreateInput({
      ...DOMACE_CLAIM_FORM_DEFAULTS,
      customerName: 'Kupac',
      categoryId: CATEGORY_ID,
    })

    expect(input.totalAmount).toBeUndefined()
  })

  it('maps the assigned employee id', () => {
    const employeeId = '55555555-5555-4555-8555-555555555555'
    const input = formValuesToCreateInput({
      ...DOMACE_CLAIM_FORM_DEFAULTS,
      customerName: 'Kupac',
      categoryId: CATEGORY_ID,
      employeeId,
    })

    expect(input.employeeId).toBe(employeeId)
  })
})
