import { setLocale } from '@mr/i18n'
import {
  ChatConversationType,
  chatConversationsOptions,
  type ChatConversationListItem,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InternalSidebar } from '~/components/layout/internal-sidebar'
import { internalNavItems } from '~/config/navigation'

const RAZGOVORI = internalNavItems.filter((item) => item.key === 'razgovori')

function conversation(unreadCount: number, isMuted: boolean): ChatConversationListItem {
  return {
    id: `1111111${unreadCount}-1111-4111-8111-111111111111`,
    type: ChatConversationType.General,
    title: 'Opšti kanal',
    subtitle: '',
    claimKind: null,
    claimId: null,
    unreadCount,
    isMuted,
    lastMessageAt: null,
  }
}

async function renderSidebar(data: { items: ChatConversationListItem[]; unreadTotal: number }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(chatConversationsOptions().queryKey, data)

  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <InternalSidebar
          items={RAZGOVORI}
          userName="QA"
          userEmail="qa@local.test"
          onLogout={vi.fn()}
          collapsed={false}
          mobileOpen={false}
          onCloseMobile={vi.fn()}
        />
      </QueryClientProvider>
    ),
  })
  const chatRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/razgovori',
    component: () => null,
  })
  const securityRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings/security',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([chatRoute, securityRoute]),
    history: createMemoryHistory({ initialEntries: ['/razgovori'] }),
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
}

describe('Razgovori — the menu badge', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('is the unreadTotal the server sends, not a second count added up here', async () => {
    // Muted conversations are left out of `unreadTotal` by the server. Summing the rows here
    // would put them back in and the menu would disagree with the list beside it.
    await renderSidebar({
      items: [conversation(3, false), conversation(5, true)],
      unreadTotal: 3,
    })

    const link = await screen.findByRole('link', { name: /Razgovori/ })
    expect(within(link).getByText('3')).toBeInTheDocument()
    expect(within(link).queryByText('8')).not.toBeInTheDocument()
  })

  it('draws nothing when nothing is waiting', async () => {
    await renderSidebar({ items: [conversation(0, false)], unreadTotal: 0 })

    const link = await screen.findByRole('link', { name: /Razgovori/ })
    // Only the menu number and the label — no badge at all.
    expect(link.textContent).toMatch(/^\d\dRazgovori$/)
  })
})
