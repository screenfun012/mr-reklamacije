import { setLocale } from '@mr/i18n'
import {
  ClaimKind,
  ClaimOutcome,
  ClientClaimPhase,
  MACHINING_CLAIM_CATEGORY_CODE,
  type ClientClaimListItem,
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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The header carries auth/theme/company concerns this test has no opinion about.
vi.mock('~/components/portal-header', () => ({ PortalHeader: () => null }))

// Static on purpose — see the note in claim-detail-mark-seen.test.tsx: importing this route
// inside a test body charges its transform to the first test's own timeout.
import { Route } from '~/routes/claims/index'

const SUMMARY_URL = '/api/dashboard/client-summary'

function claim(overrides: Partial<ClientClaimListItem>): ClientClaimListItem {
  return {
    kind: ClaimKind.Emotive,
    id: 'c1111111-1111-1111-1111-111111111111',
    claimNumber: '7167/25',
    mrNumber: 'MR-7167',
    warrantyReport: null,
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
    categoryCode: 'REMONT_MOTORA',
    ...overrides,
  }
}

/** Serves whatever the request asked for, so the assertions are about the request. */
function stubFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === SUMMARY_URL) {
      return new Response(
        JSON.stringify({
          stats: { received: 0, inProgress: 1, resolved: 0, total: 1 },
          activity: [],
          firmNames: ['Partner d.o.o.'],
          support: { phone: '011/222-3344', email: 'podrska@example.test' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    if (url.startsWith('/api/claims')) {
      const machining = url.includes(`categoryCode=${MACHINING_CLAIM_CATEGORY_CODE}`)
      const items = machining
        ? [
            claim({
              id: 'c2222222-2222-2222-2222-222222222222',
              mrNumber: 'MR-9001',
              categoryCode: MACHINING_CLAIM_CATEGORY_CODE,
            }),
          ]
        : [claim({})]
      return new Response(JSON.stringify({ items, total: items.length, page: 1, pageSize: 10 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function renderDashboard(): Promise<void> {
  const component = Route.options.component as () => React.JSX.Element
  const rootRoute = createRootRoute()
  // The component reads its deps through getRouteApi('/claims/'), so the harness has to
  // reproduce that id — an index child under /claims, not a plain /claims route.
  const claimsLayout = createRoute({ getParentRoute: () => rootRoute, path: '/claims' })
  const claimsIndex = createRoute({
    getParentRoute: () => claimsLayout,
    path: '/',
    component,
    validateSearch: Route.options.validateSearch as never,
    loaderDeps: Route.options.loaderDeps as never,
  })
  const detailRoute = createRoute({
    getParentRoute: () => claimsLayout,
    path: '$id',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([claimsLayout.addChildren([claimsIndex, detailRoute])]),
    history: createMemoryHistory({ initialEntries: ['/claims'] }),
  })
  await router.load()

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  )
}

describe('portal dashboard service filter', () => {
  beforeEach(() => setLocale('sr'))
  afterEach(() => vi.unstubAllGlobals())

  it('shows machining claims under the machining tab instead of an empty list', async () => {
    // The tab used to render a hardcoded empty array — an honest empty state while machining
    // claims could not exist, and a lie from the day a claim can carry that category.
    const fetchMock = stubFetch()
    const user = userEvent.setup()

    await renderDashboard()
    expect(await screen.findByText('MR-7167')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mašinska obrada' }))

    expect(await screen.findByText('MR-9001')).toBeInTheDocument()
    // Filtered by the server: the page counter has to describe the list on screen.
    await waitFor(() => {
      const asked = fetchMock.mock.calls.some(([input]) =>
        String(input).includes(`categoryCode=${MACHINING_CLAIM_CATEGORY_CODE}`),
      )
      expect(asked).toBe(true)
    })
  })
})
