import { setLocale } from '@mr/i18n'
import {
  chatKeys,
  ChatConversationType,
  ClaimKind,
  type ChatChannelManagementListResponse,
  type ChatConversationListItem,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'

import { ChannelManagementDialog } from '../channel-management-dialog'
import { handleChannelDeleted } from '~/routes/_shell/razgovori'

const GENERAL_ID = '11111111-1111-4111-8111-111111111111'
const CHANNEL_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_CHANNEL_ID = '33333333-3333-4333-8333-333333333333'
const ME = '44444444-4444-4444-8444-444444444444'
const MEMBER = '55555555-5555-4555-8555-555555555555'

const GENERAL: ChatConversationListItem = {
  id: GENERAL_ID,
  type: ChatConversationType.General,
  title: 'Opšti kanal',
  subtitle: '9 članova',
  claimKind: null,
  claimId: null,
  unreadCount: 0,
  isLocked: false,
  isMuted: false,
  lastMessageAt: null,
}

const CHANNEL: ChatConversationListItem = {
  ...GENERAL,
  id: CHANNEL_ID,
  type: ChatConversationType.Channel,
  title: 'Nabavka delova',
}

const MANAGEMENT: ChatChannelManagementListResponse = {
  items: [
    { id: CHANNEL_ID, name: 'Nabavka delova', creatorName: 'Petar Petrović', memberCount: 2 },
    { id: OTHER_CHANNEL_ID, name: 'Stari kanal', creatorName: null, memberCount: 0 },
  ],
  total: 52,
  page: 1,
  pageSize: 50,
}

interface RequestRecord {
  path: string
  method: string
  search: string
  body: unknown
}

let requests: RequestRecord[] = []

function installFetch(): void {
  requests = []
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    requests.push({
      path: url.pathname,
      method,
      search: url.search,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    })

    if (method !== 'GET') {
      return new Response(null, { status: 204 })
    }
    if (url.pathname === `/api/chat/conversations/${CHANNEL_ID}/members`) {
      return Response.json({
        members: [{ id: MEMBER, name: 'Slavko Jović', initials: 'SJ' }],
        addable: [{ id: ME, name: 'Nikola Nikolić', initials: 'NN' }],
        canManage: true,
      })
    }
    if (url.pathname === `/api/chat/conversations/${OTHER_CHANNEL_ID}/members`) {
      return Response.json({ members: [], addable: [], canManage: true })
    }
    if (url.pathname === '/api/chat/channels/manage') {
      const page = Number(url.searchParams.get('page'))
      const search = url.searchParams.get('search')
      return Response.json({
        ...MANAGEMENT,
        items: search === 'stari' ? [MANAGEMENT.items[1]] : MANAGEMENT.items,
        page,
      })
    }
    return Response.json({ items: [GENERAL, CHANNEL], unreadTotal: 0 })
  }) as unknown as typeof fetch
}

function DialogHarness({
  initiallyOpen = false,
  selectedConversationId = null,
  onDeleted = vi.fn(),
}: {
  initiallyOpen?: boolean
  selectedConversationId?: string | null
  onDeleted?: (conversationId: string) => void
}): React.ReactElement {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <ChannelManagementDialog
        open={open}
        onOpenChange={setOpen}
        currentUserId={ME}
        selectedConversationId={selectedConversationId}
        onDeleted={onDeleted}
      />
    </>
  )
}

function renderDialog(ui: React.ReactElement): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
  return queryClient
}

function managementRequests(): RequestRecord[] {
  return requests.filter((request) => request.path === '/api/chat/channels/manage')
}

