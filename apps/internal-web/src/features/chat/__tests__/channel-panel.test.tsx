import { m, setLocale } from '@mr/i18n'
import { ChatConversationType, chatMembersOptions, type ChatConversationListItem } from '@mr/shared'
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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChannelPanel } from '~/features/chat/channel-panel'

const CHANNEL_ID = '33333333-3333-4333-8333-333333333333'
const ME = '11111111-1111-4111-8111-111111111111'
const SLAVKO = '22222222-2222-4222-8222-222222222222'

const CHANNEL: ChatConversationListItem = {
  id: CHANNEL_ID,
  type: ChatConversationType.Channel,
  title: 'Nabavka',
  subtitle: '',
  claimKind: null,
  claimId: null,
  unreadCount: 0,
  isLocked: false,
  isMuted: false,
  lastMessageAt: null,
}

let calls: Array<{ url: string; method: string }> = []

function install(members: Array<{ id: string; name: string; initials: string }>): void {
  calls = []
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? 'GET' })
    if (init?.method !== undefined && init.method !== 'GET') {
      return new Response(null, { status: 204 })
    }
    return Response.json({
      members,
      // ⚠ A different list from the members, and that is the point: „who may a mention name here"
      // IS the members for a channel, so offering that would offer only the people already in.
      addable: [{ id: SLAVKO, name: 'Slavko Jović', initials: 'SJ' }].filter(
        (person) => !members.some((member) => member.id === person.id),
      ),
    })
  }) as unknown as typeof fetch
}

async function renderPanel(isAdmin = false): Promise<QueryClient> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <ChannelPanel conversation={CHANNEL} currentUserId={ME} isAdmin={isAdmin} />,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await waitFor(() => {
    expect(queryClient.getQueryData(chatMembersOptions(CHANNEL_ID).queryKey)).toBeDefined()
  })
  return queryClient
}

describe('the channel panel', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('lists who is in the room', async () => {
    install([{ id: ME, name: 'Nikola Admin', initials: 'NA' }])
    await renderPanel()

    expect(screen.getByText('Nikola Admin')).toBeInTheDocument()
  })

  it('offers only the people who are NOT in it yet', async () => {
    install([{ id: ME, name: 'Nikola Admin', initials: 'NA' }])
    const user = userEvent.setup()
    await renderPanel()

    await user.click(screen.getByRole('button', { name: m.chat_channel_add_member() }))

    expect(screen.getByRole('button', { name: 'Slavko Jović' })).toBeInTheDocument()
    // Already inside — offering him again would be the bug this list exists to avoid.
    expect(screen.queryByRole('button', { name: 'Nikola Admin' })).not.toBeInTheDocument()
  })

  /**
   * ⚠ Says why an empty room is on screen at all. Without it an admin sees a channel nobody is in
   * and has no idea why it is there.
   */
  it('tells an admin why an empty channel is visible to them', async () => {
    install([])
    await renderPanel(true)

    expect(screen.getByText(m.chat_channel_empty_notice())).toBeInTheDocument()
  })

  it('offers the way out only to somebody who is actually in', async () => {
    install([{ id: SLAVKO, name: 'Slavko Jović', initials: 'SJ' }])
    await renderPanel(true)

    // An admin looking at a room they are not in has nothing to leave.
    expect(screen.queryByRole('button', { name: m.chat_channel_leave() })).not.toBeInTheDocument()
  })

  it('asks before letting somebody walk out', async () => {
    install([{ id: ME, name: 'Nikola Admin', initials: 'NA' }])
    const user = userEvent.setup()
    await renderPanel()

    await user.click(screen.getByRole('button', { name: m.chat_channel_leave() }))

    // ⚠ Through the shared confirm dialog: leaving is not undoable by the person who did it —
    // somebody has to add them back.
    expect(await screen.findByText(/Izlaziš iz kanala/)).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false)
  })
})
