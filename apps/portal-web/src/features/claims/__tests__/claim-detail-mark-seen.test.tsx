import { setLocale } from '@mr/i18n'
import {
  AttachmentVisibility,
  ClaimKind,
  ClaimOutcome,
  ClientClaimPhase,
  attachmentsListOptions,
  clientClaimKeys,
  type AttachmentListItem,
  type ClientClaimDetail,
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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// PortalHeader pulls in auth/theme/nav concerns unrelated to the bug under
// test (mark-seen wiring) — stub it so the harness stays focused on
// ClaimDetailComponent's own effect.
vi.mock('~/components/portal-header', () => ({ PortalHeader: () => null }))

const CLAIM_ID = 'c1111111-1111-1111-1111-111111111111'
const DETAIL_URL = `/api/emotive-claims/${CLAIM_ID}`
const MARK_SEEN_URL = `/api/emotive-claims/${CLAIM_ID}/mark-seen`

const ALL_FRESH_FALSE: ClientClaimDetail['sectionFreshness'] = {
  photos: false,
  inspection: false,
  details: false,
  outcome: false,
}

function fixtureDetail(): ClientClaimDetail {
  return {
    kind: ClaimKind.Emotive,
    id: CLAIM_ID,
    claimNumber: '7167/25',
    mrNumber: 'MR-7167',
    warrantyReport: 'Motor se pregreva.',
    engineTypeCode: 'X200',
    manufacturerName: 'Acme',
    engineCode: 'ENG-1',
    dateOfClaim: '2026-06-01',
    dateOfFinish: null,
    outcome: ClaimOutcome.Pending,
    claimYear: 2026,
    customerName: 'Partner d.o.o.',
    createdAt: '2026-06-01T00:00:00.000Z',
    clientPhase: ClientClaimPhase.InProgress,
    freshness: null,
    engineTypeManufacturer: null,
    inspectionReport: 'Sve u redu.',
    employeeName: 'Marko Marković',
    sectionFreshness: ALL_FRESH_FALSE,
  }
}

function fixturePhoto(claimId: string): AttachmentListItem {
  return {
    id: 'a1111111-1111-1111-1111-111111111111',
    claimKind: ClaimKind.Emotive,
    claimId,
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    fileSizeBytes: 1024,
    width: 400,
    height: 300,
    durationSeconds: null,
    thumbnailPath: null,
    caption: null,
    visibility: AttachmentVisibility.ClientVisible,
    uploadedBy: null,
    uploadedAt: '2026-06-01T00:00:00.000Z',
    contentSha256: 'abc123',
  }
}

/** Fakes just the two endpoints this route hits: the loader's detail GET and
 * the mount-time mark-seen POST. */
function stubFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === MARK_SEEN_URL && init?.method === 'POST') {
      return new Response(null, { status: 204 })
    }
    if (url.startsWith(DETAIL_URL)) {
      return new Response(JSON.stringify(fixtureDetail()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    throw new Error(`unexpected fetch: ${String(init?.method ?? 'GET')} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function buildQueryClient(): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(clientClaimKeys.detail(CLAIM_ID), fixtureDetail())
  queryClient.setQueryData(attachmentsListOptions(ClaimKind.Emotive, CLAIM_ID).queryKey, {
    items: [fixturePhoto(CLAIM_ID)],
  })
  return queryClient
}

async function renderDetail(queryClient: QueryClient): Promise<ReturnType<typeof render>> {
  // Dynamic import AFTER the mocks above are registered, and after any
  // system-under-test module reset between tests.
  const { Route } = await import('~/routes/claims/$id')
  const component = Route.options.component as () => React.JSX.Element

  const rootRoute = createRootRoute()
  const idRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/claims/$id',
    component,
  })
  const claimsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/claims',
    component: () => <div data-testid="claims-page" />,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([idRoute, claimsRoute]),
    history: createMemoryHistory({ initialEntries: [`/claims/${CLAIM_ID}`] }),
  })
  await router.load()

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  )
}

describe('claim detail mark-seen on open', () => {
  beforeEach(() => setLocale('sr'))
  afterEach(() => vi.unstubAllGlobals())

  it('POSTs mark-seen exactly once when the detail view mounts', async () => {
    const fetchMock = stubFetch()
    const queryClient = buildQueryClient()

    await renderDetail(queryClient)
    expect(await screen.findByText('MR-7167')).toBeInTheDocument()

    await waitFor(() => {
      const markSeenCalls = fetchMock.mock.calls.filter(
        ([input]) => String(input) === MARK_SEEN_URL,
      )
      expect(markSeenCalls).toHaveLength(1)
    })
    const [, init] = fetchMock.mock.calls.find(([input]) => String(input) === MARK_SEEN_URL) ?? []
    expect(init).toMatchObject({ method: 'POST' })
  })

  it('invalidates the client list + summary, but NOT the current detail, once mark-seen resolves', async () => {
    stubFetch()
    const queryClient = buildQueryClient()
    queryClient.setQueryData(clientClaimKeys.list(1, 10), {
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    })
    queryClient.setQueryData(clientClaimKeys.summary(), { phases: {}, activity: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await renderDetail(queryClient)
    await screen.findByText('MR-7167')

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: clientClaimKeys.lists() }),
      )
    })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: clientClaimKeys.summary() }),
    )
    expect(invalidateSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: clientClaimKeys.detail(CLAIM_ID) }),
    )
  })

  it('does not fire mark-seen from the route loader alone (no component mount)', async () => {
    const fetchMock = stubFetch()
    const queryClient = buildQueryClient()

    const { Route } = await import('~/routes/claims/$id')
    await Route.options.loader?.({
      context: { queryClient },
      params: { id: CLAIM_ID },
    } as never)

    const markSeenCalls = fetchMock.mock.calls.filter(([input]) => String(input) === MARK_SEEN_URL)
    expect(markSeenCalls).toHaveLength(0)
  })

  it('drops the client claim-detail query from the cache when the detail view unmounts', async () => {
    stubFetch()
    const queryClient = buildQueryClient()

    const { unmount } = await renderDetail(queryClient)

    expect(await screen.findByText('MR-7167')).toBeInTheDocument()
    expect(queryClient.getQueryData(clientClaimKeys.detail(CLAIM_ID))).toBeDefined()

    unmount()

    expect(queryClient.getQueryData(clientClaimKeys.detail(CLAIM_ID))).toBeUndefined()
  })
})
