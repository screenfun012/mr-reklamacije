import { setLocale } from '@mr/i18n'
import type { ChatPin } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PinListButton, PinnedBar } from '~/features/chat/pin-list'

const CONVERSATION_ID = '99999999-9999-4999-8999-999999999999'
const ME = '00000000-0000-4000-8000-000000000001'
const SOMEBODY_ELSE = '00000000-0000-4000-8000-000000000002'

/** ⚠ Real UUIDs: the response is Zod-parsed, and a fixture id like 'a' fails the parse — which
 *  reaches the screen as an empty query, i.e. a component that draws nothing and a test that
 *  reads as a broken component. */
function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

function pin(over: Partial<ChatPin> & { id: string }): ChatPin {
  return {
    authorName: 'Marko Petrović',
    excerpt: 'Zapisnik obavezan pre slanja partneru',
    isDeleted: false,
    hasAttachment: false,
    pinnedBy: ME,
    ...over,
  }
}

let pins: ChatPin[] = []
let calls: { url: string; method: string }[] = []

function renderButton(isAdmin = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PinListButton conversationId={CONVERSATION_ID} currentUserId={ME} isAdmin={isAdmin} />
    </QueryClientProvider>,
  )
}

function renderBar({
  currentUserId = ME,
  isAdmin = false,
  isLocked = false,
}: {
  currentUserId?: string
  isAdmin?: boolean
  isLocked?: boolean
} = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PinnedBar
        conversationId={CONVERSATION_ID}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        isLocked={isLocked}
      />
    </QueryClientProvider>,
  )
}

describe('PinListButton', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    pins = []
    calls = []
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method ?? 'GET' })
      if (init?.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return Response.json({ items: pins })
    }) as unknown as typeof fetch
  })

  /**
   * ⚠ The prototype draws the button unconditionally (L87) because every one of its fixtures has
   * pins. An empty one opens onto a sentence saying there is nothing — a control whose only
   * purpose is to report its own emptiness.
   */
  it('is not there at all when nothing is pinned', async () => {
    renderButton()

    await waitFor(() => expect(calls.some((call) => call.url.endsWith('/pins'))).toBe(true))
    expect(screen.queryByText(/^PIN ·/)).not.toBeInTheDocument()
  })

  it('counts what is pinned and shows it when opened', async () => {
    pins = [pin({ id: uuid(1) }), pin({ id: uuid(2), excerpt: 'Partner traži odgovor do petka' })]
    const user = userEvent.setup()
    renderButton()

    await user.click(await screen.findByText('PIN · 2'))

    expect(screen.getByText('Zapisnik obavezan pre slanja partneru')).toBeInTheDocument()
    expect(screen.getByText('Partner traži odgovor do petka')).toBeInTheDocument()
  })

  /** A withdrawn message keeps its place on the shortlist and loses its words. */
  it('says a pinned message was taken back rather than repeating it', async () => {
    pins = [pin({ id: uuid(1), excerpt: '', isDeleted: true })]
    const user = userEvent.setup()
    renderButton()

    await user.click(await screen.findByText('PIN · 1'))

    expect(screen.getByText('Poruka obrisana')).toBeInTheDocument()
  })

  it('offers the ✕ for your own pin, and asks the server to take it down', async () => {
    pins = [pin({ id: uuid(1) })]
    const user = userEvent.setup()
    renderButton()

    await user.click(await screen.findByText('PIN · 1'))
    await user.click(screen.getByRole('button', { name: 'Skini sa prikačenih' }))

    await waitFor(() =>
      expect(calls.some((call) => call.method === 'DELETE' && call.url.endsWith('/pin'))).toBe(
        true,
      ),
    )
  })

  it('offers no ✕ for somebody else’s pin, and offers it to an admin', async () => {
    pins = [pin({ id: uuid(1), pinnedBy: SOMEBODY_ELSE })]
    const user = userEvent.setup()
    const mine = renderButton()

    await user.click(await screen.findByText('PIN · 1'))
    expect(screen.queryByRole('button', { name: 'Skini sa prikačenih' })).not.toBeInTheDocument()
    mine.unmount()

    renderButton(true)
    await user.click(await screen.findByText('PIN · 1'))
    expect(screen.getByRole('button', { name: 'Skini sa prikačenih' })).toBeInTheDocument()
  })
})