describe('ChannelManagementDialog', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    installFetch()
  })

  afterEach(() => vi.useRealTimers())

  it('does not fetch while closed, then loads one metadata page without roster N+1 requests', async () => {
    const user = userEvent.setup()
    renderDialog(<DialogHarness />)

    expect(requests).toEqual([])
    await user.click(screen.getByRole('button', { name: 'open' }))

    expect(await screen.findByText('Nabavka delova')).toBeInTheDocument()
    expect(screen.getByText('Kreirao: Petar Petrović')).toBeInTheDocument()
    expect(screen.getByText('Onemogućen nalog')).toBeInTheDocument()
    expect(screen.getByText('Članovi: 2')).toHaveClass('tabular-nums')
    expect(managementRequests()[0]?.search).toBe('?page=1&pageSize=50')
    expect(requests.some((request) => request.path.endsWith('/members'))).toBe(false)
    expect(requests.some((request) => /\/(messages|pins|attachments)$/.test(request.path))).toBe(
      false,
    )
  })

  it('debounces search for 300ms and resets the current page to one', async () => {
    renderDialog(<DialogHarness initiallyOpen />)
    await screen.findByText('Nabavka delova')

    fireEvent.click(screen.getByRole('button', { name: 'Sledeća strana' }))
    await waitFor(() => expect(managementRequests().at(-1)?.search).toContain('page=2'))

    vi.useFakeTimers()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Pretraži kanale' }), {
      target: { value: 'stari' },
    })
    const beforeDebounce = managementRequests().length

    await act(async () => vi.advanceTimersByTimeAsync(299))
    expect(managementRequests()).toHaveLength(beforeDebounce)

    await act(async () => vi.advanceTimersByTimeAsync(1))
    vi.useRealTimers()
    await waitFor(() =>
      expect(managementRequests().at(-1)?.search).toBe('?search=stari&page=1&pageSize=50'),
    )
  })

  it('does not reset a freshly selected page when the unchanged initial search reaches 300ms', async () => {
    vi.useFakeTimers()
    renderDialog(<DialogHarness initiallyOpen />)
    await act(async () => vi.advanceTimersByTimeAsync(0))

    fireEvent.click(screen.getByRole('button', { name: 'Sledeća strana' }))
    await act(async () => vi.advanceTimersByTimeAsync(0))
    expect(managementRequests().at(-1)?.search).toContain('page=2')

    await act(async () => vi.advanceTimersByTimeAsync(300))

    expect(managementRequests().at(-1)?.search).toContain('page=2')
  })

  it('loads the reusable roster only after selection and lets an outside manager self-add', async () => {
    const user = userEvent.setup()
    renderDialog(<DialogHarness initiallyOpen />)
    await screen.findByText('Nabavka delova')

    await user.click(screen.getByRole('button', { name: /Nabavka delova/ }))
    expect(await screen.findByText('Slavko Jović')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dodaj čoveka' }))
    await user.click(screen.getByRole('button', { name: 'Nikola Nikolić' }))

    expect(
      screen.getByText('Novi članovi vide celu dosadašnju istoriju kanala.'),
    ).toBeInTheDocument()
    expect(requests.filter((request) => request.method === 'POST')).toEqual([])
    await user.click(
      within(screen.getByRole('dialog', { name: 'Dodaj čoveka' })).getByRole('button', {
        name: 'Dodaj čoveka',
      }),
    )

    await waitFor(() =>
      expect(requests.filter((request) => request.method === 'POST')).toContainEqual({
        path: `/api/chat/conversations/${CHANNEL_ID}/members`,
        method: 'POST',
        search: '',
        body: { userIds: [ME] },
      }),
    )
  })

  it('renames through the 204 PATCH endpoint and never asks for message content', async () => {
    const user = userEvent.setup()
    renderDialog(<DialogHarness initiallyOpen />)
    await user.click(await screen.findByRole('button', { name: /Nabavka delova/ }))
    await screen.findByText('Slavko Jović')

    const name = screen.getByRole('textbox', { name: 'Ime kanala' })
    await user.clear(name)
    await user.type(name, 'Delovi')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    await waitFor(() =>
      expect(requests).toContainEqual({
        path: `/api/chat/conversations/${CHANNEL_ID}`,
        method: 'PATCH',
        search: '',
        body: { name: 'Delovi' },
      }),
    )
    expect(requests.some((request) => /\/(messages|pins|attachments)$/.test(request.path))).toBe(
      false,
    )
  })

  it('deletes through confirmation and reports the exact selected row', async () => {
    const onDeleted = vi.fn()
    const user = userEvent.setup()
    renderDialog(<DialogHarness initiallyOpen onDeleted={onDeleted} />)
    await user.click(await screen.findByRole('button', { name: /Nabavka delova/ }))

    await user.click(screen.getByRole('button', { name: 'Obriši kanal' }))
    expect(requests.some((request) => request.method === 'DELETE')).toBe(false)

    const confirm = screen.getByRole('dialog', { name: 'Obrisati ovaj razgovor zauvek?' })
    await user.click(within(confirm).getByRole('button', { name: 'OBRIŠI' }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(CHANNEL_ID))
  })
})

describe('the route channel-delete fallback', () => {
  it('invalidates metadata and the matching claim lookup before selecting General', () => {
    const queryClient = new QueryClient()
    const matchingKey = chatKeys.claimThread(
      ClaimKind.Emotive,
      '66666666-6666-4666-8666-666666666666',
    )
    const otherKey = chatKeys.claimThread(ClaimKind.Domace, '77777777-7777-4777-8777-777777777777')
    queryClient.setQueryData(chatKeys.channelManagementList({ page: 1, pageSize: 50 }), MANAGEMENT)
    queryClient.setQueryData(matchingKey, { conversation: CHANNEL, canCreateThread: false })
    queryClient.setQueryData(otherKey, {
      conversation: { ...CHANNEL, id: OTHER_CHANNEL_ID },
      canCreateThread: false,
    })
    const selections: string[] = []

    handleChannelDeleted({
      queryClient,
      deletedId: CHANNEL_ID,
      selectedId: CHANNEL_ID,
      generalId: GENERAL_ID,
      selectConversation: (id) => {
        expect(queryClient.getQueryState(matchingKey)?.isInvalidated).toBe(true)
        expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false)
        expect(
          queryClient.getQueryState(chatKeys.channelManagementList({ page: 1, pageSize: 50 }))
            ?.isInvalidated,
        ).toBe(true)
        selections.push(id)
      },
    })

    expect(selections).toEqual([GENERAL_ID])
  })

  it('does not move the current chat when a different managed channel is deleted', () => {
    const selections: string[] = []

    handleChannelDeleted({
      queryClient: new QueryClient(),
      deletedId: OTHER_CHANNEL_ID,
      selectedId: CHANNEL_ID,
      generalId: GENERAL_ID,
      selectConversation: (id) => selections.push(id),
    })

    expect(selections).toEqual([])
  })
})
