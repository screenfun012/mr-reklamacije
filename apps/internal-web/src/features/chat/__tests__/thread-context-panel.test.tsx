import { m, setLocale } from '@mr/i18n'
import {
  ChatConversationType,
  ClaimDetailTab,
  ClaimKind,
  ClaimOutcome,
  domaceClaimDetailOptions,
  chatConversationAttachmentsOptions,
  chatPinsOptions,
  emotiveClaimDetailOptions,
  type ChatConversationListItem,
  type ChatConversationAttachment,
  type ChatPin,
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
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThreadContextPanel, ThreadContextToggle } from '~/features/chat/thread-context-panel'

const EMOTIVE_CLAIM_ID = '11111111-1111-4111-8111-111111111111'
const DOMACE_CLAIM_ID = '22222222-2222-4222-8222-222222222222'

function thread(over: Partial<ChatConversationListItem> = {}): ChatConversationListItem {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    type: ChatConversationType.Claim,
    title: '7167/25',
    subtitle: 'Auto Stanić',
    claimKind: ClaimKind.Emotive,
    claimId: EMOTIVE_CLAIM_ID,
    unreadCount: 0,
    isLocked: false,
    isMuted: false,
    lastMessageAt: null,
    ...over,
  }
}

function channel(): ChatConversationListItem {
  return thread({
    type: ChatConversationType.Channel,
    title: 'Mašinska obrada',
    subtitle: '3 ČLANA',
    claimKind: null,
    claimId: null,
  })
}

const EMOTIVE_CLAIM = {
  kind: ClaimKind.Emotive,
  id: EMOTIVE_CLAIM_ID,
  mrNumber: '7167/25',
  outcome: ClaimOutcome.Pending,
  customerName: 'Auto Stanić',
  employeeName: 'Marko Petrović',
} as unknown as EmotiveClaimDetail

const DOMACE_CLAIM = {
  kind: ClaimKind.Domace,
  id: DOMACE_CLAIM_ID,
  mrNumber: '1204/26',
  outcome: ClaimOutcome.Accepted,
  customerName: 'Petar Petrović',
  employeeName: null,
} as unknown as DomaceClaimDetail

const ME = '00000000-0000-4000-8000-0000000000aa'

const SHELF: ChatConversationAttachment[] = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    messageId: '55555555-5555-4555-8555-555555555555',
    fileName: 'kvar.jpg',
    mimeType: 'image/jpeg',
    fileSizeBytes: 1024,
    width: 800,
    height: 600,
  },
]

async function renderPanel(
  conversation: ChatConversationListItem,
  pins: ChatPin[] = [],
  shelf: ChatConversationAttachment[] = [],
  shelfTotal?: number,
): Promise<void> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(emotiveClaimDetailOptions(EMOTIVE_CLAIM_ID).queryKey, EMOTIVE_CLAIM)
  queryClient.setQueryData(domaceClaimDetailOptions(DOMACE_CLAIM_ID).queryKey, DOMACE_CLAIM)
  queryClient.setQueryData(chatPinsOptions(conversation.id).queryKey, { items: pins })
  queryClient.setQueryData(chatConversationAttachmentsOptions(conversation.id).queryKey, {
    items: shelf,
    total: shelfTotal ?? shelf.length,
    page: 1,
    pageSize: 9,
  })

  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <ThreadContextPanel conversation={conversation} currentUserId={ME} isAdmin={false} />
      </QueryClientProvider>
    ),
  })
  const emotiveRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/emotive/$id',
    component: () => null,
  })
  const domaceRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/domace/$id',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([emotiveRoute, domaceRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
}