/**
 * Nikola, 2026-08-24: „nemamo kako da pinujemo poruku da se uvek vidi u smislu šta piše". The
 * shortlist behind a button answers that only for somebody who already went looking.
 */
describe('PinnedBar', () => {
  let deleteFails = false
  let holdDelete = false
  let releaseDelete: (() => void) | undefined

  beforeEach(() => {
    setLocale('sr', { reload: false })
    pins = []
    calls = []
    deleteFails = false
    holdDelete = false
    releaseDelete = undefined
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method })
      if (method === 'DELETE') {
        if (holdDelete) {
          await new Promise<void>((resolve) => {
            releaseDelete = resolve
          })
        }
        if (deleteFails) {
          return Response.json({ message: 'nope' }, { status: 500 })
        }
        pins = pins.filter((item) => !url.includes(item.id))
        return new Response(null, { status: 204 })
      }
      return Response.json({ items: pins })
    }) as unknown as typeof fetch
  })

  it('takes no room when nothing is pinned', async () => {
    renderBar()

    await waitFor(() => expect(calls.some((call) => call.url.endsWith('/pins'))).toBe(true))
    expect(screen.queryByText('Prikačeno')).not.toBeInTheDocument()
  })

  it('reads out the newest pin without anybody opening anything', async () => {
    pins = [pin({ id: uuid(1), excerpt: 'Partner traži odgovor do petka' })]
    renderBar()

    expect(await screen.findByText('Prikačeno')).toBeInTheDocument()
    expect(screen.getByText(/Partner traži odgovor do petka/)).toBeInTheDocument()
    expect(screen.getByText(/Marko Petrović/)).toBeInTheDocument()
  })

  /** One line, however many are pinned — a bar that grew per pin would push the room off screen. */
  it('shows one line and says how many there are in total', async () => {
    pins = [pin({ id: uuid(1), excerpt: 'Najnovije' }), pin({ id: uuid(2), excerpt: 'Starije' })]
    renderBar()

    expect(await screen.findByText('Prikačeno · 2')).toBeInTheDocument()
    expect(screen.getByText(/Najnovije/)).toBeInTheDocument()
    expect(screen.queryByText(/Starije/)).not.toBeInTheDocument()
  })

  it('lets the person who pinned the newest message remove it directly from the bar', async () => {
    pins = [pin({ id: uuid(1), excerpt: 'Najnovije' }), pin({ id: uuid(2), excerpt: 'Starije' })]
    holdDelete = true
    const user = userEvent.setup()
    renderBar()

    const unpin = await screen.findByRole('button', { name: 'Skini sa prikačenih' })
    await user.click(unpin)

    expect(unpin).toBeDisabled()
    expect(screen.getByText(/Najnovije/)).toBeInTheDocument()
    releaseDelete?.()
    expect(await screen.findByText(/Starije/)).toBeInTheDocument()
    expect(screen.queryByText(/Najnovije/)).not.toBeInTheDocument()
  })

  it('offers the bar action only to the person who pinned it, or to an admin', async () => {
    pins = [pin({ id: uuid(1), pinnedBy: SOMEBODY_ELSE })]
    const mine = renderBar()

    expect(await screen.findByText('Prikačeno')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skini sa prikačenih' })).not.toBeInTheDocument()
    mine.unmount()

    renderBar({ isAdmin: true })
    expect(await screen.findByRole('button', { name: 'Skini sa prikačenih' })).toBeInTheDocument()
  })

  it('keeps the bar read-only in a locked claim thread', async () => {
    pins = [pin({ id: uuid(1) })]
    renderBar({ isLocked: true })

    expect(await screen.findByText('Prikačeno')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skini sa prikačenih' })).not.toBeInTheDocument()
  })

  it('keeps the pin visible when taking it down fails', async () => {
    pins = [pin({ id: uuid(1), excerpt: 'Ostaje važno' })]
    deleteFails = true
    const user = userEvent.setup()
    renderBar()

    const unpin = await screen.findByRole('button', { name: 'Skini sa prikačenih' })
    await user.click(unpin)

    await waitFor(() => expect(unpin).not.toBeDisabled())
    expect(screen.getByText(/Ostaje važno/)).toBeInTheDocument()
  })
})
