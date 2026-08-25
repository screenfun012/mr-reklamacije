import { setLocale } from '@mr/i18n'
import { ChatConversationType, type ChatConversationListItem } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('NewChannelDialog', () => {
  beforeEach(() => setLocale('sr', { reload: false }))

  it('adapts the name-only form to the channel-create payload until member picking lands', async () => {
    const bodies: unknown[] = []
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        bodies.push(JSON.parse(String(init.body)))
        return Response.json(CHANNEL, { status: 201 })
      }
      return Response.json({ items: [CHANNEL], unreadTotal: 0 })
    }) as unknown as typeof fetch
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <NewChannelDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />
      </QueryClientProvider>,
    )

    await userEvent.type(screen.getByRole('textbox', { name: /ime kanala/i }), '  Motori  ')
    await userEvent.click(screen.getByRole('button', { name: /napravi kanal/i }))

    await waitFor(() => expect(bodies).toEqual([{ name: 'Motori', memberIds: [] }]))
  })
})
