import { setLocale } from '@mr/i18n'
import { ChatConversationType, type ChatConversationListItem } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'

import { NewChannelDialog } from '../new-channel-dialog'

const CHANNEL: ChatConversationListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  type: ChatConversationType.Channel,
  title: 'Motori',
  subtitle: '1 član',
  claimKind: null,
  claimId: null,
  unreadCount: 0,
  isLocked: false,
  isMuted: false,
  lastMessageAt: null,
}

const GENERAL_ID = '22222222-2222-4222-8222-222222222222'
const CREATOR_ID = '33333333-3333-4333-8333-333333333333'
const IVANA_ID = '44444444-4444-4444-8444-444444444444'
const MARKO_ID = '55555555-5555-4555-8555-555555555555'
const PEOPLE = [
  { id: CREATOR_ID, name: 'Nikola Nikolic', initials: 'NN' },
  { id: IVANA_ID, name: 'Ivana Ivanovic', initials: 'II' },
  { id: MARKO_ID, name: 'Marko Markovic', initials: 'MM' },
]

function DialogHarness(): React.ReactElement {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <NewChannelDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={vi.fn()}
        generalConversationId={GENERAL_ID}
        currentUserId={CREATOR_ID}
      />
    </>
  )
}

describe('NewChannelDialog', () => {
  beforeEach(() => setLocale('sr', { reload: false }))

  it('keeps the exact empty-members create payload regression', async () => {
    const bodies: unknown[] = []
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        bodies.push(JSON.parse(String(init.body)))
        return Response.json(CHANNEL, { status: 201 })
      }
      return Response.json({ items: PEOPLE })
    }) as unknown as typeof fetch
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <NewChannelDialog
          open
          onOpenChange={vi.fn()}
          onCreated={vi.fn()}
          generalConversationId={GENERAL_ID}
          currentUserId={CREATOR_ID}
        />
      </QueryClientProvider>,
    )

    await userEvent.type(screen.getByRole('textbox', { name: /ime kanala/i }), '  Motori  ')
    await userEvent.click(screen.getByRole('button', { name: /napravi kanal/i }))

    await waitFor(() => expect(bodies).toEqual([{ name: 'Motori', memberIds: [] }]))
  })

  it('fetches people only while open, filters the creator locally, and creates with selected members', async () => {
    const bodies: unknown[] = []
    const peopleRequests: string[] = []
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), 'http://localhost').pathname
      if (path === `/api/chat/conversations/${GENERAL_ID}/people`) {
        peopleRequests.push(path)
        return Response.json({ items: PEOPLE })
      }
      if (init?.method === 'POST') {
        bodies.push(JSON.parse(String(init.body)))
        return Response.json(CHANNEL, { status: 201 })
      }
      return Response.json({ items: [CHANNEL], unreadTotal: 0 })
    }) as unknown as typeof fetch
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <DialogHarness />
      </QueryClientProvider>,
    )

    expect(peopleRequests).toEqual([])

    await user.click(screen.getByRole('button', { name: 'open' }))
    await waitFor(() =>
      expect(peopleRequests).toEqual([`/api/chat/conversations/${GENERAL_ID}/people`]),
    )
    expect(screen.queryByText('Nikola Nikolic')).not.toBeInTheDocument()

    await user.type(screen.getByRole('searchbox'), 'ivana')
    expect(screen.getByText('Ivana Ivanovic')).toBeInTheDocument()
    expect(screen.queryByText('Marko Markovic')).not.toBeInTheDocument()
    expect(peopleRequests).toHaveLength(1)

    await user.clear(screen.getByRole('searchbox'))
    await user.click(screen.getByRole('checkbox', { name: 'Ivana Ivanovic' }))
    await user.click(screen.getByRole('checkbox', { name: 'Marko Markovic' }))
    await user.type(screen.getByRole('textbox', { name: /ime kanala/i }), 'Nabavka')
    await user.click(screen.getByRole('button', { name: /napravi kanal/i }))

    await waitFor(() =>
      expect(bodies).toEqual([{ name: 'Nabavka', memberIds: [IVANA_ID, MARKO_ID] }]),
    )
  })

  it('keeps the picker state after a 422 and resets it after close or success', async () => {
    let createStatus = 422
    let createRequests = 0
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), 'http://localhost').pathname
      if (path === `/api/chat/conversations/${GENERAL_ID}/people`) {
        return Response.json({ items: PEOPLE })
      }
      if (init?.method === 'POST') {
        createRequests += 1
        if (createStatus === 422) {
          return Response.json({ message: 'Invalid members' }, { status: 422 })
        }
        return Response.json(CHANNEL, { status: 201 })
      }
      return Response.json({ items: [CHANNEL], unreadTotal: 0 })
    }) as unknown as typeof fetch
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <DialogHarness />
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'open' }))
    await screen.findByRole('checkbox', { name: 'Ivana Ivanovic' })
    await user.type(screen.getByRole('searchbox'), 'ivana')
    await user.click(screen.getByRole('checkbox', { name: 'Ivana Ivanovic' }))
    await user.type(screen.getByRole('textbox', { name: /ime kanala/i }), 'Nabavka')
    await user.click(screen.getByRole('button', { name: /napravi kanal/i }))

    await waitFor(() => expect(createRequests).toBe(1))
    expect(screen.getByRole('textbox', { name: /ime kanala/i })).toHaveValue('Nabavka')
    expect(screen.getByRole('searchbox')).toHaveValue('ivana')
    expect(screen.getByRole('checkbox', { name: 'Ivana Ivanovic' })).toBeChecked()

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'open' }))
    await screen.findByRole('checkbox', { name: 'Ivana Ivanovic' })
    expect(screen.getByRole('textbox', { name: /ime kanala/i })).toHaveValue('')
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'Ivana Ivanovic' })).not.toBeChecked()

    createStatus = 201
    await user.click(screen.getByRole('checkbox', { name: 'Ivana Ivanovic' }))
    await user.type(screen.getByRole('textbox', { name: /ime kanala/i }), 'Nabavka')
    await user.click(screen.getByRole('button', { name: /napravi kanal/i }))
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: /ime kanala/i })).not.toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: 'open' }))
    await screen.findByRole('checkbox', { name: 'Ivana Ivanovic' })
    expect(screen.getByRole('textbox', { name: /ime kanala/i })).toHaveValue('')
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'Ivana Ivanovic' })).not.toBeChecked()
  })
})