describe('ThreadContextPanel', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('carries the claim beside the thread — number, kind, outcome, partner and who is on it', async () => {
    await renderPanel(thread())

    expect(screen.getByText(m.chat_context_claim())).toBeInTheDocument()
    expect(screen.getByText('7167/25')).toBeInTheDocument()
    expect(screen.getByText('EMOTIVE')).toBeInTheDocument()
    expect(screen.getByText(m.outcome_pending())).toBeInTheDocument()
    expect(screen.getByText('Auto Stanić')).toBeInTheDocument()
    expect(
      screen.getByText(m.chat_context_assigned({ name: 'Marko Petrović' })),
    ).toBeInTheDocument()
  })

  it('opens the claim it belongs to', async () => {
    await renderPanel(thread())

    expect(screen.getByRole('link', { name: m.chat_context_open_claim() })).toHaveAttribute(
      'href',
      `/reklamacije/emotive/${EMOTIVE_CLAIM_ID}?tab=${ClaimDetailTab.Pregled}`,
    )
  })

  it('sends a domestic thread to the domestic detail', async () => {
    await renderPanel(thread({ claimKind: ClaimKind.Domace, claimId: DOMACE_CLAIM_ID }))

    expect(screen.getByRole('link', { name: m.chat_context_open_claim() })).toHaveAttribute(
      'href',
      `/reklamacije/domace/${DOMACE_CLAIM_ID}?tab=${ClaimDetailTab.Pregled}`,
    )
  })

  /**
   * This test used to assert the opposite — that the section said attachments were still to come.
   * It was written to fail on the day they arrived, and this is that day.
   */
  it('draws the room\u2019s files, and says how many there are in all', async () => {
    await renderPanel(thread(), [], SHELF, 14)

    // ⚠ The count is the ROOM's, not the grid's. The browser holds one page of fifty messages, so
    // counting from what is on screen is wrong in every older room — quietly.
    expect(screen.getByText(m.chat_context_attachments({ count: 14 }))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'kvar.jpg' })).toBeInTheDocument()
    // Nine shown, fourteen held: the last square says what is left.
    expect(screen.getByText('+13')).toBeInTheDocument()
  })

  it('says so plainly when nothing has been sent yet', async () => {
    await renderPanel(thread())

    expect(screen.getByText(m.chat_context_attachments_none())).toBeInTheDocument()
  })

  it('closes with the note about the bell', async () => {
    await renderPanel(thread())

    expect(screen.getByText(m.chat_context_footer())).toBeInTheDocument()
  })

  /**
   * ⚠ The panel is the CLAIM's context. A channel has no claim, so there is nothing for it to
   * carry — and a panel that draws its frame with empty fields reads as a broken screen.
   */
  it('is drawn only in a claim thread, never in a channel', async () => {
    await renderPanel(channel())

    expect(screen.queryByText(m.chat_context_claim())).not.toBeInTheDocument()
    expect(screen.queryByText(m.chat_context_footer())).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: m.chat_context_open_claim() }),
    ).not.toBeInTheDocument()
  })
})

describe('ThreadContextToggle', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('offers the panel in a thread and says whether it is open', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<ThreadContextToggle conversation={thread()} open={false} onToggle={onToggle} />)

    const button = screen.getByRole('button', { name: m.chat_context_toggle() })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    await user.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('is not offered in a channel', () => {
    render(<ThreadContextToggle conversation={channel()} open={false} onToggle={vi.fn()} />)

    expect(screen.queryByRole('button', { name: m.chat_context_toggle() })).not.toBeInTheDocument()
  })

  /**
   * The prototype's PRIKAČENO block (L167–L171) is drawn only when the thread has a shortlist —
   * an empty eyebrow over nothing reads as a section that failed to load.
   */
  it('carries the shortlist when there is one, and no heading when there is not', async () => {
    await renderPanel(thread())
    expect(screen.queryByText(/PRIKAČENO/)).not.toBeInTheDocument()
    cleanup()

    await renderPanel(thread(), [
      {
        id: '44444444-4444-4444-8444-444444444444',
        authorName: 'Marko Petrović',
        excerpt: 'Zapisnik obavezan pre slanja partneru',
        isDeleted: false,
        pinnedBy: ME,
      },
    ])

    expect(screen.getByText('PRIKAČENO · 1')).toBeInTheDocument()
    expect(screen.getByText('Zapisnik obavezan pre slanja partneru')).toBeInTheDocument()
  })
})
