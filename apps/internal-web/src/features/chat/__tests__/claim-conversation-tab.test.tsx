import { m, setLocale } from '@mr/i18n'
import {
  ChatConversationType,
  ClaimKind,
  ClaimOutcome,
  type ChatConversationListItem,
  type ChatMessagesPage,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ClaimConversationTab } from '~/features/chat/claim-conversation-tab'

vi.mock('~/lib/use-internal-auth-user', () => ({
  useInternalAuthUser: () => ({ userName: 'Marko Petrović', userEmail: 'marko@mr.rs' }),
}))

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'
const THREAD_ID = '33333333-3333-4333-8333-333333333333'

const THREAD: ChatConversationListItem = {
  id: THREAD_ID,
  type: ChatConversationType.Claim,
  title: '7167/25',
  subtitle: 'Auto Stanić',
  claimKind: ClaimKind.Emotive,
  claimId: CLAIM_ID,
  unreadCount: 0,
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
      attachments: [],
      mentions: [],
    },
  ],
  nextCursor: null,
  hasMore: false,
}

/** Every POST the screen made, so "nothing was created" can be COUNTED and not assumed. */
let threadPosts: string[] = []
let conversationReads = 0
let lookupReads: string[] = []
let threads: ChatConversationListItem[] = []
let lookupConversation: ChatConversationListItem | null = null
let muteCalls: string[] = []

function installFetch(): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === 'POST' && url.includes('/thread')) {
      threadPosts.push(url)
      threads = [THREAD]
      return Response.json(THREAD, { status: 201 })
    }
    if (url.endsWith('/mute') && (init?.method === 'POST' || init?.method === 'DELETE')) {
      muteCalls.push(init.method)
      if (lookupConversation !== null) {
        lookupConversation = { ...lookupConversation, isMuted: init.method === 'POST' }
      }
      return new Response(null, { status: 204 })
    }
    if (init?.method === 'POST') {
      return new Response(null, { status: 204 })
    }
    if (url.includes('/messages')) {
      return Response.json(MESSAGES)
    }
    if (url.includes(`/api/chat/claims/${ClaimKind.Emotive}/${CLAIM_ID}/thread`)) {
      lookupReads.push(url)
      return Response.json({ conversation: lookupConversation, canCreateThread: false })
    }
    conversationReads += 1
    return Response.json({ items: threads, unreadTotal: 0 })
  }) as unknown as typeof fetch
}

function renderTab(outcome = ClaimOutcome.Pending): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ClaimConversationTab kind={ClaimKind.Emotive} claimId={CLAIM_ID} outcome={outcome} />
    </QueryClientProvider>,
  )
}

describe('ClaimConversationTab', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    threadPosts = []
    conversationReads = 0
    lookupReads = []
    threads = []
    lookupConversation = null
    muteCalls = []
    installFetch()
  })

  /**
   * ⚠ The rule the whole design rests on (spec §5 row 15): nothing is created silently. Opening
   * the tab is looking at a claim, not deciding that the shop needs a room to talk about it.
   *
   * The assertion is the number of threads CREATED, not the status of a request — a call that
   * answers 200 because the get-or-create endpoint found an existing row still made one the
   * first time round.
   */
  it('creates nothing by being opened — a claim without a thread is offered one', async () => {
    renderTab()

    // The list is what the tab decides on; once it is in, the tab has drawn whatever it draws.
    await waitFor(() => {
      expect(conversationReads).toBeGreaterThan(0)
    })
    // A negative has nothing to wait FOR, so it gets a settle: anything the render kicked off
    // has landed in `threadPosts` by now.
    await new Promise((resolve) => setTimeout(resolve, 50))

    // ⚠ The COUNT first, and on purpose. `POST /thread` is get-or-create, so a request that
    // answers 200 still wrote a row the first time — a test that reads the status instead of
    // counting the threads passes while the rule is broken.
    expect(threadPosts).toEqual([])
    expect(screen.getByText(m.chat_thread_create_title())).toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.chat_thread_create_confirm() })).toBeInTheDocument()
  })

  it('makes the thread when it is asked to, and then shows it', async () => {
    renderTab()

    await userEvent.click(
      await screen.findByRole('button', { name: m.chat_thread_create_confirm() }),
    )

    await waitFor(() => {
      expect(threadPosts).toEqual([`/api/chat/claims/emotive/${CLAIM_ID}/thread`])
    })
    expect(await screen.findByText('Glava je stigla')).toBeInTheDocument()
  })

  it('mounts the same conversation the chat screen mounts — with no claim panel beside it', async () => {
    threads = [THREAD]
    renderTab()

    expect(await screen.findByText('Glava je stigla')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /poruka/i })).toBeInTheDocument()
    // The detail IS the context (spec §8.5) — the third column would repeat the screen it is on.
    expect(screen.queryByText(m.chat_context_claim())).not.toBeInTheDocument()
    expect(screen.queryByText(m.chat_context_footer())).not.toBeInTheDocument()
  })

  it('uses the active conversation list for a pending claim and never performs a lookup', async () => {
    threads = [THREAD]
    renderTab(ClaimOutcome.Pending)

    expect(await screen.findByText('Glava je stigla')).toBeInTheDocument()
    expect(conversationReads).toBeGreaterThan(0)
    expect(lookupReads).toEqual([])
  })

  it.each([ClaimOutcome.Accepted, ClaimOutcome.Rejected, ClaimOutcome.Archived])(
    'uses the exact read-only lookup for a %s claim and keeps its thread as history',
    async (outcome) => {
      lookupConversation = { ...THREAD, isLocked: true }
      renderTab(outcome)

      expect(await screen.findByText('Glava je stigla')).toBeInTheDocument()
      expect(lookupReads).toEqual([`/api/chat/claims/${ClaimKind.Emotive}/${CLAIM_ID}/thread`])
      expect(screen.queryByRole('button', { name: m.chat_thread_create_confirm() })).toBeNull()
    },
  )

  it('shows a quiet empty state without a create button when a closed claim never had a thread', async () => {
    renderTab(ClaimOutcome.Accepted)

    expect(await screen.findByText(/razgovor nije započet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: m.chat_thread_create_confirm() })).toBeNull()
    expect(threadPosts).toEqual([])
  })

  it('takes no more words once the claim is decided, and says so', async () => {
    // Nikola, 23.08.: the conversation is read on the claim and nowhere else once it is closed.
    threads = [{ ...THREAD, isLocked: true }]
    renderTab()

    expect(await screen.findByText(/razgovor zatvoren/i)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('keeps mute and unmute on closed history while every message mutation stays hidden', async () => {
    const user = userEvent.setup()
    lookupConversation = { ...THREAD, isLocked: true }
    renderTab(ClaimOutcome.Accepted)

    expect(await screen.findByText('Glava je stigla')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Odgovori na poruku' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sviđa mi se' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Prikači poruku' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pokušaj ponovo/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Utišaj nit' }))
    await waitFor(() => expect(muteCalls).toEqual(['POST']))

    await user.click(await screen.findByRole('button', { name: 'Uključi obaveštenja za nit' }))
    await waitFor(() => expect(muteCalls).toEqual(['POST', 'DELETE']))
  })
})
