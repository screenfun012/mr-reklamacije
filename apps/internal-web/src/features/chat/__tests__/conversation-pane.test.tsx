import { setLocale } from '@mr/i18n'
import { ChatSystemKind, type ChatMessage, type ChatMessagesPage } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ConversationPane } from '~/features/chat/conversation-pane'

const CONVERSATION_ID = '99999999-9999-4999-8999-999999999999'

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

function message(over: Partial<ChatMessage> & { seq: string }): ChatMessage {
  return {
    id: uuid(Number(over.seq)),
    conversationId: CONVERSATION_ID,
    clientMsgId: uuid(500 + Number(over.seq)),
    author: { id: uuid(900), name: 'Slavko Jović', initials: 'SJ' },
    body: 'Stigao motor za MR 7102/25',
    quoteOf: null,
    systemKind: null,
    systemMeta: null,
    editedAt: null,
    deletedAt: null,
    createdAt: '2026-08-23T08:42:00.000Z',
    reactionCount: 0,
    reactedByMe: false,
    ...over,
  }
}

function page(items: ChatMessage[]): ChatMessagesPage {
  return { items, nextCursor: null, hasMore: false }
}

interface FetchCall {
  url: string
  body: unknown
}

let calls: FetchCall[] = []
let sendReply: (message: ChatMessage) => void = () => undefined
let sendFails = false
let initialPage: ChatMessagesPage = page([message({ seq: '41' })])

function installFetch(): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body: unknown = init?.body === undefined ? undefined : JSON.parse(String(init.body))
    calls.push({ url, body })

    if (url.includes('/read')) {
      return new Response(null, { status: 204 })
    }
    if (init?.method === 'POST') {
      if (sendFails) {
        return new Response(JSON.stringify({ message: 'nope' }), { status: 500 })
      }
      return await new Promise<Response>((resolve) => {
        sendReply = (created) => resolve(Response.json(created, { status: 201 }))
      })
    }
    return Response.json(initialPage)
  }) as unknown as typeof fetch
}

function renderPane(unreadCount = 0) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>…</p>}>
        <ConversationPane
          conversationId={CONVERSATION_ID}
          unreadCount={unreadCount}
          authorName="Marko Petrović"
        />
      </Suspense>
    </QueryClientProvider>,
  )
  return { ...result, queryClient }
}

function composer(): HTMLElement {
  return screen.getByRole('textbox', { name: /poruka/i })
}

