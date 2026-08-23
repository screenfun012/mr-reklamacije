import { chatConversationsOptions, claimCategoryCountsOptions } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { Briefcase } from 'lucide-react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { NavItem } from '~/config/navigation'
import { ClaimsNavGroup } from '~/components/layout/claims-nav-group'
import { ChatUnreadBadge } from '~/features/chat/chat-unread-badge'
import { useHydrated } from '~/lib/use-hydrated'

/**
 * The sidebar's counts arrive between the server's render and the client's, because `_shell.tsx`
 * warms them with a fire-and-forget prefetch. Whatever the server printed, the hydration render
 * has to print the same thing — otherwise React discards the whole server tree and the screen
 * redraws without its buttons. These tests hold the two renders against each other.
 */

function Probe(): React.ReactElement {
  return <span>{useHydrated() ? 'da' : 'ne'}</span>
}

/** A cache that already holds the answer — the situation the server never has and the client does. */
function seededClient(unreadTotal: number): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(chatConversationsOptions().queryKey, { items: [], unreadTotal })
  return queryClient
}

describe('the sidebar renders the same thing on both sides of hydration', () => {
  it('useHydrated is false on the server and true once mounted', () => {
    expect(renderToString(<Probe />)).toContain('ne')

    render(<Probe />)
    expect(screen.getByText('da')).toBeInTheDocument()
  })

  it('the chat badge is absent from the server render even when the count is known', () => {
    const html = renderToString(
      <QueryClientProvider client={seededClient(4)}>
        <ChatUnreadBadge />
      </QueryClientProvider>,
    )

    // The number must not reach the HTML: the client's hydration render will not have it either,
    // and those two agreeing is the whole point.
    expect(html).not.toContain('4')
  })

  it('the chat badge appears on the client, once past hydration', () => {
    render(
      <QueryClientProvider client={seededClient(4)}>
        <ChatUnreadBadge />
      </QueryClientProvider>,
    )

    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('the claims count is absent from the server render even when it is known', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(claimCategoryCountsOptions().queryKey, {
      items: [],
      totals: { total: 15, pending: 9 },
    })
    const item: NavItem = {
      key: 'reklamacije',
      label: () => 'Reklamacije',
      to: '/reklamacije',
      children: 'claim-categories',
      icon: Briefcase,
    }
    const rootRoute = createRootRoute({
      component: () => (
        <QueryClientProvider client={queryClient}>
          <ClaimsNavGroup item={item} collapsed={false} onNavigate={() => undefined} />
        </QueryClientProvider>
      ),
    })
    const listRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/reklamacije',
      component: () => null,
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([listRoute]),
      history: createMemoryHistory({ initialEntries: ['/reklamacije'] }),
    })

    // ⚠ Without this the router renders an empty shell and the assertion below passes no matter
    // what the component does — the first version of this test was hollow for exactly that reason.
    await router.load()
    const html = renderToString(<RouterProvider router={router as never} />)
    expect(html).toContain('Reklamacije')

    // This is the exact pair React reported: the server printed the chevron where the client
    // printed the amber 9.
    expect(html).not.toContain('>9<')
  })
})
