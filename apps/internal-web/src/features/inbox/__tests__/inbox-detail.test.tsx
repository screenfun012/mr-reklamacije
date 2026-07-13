import {
  ClientSubmissionStatus,
  clientSubmissionAttachmentsOptions,
  clientSubmissionDetailOptions,
  employeesReferenceOptions,
  engineManufacturersReferenceOptions,
  engineTypesReferenceOptions,
  type ClientSubmissionAttachmentListResponse,
  type ClientSubmissionDetail,
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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InboxDetailView } from '../inbox-detail.js'

const SUBMISSION_ID = '11111111-1111-4111-8111-111111111111'
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222'
const MANUFACTURER_ID = '77777777-7777-4777-8777-777777777777'
const ENGINE_TYPE_ID = '66666666-6666-4666-8666-666666666666'
const CREATED_CLAIM_ID = '99999999-9999-4999-8999-999999999999'

const SUBMISSION: ClientSubmissionDetail = {
  id: SUBMISSION_ID,
  customerId: CUSTOMER_ID,
  customerName: 'SELMAN',
  message: 'Motor lupa na hladno',
  status: ClientSubmissionStatus.Pending,
  attachmentCount: 1,
  createdAt: '2026-07-10T09:30:00.000Z',
  linkedEmotiveClaimId: null,
  rejectedReason: null,
  handledAt: null,
  submittedByUserId: '33333333-3333-4333-8333-333333333333',
}

const ATTACHMENTS: ClientSubmissionAttachmentListResponse = {
  items: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      fileName: 'foto.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: 12000,
      width: 800,
      height: 600,
      durationSeconds: null,
      thumbnailPath: 'thumb/foto.jpg',
      caption: null,
      uploadedBy: null,
      uploadedAt: '2026-07-10T09:30:00.000Z',
      contentSha256: 'abc123',
    },
  ],
}

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

function seedClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  client.setQueryData(clientSubmissionDetailOptions(SUBMISSION_ID).queryKey, SUBMISSION)
  client.setQueryData(clientSubmissionAttachmentsOptions(SUBMISSION_ID).queryKey, ATTACHMENTS)
  client.setQueryData(
    engineManufacturersReferenceOptions({ activeOnly: true }).queryKey,
    MANUFACTURERS,
  )
  client.setQueryData(employeesReferenceOptions({ activeOnly: true }).queryKey, [])
  client.setQueryData(
    engineTypesReferenceOptions({ activeOnly: true, manufacturerId: MANUFACTURER_ID }).queryKey,
    ENGINE_TYPES,
  )
  return client
}

async function renderDetail(client: QueryClient): Promise<void> {
  const node: ReactElement = (
    <QueryClientProvider client={client}>
      <InboxDetailView id={SUBMISSION_ID} />
    </QueryClientProvider>
  )
  const rootRoute = createRootRoute({ component: () => node })
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/pristiglo',
    component: () => null,
  })
  const claimRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/emotive/$id',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute, claimRoute]),
    history: createMemoryHistory({ initialEntries: ['/pristiglo/' + SUBMISSION_ID] }),
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
}

function requestsTo(fetchSpy: ReturnType<typeof vi.fn>, url: string): boolean {
  return fetchSpy.mock.calls.some(([callUrl, init]) => {
    const request = init as RequestInit | undefined
    return String(callUrl).includes(url) && request?.method === 'POST'
  })
}

describe('InboxDetailView', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the client message and attachments', async () => {
    await renderDetail(seedClient())

    expect(await screen.findByText('Motor lupa na hladno')).toBeInTheDocument()
    expect(screen.getByAltText('foto.jpg')).toBeInTheDocument()
  })

  it('opens the pre-filled convert form and posts to the convert endpoint on save', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: CREATED_CLAIM_ID, mrNumber: 'MR-TEST/26' }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    const user = userEvent.setup()
    await renderDetail(seedClient())

    await user.click(await screen.findByRole('button', { name: m.internal_inbox_action_convert() }))

    // Razlog (warrantyReport) is pre-filled from the client's message.
    const razlog = screen.getByLabelText(m.emotive_claims_create_field_warranty_report(), {
      exact: false,
    })
    expect(razlog).toHaveValue('Motor lupa na hladno')

    await user.type(
      screen.getByLabelText(m.emotive_claims_create_field_mr_number(), { exact: false }),
      'MR-TEST/26',
    )
    await user.click(
      screen.getByRole('combobox', { name: m.emotive_claims_create_field_manufacturer() }),
    )
    await user.click(screen.getByRole('option', { name: 'Mercedes-Benz' }))
    await user.click(
      screen.getByRole('combobox', { name: m.emotive_claims_create_field_engine_type() }),
    )
    await user.click(screen.getByRole('option', { name: /OM651/ }))
    await user.click(
      screen.getByRole('button', { name: m.emotive_claims_create_field_date_claim() }),
    )
    await user.click(screen.getByRole('button', { name: /(^|\D)15(\D|$)/ }))

    await user.click(screen.getByRole('button', { name: m.action_save() }))

    await waitFor(() =>
      expect(requestsTo(fetchSpy, `/api/client-submissions/${SUBMISSION_ID}/convert`)).toBe(true),
    )
  })

  it('opens a confirm dialog and posts to the reject endpoint on dismiss', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchSpy)
    const user = userEvent.setup()
    await renderDetail(seedClient())

    await user.click(await screen.findByRole('button', { name: m.internal_inbox_action_reject() }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(m.internal_inbox_reject_title())

    await user.click(
      within(dialog).getByRole('button', { name: m.internal_inbox_reject_confirm() }),
    )

    await waitFor(() =>
      expect(requestsTo(fetchSpy, `/api/client-submissions/${SUBMISSION_ID}/reject`)).toBe(true),
    )
  })
})