describe('ConversationPane', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-23T09:00:00.000Z'))
    calls = []
    sendFails = false
    initialPage = page([message({ seq: '41' })])
    installFetch()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('draws a message with its author and the time in the shop clock', async () => {
    renderPane()

    expect(await screen.findByText('Slavko Jović')).toBeInTheDocument()
    expect(screen.getByText('Stigao motor za MR 7102/25')).toBeInTheDocument()
    // 08:42 UTC is 10:42 in Belgrade. The test process runs on TZ=UTC exactly so an unpinned
    // formatter would print 08:42 here and be an hour wrong for every person in the shop.
    expect(screen.getByText('10:42')).toBeInTheDocument()
  })

  it('draws a system event as a pill instead of somebody talking', async () => {
    initialPage = page([
      message({
        seq: '41',
        author: null,
        body: '',
        systemKind: ChatSystemKind.OutcomeChanged,
        systemMeta: { outcome: 'accepted' },
      }),
    ])
    renderPane()

    const pill = await screen.findByRole('status')
    expect(pill).toHaveTextContent('Prihvaćeno')
    expect(pill).toHaveTextContent('↻')
  })

  it('marks everything read with the newest seq once the conversation is open', async () => {
    renderPane(3)

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/read'))).toBe(true)
    })
    const read = calls.find((call) => call.url.includes('/read'))
    expect(read?.body).toEqual({ lastSeq: '41' })
  })

  it('puts a quick reply into the field and sends nothing', async () => {
    const user = userEvent.setup()
    renderPane()
    await screen.findByText('Slavko Jović')

    await user.click(screen.getByRole('button', { name: 'Stigao motor' }))

    expect(composer()).toHaveValue('Stigao motor')
    expect(calls.filter((call) => call.body !== undefined && !call.url.includes('/read'))).toEqual(
      [],
    )
  })

  it('draws the attachment and camera buttons, inert and saying so', async () => {
    renderPane()
    await screen.findByText('Slavko Jović')

    const attach = screen.getByRole('button', { name: /prilog/i })
    expect(attach).toBeDisabled()
    expect(attach).toHaveAttribute('title', expect.stringMatching(/sledećem koraku/i))
    expect(screen.getByRole('button', { name: /kamera/i })).toBeDisabled()
  })

  it('sends on Enter, and Shift+Enter only breaks the line', async () => {
    const user = userEvent.setup()
    renderPane()
    await screen.findByText('Slavko Jović')

    await user.click(composer())
    await user.keyboard('prvi red{Shift>}{Enter}{/Shift}drugi red')
    expect(composer()).toHaveValue('prvi red\ndrugi red')
    expect(calls.some((call) => call.url.endsWith('/messages') && call.body !== undefined)).toBe(
      false,
    )

    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(calls.some((call) => call.url.endsWith('/messages') && call.body !== undefined)).toBe(
        true,
      )
    })
  })

  it('shows the message the moment it is written and replaces it when the server answers', async () => {
    const user = userEvent.setup()
    renderPane()
    await screen.findByText('Slavko Jović')

    await user.click(composer())
    await user.keyboard('Krećem po motor{Enter}')

    const optimistic = await screen.findByText('Krećem po motor')
    expect(optimistic.closest('[aria-busy="true"]')).not.toBeNull()

    const posted = calls.find((call) => call.url.endsWith('/messages') && call.body !== undefined)
    const clientMsgId = (posted?.body as { clientMsgId: string }).clientMsgId
    sendReply(message({ seq: '42', clientMsgId, body: 'Krećem po motor', author: null }))

    await waitFor(() => {
      expect(screen.getByText('Krećem po motor').closest('[aria-busy="true"]')).toBeNull()
    })
    expect(screen.getAllByText('Krećem po motor')).toHaveLength(1)
  })

  it('never draws the message twice once the server row is in the cache', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderPane()
    await screen.findByText('Slavko Jović')

    await user.click(composer())
    await user.keyboard('Krećem po motor{Enter}')
    await screen.findByText('Krećem po motor')

    const posted = calls.find((call) => call.url.endsWith('/messages') && call.body !== undefined)
    const clientMsgId = (posted?.body as { clientMsgId: string }).clientMsgId

    // The realtime signal can beat the POST's own answer: the list refetches, the row is already
    // there, and the optimistic copy has to recognise itself by `clientMsgId` — nothing else on
    // it matches, because the id and the seq are the server's.
    queryClient.setQueryData(
      ['chat', 'messages', CONVERSATION_ID],
      (current: ChatMessagesPage) => ({
        ...current,
        items: [
          ...current.items,
          message({ seq: '42', clientMsgId, body: 'Krećem po motor', author: null }),
        ],
      }),
    )

    // The optimistic copy has to RECOGNISE itself in the server's row and stand down. Waiting for
    // the count alone would pass while it is still the only thing on screen, which proves nothing.
    await waitFor(() => {
      expect(screen.queryByText('šalje se…')).toBeNull()
    })
    expect(screen.getAllByText('Krećem po motor')).toHaveLength(1)
  })

  it('offers a retry that sends the same clientMsgId, never a second message', async () => {
    const user = userEvent.setup()
    sendFails = true
    renderPane()
    await screen.findByText('Slavko Jović')

    await user.click(composer())
    await user.keyboard('Krećem po motor{Enter}')

    const retry = await screen.findByRole('button', { name: /pokušaj ponovo/i })
    const first = calls.find((call) => call.url.endsWith('/messages') && call.body !== undefined)
    await user.click(retry)

    await waitFor(() => {
      expect(
        calls.filter((call) => call.url.endsWith('/messages') && call.body !== undefined),
      ).toHaveLength(2)
    })
    const sent = calls.filter((call) => call.url.endsWith('/messages') && call.body !== undefined)
    expect((sent[1]?.body as { clientMsgId: string }).clientMsgId).toBe(
      (first?.body as { clientMsgId: string }).clientMsgId,
    )
  })

  it('does not yank the reader down while he is reading history', async () => {
    const { queryClient } = renderPane()
    await screen.findByText('Slavko Jović')

    const pane = screen.getByRole('log')
    Object.defineProperty(pane, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(pane, 'clientHeight', { value: 300, configurable: true })
    Object.defineProperty(pane, 'scrollTop', { value: 0, writable: true, configurable: true })
    pane.dispatchEvent(new Event('scroll', { bubbles: true }))

    queryClient.setQueryData(
      ['chat', 'messages', CONVERSATION_ID],
      (current: ChatMessagesPage) => ({
        ...current,
        items: [...current.items, message({ seq: '42', body: 'Nova poruka' })],
      }),
    )

    await screen.findByText('Nova poruka')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nove poruke/i })).toBeInTheDocument()
    })
    expect(pane.scrollTop).toBe(0)
  })

  it('follows the conversation down when the reader is already at the bottom', async () => {
    const { queryClient } = renderPane()
    await screen.findByText('Slavko Jović')

    const pane = screen.getByRole('log')
    Object.defineProperty(pane, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(pane, 'clientHeight', { value: 300, configurable: true })
    Object.defineProperty(pane, 'scrollTop', { value: 660, writable: true, configurable: true })
    pane.dispatchEvent(new Event('scroll', { bubbles: true }))

    queryClient.setQueryData(
      ['chat', 'messages', CONVERSATION_ID],
      (current: ChatMessagesPage) => ({
        ...current,
        items: [...current.items, message({ seq: '42', body: 'Nova poruka' })],
      }),
    )

    await screen.findByText('Nova poruka')
    await waitFor(() => {
      expect(pane.scrollTop).toBe(1000)
    })
  })

  it('separates what was already read from what is new', async () => {
    initialPage = page([
      message({ seq: '40', body: 'Staro' }),
      message({ seq: '41', body: 'Novo' }),
    ])
    renderPane(1)

    const separator = await screen.findByText('NOVO')
    const rows = within(screen.getByRole('log')).getAllByRole('article')
    expect(rows).toHaveLength(2)
    // It stands between them: after the read one, before the unread one.
    expect(separator.compareDocumentPosition(rows[1] as HTMLElement)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })
})
