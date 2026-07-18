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
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// PortalHeader pulls in auth/theme/nav concerns unrelated to the bug under
// test (cache cleanup on unmount) — stub it so the harness stays focused on
// ClaimDetailComponent's own effect.
vi.mock('~/components/portal-header', () => ({ PortalHeader: () => null }))

const CLAIM_ID = 'c1111111-1111-1111-1111-111111111111'

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

describe('claim detail cache cleanup on unmount', () => {
  beforeEach(() => setLocale('sr'))

  it('drops the client claim-detail query from the cache when the detail view unmounts', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(clientClaimKeys.detail(CLAIM_ID), fixtureDetail())
    queryClient.setQueryData(attachmentsListOptions(ClaimKind.Emotive, CLAIM_ID).queryKey, {
      items: [fixturePhoto(CLAIM_ID)],
    })

    const { unmount } = await renderDetail(queryClient)

    // Sanity: the detail actually rendered from the seeded cache.
    expect(await screen.findByText('MR-7167')).toBeInTheDocument()
    expect(queryClient.getQueryData(clientClaimKeys.detail(CLAIM_ID))).toBeDefined()

    unmount()

    expect(queryClient.getQueryData(clientClaimKeys.detail(CLAIM_ID))).toBeUndefined()
  })
})
