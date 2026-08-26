import { m, setLocale } from '@mr/i18n'
import {
  chatKeys,
  ChatConversationType,
  ClaimKind,
  type ChatConversationListItem,
  type ChatConversationListResponse,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { Route } from '~/routes/_shell/razgovori'

const navigate = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => navigate }
})

vi.mock('~/features/chat/conversation-pane', () => ({ ConversationPane: () => null }))
vi.mock('~/features/chat/pin-list', () => ({ PinListButton: () => null }))
vi.mock('~/lib/use-internal-auth-user', () => ({
  useInternalAuthUser: () => ({
    userId: '11111111-1111-4111-8111-111111111111',
    userName: 'Nikola Admin',
    isAdmin: true,
  }),
}))

const THREAD_ID = '22222222-2222-4222-8222-222222222222'
const CLAIM_ID = '33333333-3333-4333-8333-333333333333'

const THREAD: ChatConversationListItem = {
  id: THREAD_ID,
  type: ChatConversationType.Claim,
  title: 'MR-123',
  subtitle: 'Kupac',
  claimKind: ClaimKind.Emotive,
  claimId: CLAIM_ID,
  unreadCount: 0,
  isLocked: false,
  isMuted: false,
  lastMessageAt: null,
}

it('invalidates the cached claim lookup after an admin deletes its thread', async () => {
  setLocale('sr', { reload: false })
  vi.spyOn(Route, 'useSearch').mockReturnValue({ razgovor: THREAD_ID } as never)
  const conversations: ChatConversationListResponse = { items: [THREAD], unreadTotal: 0 }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const claimLookupKey = chatKeys.claimThread(ClaimKind.Emotive, CLAIM_ID)
  queryClient.setQueryData(chatKeys.conversations(), conversations)
  queryClient.setQueryData(claimLookupKey, { conversation: THREAD, canCreateThread: false })
  global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json(conversations),
  ) as unknown as typeof fetch

  const Component = Route.options.component as React.ComponentType
  render(
    <QueryClientProvider client={queryClient}>
      <Component />
    </QueryClientProvider>,
  )

  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: m.chat_erase() }))
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: m.chat_erase_confirm() }),
  )

  await waitFor(() => expect(queryClient.getQueryState(claimLookupKey)?.isInvalidated).toBe(true))
})
