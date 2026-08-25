import { m, setLocale } from '@mr/i18n'
import {
  ChatConversationType,
  chatMembersOptions,
  type ChatConversationListItem,
  type ChatMembersResponse,
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

const NIKOLA = { id: ME, name: 'Nikola Admin', initials: 'NA' }
const SLAVKO_PERSON = { id: SLAVKO, name: 'Slavko Jović', initials: 'SJ' }

let calls: Array<{ url: string; method: string; body: unknown }> = []

function install(response: ChatMembersResponse): void {
  calls = []
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    })
    if (init?.method !== undefined && init.method !== 'GET') {
      return new Response(null, { status: 204 })
    }
    return Response.json(response)
  }) as unknown as typeof fetch
}

async function renderPanel(onDeleted = vi.fn()): Promise<QueryClient> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => (
      <ChannelPanel conversation={CHANNEL} currentUserId={ME} onDeleted={onDeleted} />
    ),
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
    window.scrollTo = vi.fn()
  })

  it('shows an ordinary member the roster without manager controls', async () => {
    install({ members: [NIKOLA, SLAVKO_PERSON], addable: [], canManage: false })
    await renderPanel()

    expect(screen.getByText('Nikola Admin')).toBeInTheDocument()
    expect(screen.getByText('Slavko Jović')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: m.chat_channel_add_member() })).toBeNull()
    expect(screen.queryByRole('button', { name: m.chat_channel_remove_member() })).toBeNull()
    expect(screen.queryByRole('button', { name: m.chat_erase() })).toBeNull()
  })

  it('shows manager controls but never puts a remove button beside the current user', async () => {
    install({ members: [NIKOLA, SLAVKO_PERSON], addable: [], canManage: true })
    await renderPanel()

    expect(screen.getByRole('button', { name: m.chat_channel_add_member() })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.chat_erase() })).toBeInTheDocument()
    expect(
      within(screen.getByText('Nikola Admin').closest('li') as HTMLElement).queryByRole('button'),
    ).toBeNull()
    expect(
      within(screen.getByText('Slavko Jović').closest('li') as HTMLElement).getByRole('button', {
        name: m.chat_channel_remove_member(),
      }),
    ).toBeInTheDocument()
  })

  it('adds a later member only after confirming that they receive the full history', async () => {
    install({ members: [NIKOLA], addable: [SLAVKO_PERSON], canManage: true })
    const user = userEvent.setup()
    await renderPanel()

    await user.click(screen.getByRole('button', { name: m.chat_channel_add_member() }))
    await user.click(screen.getByRole('button', { name: 'Slavko Jović' }))

    expect(await screen.findByText(m.chat_channel_history_warning())).toBeInTheDocument()
    expect(calls.filter((call) => call.method === 'POST')).toEqual([])

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: m.chat_channel_add_member() }))

    await waitFor(() =>
      expect(calls.filter((call) => call.method === 'POST')).toEqual([
        {
          url: `/api/chat/conversations/${CHANNEL_ID}/members`,
          method: 'POST',
          body: { userIds: [SLAVKO] },
        },
      ]),
    )
  })

  it('keeps leaving as a separate confirmation instead of a remove button on self', async () => {
    install({ members: [NIKOLA], addable: [], canManage: true })
    const user = userEvent.setup()
    await renderPanel()

    expect(screen.queryByRole('button', { name: m.chat_channel_remove_member() })).toBeNull()
    await user.click(screen.getByRole('button', { name: m.chat_channel_leave() }))

    expect(await screen.findByText(/Izlaziš iz kanala/)).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false)
  })

  it('asks a manager for destructive confirmation before deleting the channel', async () => {
    install({ members: [NIKOLA], addable: [], canManage: true })
    const onDeleted = vi.fn()
    const user = userEvent.setup()
    await renderPanel(onDeleted)

    await user.click(screen.getByRole('button', { name: m.chat_erase() }))

    expect(calls.some((call) => call.method === 'DELETE')).toBe(false)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(m.chat_erase_description())).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: m.chat_erase_confirm() })).toHaveClass(
      'bg-destructive',
    )

    await user.click(within(dialog).getByRole('button', { name: m.chat_erase_confirm() }))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(CHANNEL_ID))
  })
})
