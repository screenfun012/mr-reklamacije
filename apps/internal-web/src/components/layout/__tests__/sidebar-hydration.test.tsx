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
 * Whatever the server printed, the hydration render has to print the same thing — otherwise React
 * discards the whole server tree and the screen redraws without its buttons. These tests hold the
 * two renders against each other.
 *
 * ⚠ The two counts reach that agreement by OPPOSITE routes, and the difference is the lesson of
 * 2026-08-24. The claims counts are awaited by `_shell.tsx`, so the server HAS them and prints
 * them — agreement by giving the server the value. The chat badge is not loaded on most screens,
 * so it is gated on hydration — agreement by withholding it from both sides. Withholding is the
 * weaker of the two and it was once used for the claims group as well: the React error went away
 * and 128px of menu still appeared after the first paint, because the server was then rendering a
 * deliberately shorter menu on purpose.
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

  /**
   * ⚠ The inverse of what this file used to assert, and deliberately so. The count reaching the
   * HTML is the fix: the server draws the whole group — five entries and their numbers — so the
   * browser has nothing left to add and nothing moves after the first paint.
   */
  it('the claims group is drawn WHOLE by the server, counts and all', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(claimCategoryCountsOptions().queryKey, {
      items: [
        {
          id: 'c1',
          code: 'REMONT_MOTORA',
          name: 'Generalni remont motora',
          isActive: true,
          total: 12,
          pending: 7,
        },
        {
          id: 'c2',
          code: 'MASINSKA_OBRADA',
          name: 'Mašinska obrada',
          isActive: true,
          total: 3,
          pending: 2,
        },
      ],
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
          <ClaimsNavGroup
            item={item}
            index="03"
            collapsed={false}
            defaultOpen
            onNavigate={() => undefined}
          />
        </QueryClientProvider>
      ),
    })
    const listRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/reklamacije',
      component: () => null,
    })
    const categoryRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/reklamacije/kategorija/$categoryCode',
      component: () => null,
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([listRoute, categoryRoute]),
      history: createMemoryHistory({ initialEntries: ['/reklamacije'] }),
    })

    // ⚠ Without this the router renders an empty shell and the assertion below passes no matter
    // what the component does — the first version of this test was hollow for exactly that reason.
    await router.load()
    const html = renderToString(<RouterProvider router={router as never} />)
    expect(html).toContain('Reklamacije')

    // Every category, so the browser adds no rows: this is the 128px that used to appear.
    expect(html).toContain('Generalni remont motora')
    expect(html).toContain('Mašinska obrada')
    // And the numbers, so no row changes width either.
    expect(html).toContain('>9<')
    expect(html).toContain('>7<')
  })
})
