import { m, setLocale } from '@mr/i18n'
import {
  ChatConversationType,
  ClaimDetailTab,
  ClaimKind,
  ClaimOutcome,
  domaceClaimDetailOptions,
  emotiveClaimDetailOptions,
  type ChatConversationListItem,
  type ChatMessagesPage,
  type ClaimDetailTabValue,
  type DomaceClaimDetail,
  type EmotiveClaimDetail,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DomaceClaimDetailView } from '~/features/domace-claims/detail/domace-claim-detail'
import { EmotiveClaimDetailView } from '~/features/emotive-claims/detail/emotive-claim-detail'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'
const THREAD_ID = '33333333-3333-4333-8333-333333333333'

vi.mock('~/lib/use-internal-auth-user', () => ({
  useInternalAuthUser: () => ({ userName: 'Marko Petrović', userEmail: 'marko@mr.rs' }),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    getRouteApi: () => ({
      useRouteContext: () => ({ authSession: { user: { permissions: [] } } }),
    }),
  }
})

const THREAD: ChatConversationListItem = {
  id: THREAD_ID,
  type: ChatConversationType.Claim,
  title: '7167/25',
  subtitle: 'Auto Stanić',
  claimKind: ClaimKind.Emotive,
  claimId: CLAIM_ID,
  unreadCount: 4,
  isLocked: false,
  isMuted: false,
  lastMessageAt: '2026-08-23T10:00:00.000Z',
}

const MESSAGES: ChatMessagesPage = {
  items: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      conversationId: THREAD_ID,
      seq: '41',
      clientMsgId: '55555555-5555-4555-8555-555555555555',
      author: { id: '66666666-6666-4666-8666-666666666666', name: 'Slavko Jović', initials: 'SJ' },
      body: 'Glava je stigla',
      quote: null,
      systemKind: null,
      systemMeta: null,
      editedAt: null,
      deletedAt: null,
      createdAt: '2026-08-23T08:42:00.000Z',
      seenByAll: false,
      reactedBy: [],
      mentions: [],
    },
  ],
  nextCursor: null,
  hasMore: false,
}

const BASE_CLAIM = {
  id: CLAIM_ID,
  sequenceNumber: 1,
  claimNumber: 'CLM-1',
  customerName: 'Auto Stanić',
  warrantyReport: 'Report text',
  engineTypeId: '66666666-6666-4666-8666-666666666666',
  engineTypeCode: 'OM651',
  engineTypeManufacturer: 'Mercedes',
  manufacturerId: '77777777-7777-4777-8777-777777777777',
  manufacturerName: 'Mercedes-Benz',
  category: null,
  missingRequiredCategoryFields: [],
  categoryFieldValues: {},
  previousCategoryFieldValues: [],
  engineCode: null,
  dateOfClaim: '2026-05-01',
  mrNumber: 'MR-1/26',
  dateOfFinish: null,
  employeeId: null,
  employeeName: null,
  outcome: ClaimOutcome.Accepted,
  claimYear: 2026,
  createdAt: '2026-05-01T10:00:00.000Z',
  internalNotes: null,
  inspectionReport: null,
  updatedBy: null,
  updatedAt: '2026-05-02T10:00:00.000Z',
  faults: [],
  findings: [],
}

const EMOTIVE_CLAIM = {
  ...BASE_CLAIM,
  kind: ClaimKind.Emotive,
  customerId: '88888888-8888-4888-8888-888888888888',
  sourceId: null,
  sourceCode: null,
  sourceName: null,
  clientVisibleAt: null,
  publishedAt: null,
  freshness: null,
  sectionFreshness: { photos: false, inspection: false, details: false, outcome: false },
} as unknown as EmotiveClaimDetail

const DOMACE_CLAIM = {
  ...BASE_CLAIM,
  kind: ClaimKind.Domace,
  invoiceNumber: null,
  originalInvoiceAmount: null,
  partsAmount: null,
  laborAmount: null,
  totalAmount: 1000,
} as unknown as DomaceClaimDetail

let threads: ChatConversationListItem[] = []

function installFetch(): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === 'POST') {
      return new Response(null, { status: 204 })
    }
    if (url.includes('/chat/conversations') && url.includes('/messages')) {
      return Response.json(MESSAGES)
    }
    if (url.includes('/chat/conversations')) {
      return Response.json({ items: threads, unreadTotal: 0 })
    }
    return Response.json({ items: [], total: 0, page: 1, pageSize: 10 })
  }) as unknown as typeof fetch
}

async function renderDetail(kind: ClaimKind, tab: ClaimDetailTabValue): Promise<void> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(emotiveClaimDetailOptions(CLAIM_ID).queryKey, EMOTIVE_CLAIM)
  client.setQueryData(domaceClaimDetailOptions(CLAIM_ID).queryKey, DOMACE_CLAIM)

  const node: ReactElement = (
    <QueryClientProvider client={client}>
      {kind === ClaimKind.Emotive ? (
        <EmotiveClaimDetailView id={CLAIM_ID} tab={tab} onTabChange={vi.fn()} />
      ) : (
        <DomaceClaimDetailView id={CLAIM_ID} tab={tab} onTabChange={vi.fn()} />
      )}
    </QueryClientProvider>
  )

  const rootRoute = createRootRoute({ component: () => node })
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/$kind/$id',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
}

describe.each([
  ['EMOTIVE', ClaimKind.Emotive],
  ['DOMAĆA', ClaimKind.Domace],
] as const)('%s claim detail — the Razgovor tab', (_label, kind) => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    threads = [THREAD]
    installFetch()
  })

  it('carries the unread number of its thread, the way Prilozi carries its count', async () => {
    await renderDetail(kind, ClaimDetailTab.Pregled)

    const tab = await screen.findByRole('tab', { name: /Razgovor/ })
    // The count arrives with the conversation list, one render after the tab itself.
    await waitFor(() => {
      expect(within(tab).getByText('4')).toBeInTheDocument()
    })
  })

  it('opens the claim’s own conversation', async () => {
    await renderDetail(kind, ClaimDetailTab.Razgovor)

    expect(await screen.findByText('Glava je stigla')).toBeInTheDocument()
  })

  it('offers a thread when the claim has none — and shows no conversation until then', async () => {
    threads = []
    await renderDetail(kind, ClaimDetailTab.Razgovor)

    expect(await screen.findByText(m.chat_thread_create_title())).toBeInTheDocument()
    expect(screen.queryByText('Glava je stigla')).not.toBeInTheDocument()
  })
})
