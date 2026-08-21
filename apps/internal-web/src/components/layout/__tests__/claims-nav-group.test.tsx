import { setLocale } from '@mr/i18n'
import { claimCategoryCountsOptions } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Briefcase } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NavItem } from '~/config/navigation'

import { buildClaimsNavChildren, ClaimsNavGroup } from '../claims-nav-group.js'

const COUNTS = {
  items: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      code: 'MASINSKA_OBRADA',
      name: 'Mašinska obrada',
      sortOrder: 20,
      isActive: true,
      total: 14,
      pending: 9,
    },
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      code: 'KOMPRESORI',
      name: 'Kompresori',
      sortOrder: 90,
      isActive: false,
      total: 1,
      pending: 0,
    },
  ],
  totals: { total: 15, pending: 9 },
}

const CLAIMS_ITEM: NavItem = {
  key: 'reklamacije',
  label: () => 'Reklamacije',
  to: '/reklamacije',
  children: 'claim-categories',
  icon: Briefcase,
}

async function renderGroup(pathname = '/reklamacije', collapsed = false): Promise<void> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(claimCategoryCountsOptions().queryKey, COUNTS)

  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <ClaimsNavGroup item={CLAIMS_ITEM} collapsed={collapsed} onNavigate={() => undefined} />
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
    history: createMemoryHistory({ initialEntries: [pathname] }),
  })

  render(<RouterProvider router={router as never} />)
  await screen.findByRole('link', { name: /Sve reklamacije/ })
}

describe('buildClaimsNavChildren', () => {
  it('leads with "all" and lists only the live categories, in catalogue order', () => {
    const children = buildClaimsNavChildren(COUNTS)

    // A retired category is not a place to send anyone; the claims that carry it still say so.
    expect(children.map((child) => child.key)).toEqual(['all', 'MASINSKA_OBRADA'])
    expect(children[1]?.count).toBe(9)
  })

  it('renders before the counts arrive, with no numbers rather than zeros', () => {
    // A slow or failed count must not take the menu down — and must not claim "0 open" either.
    const children = buildClaimsNavChildren(undefined)

    expect(children).toHaveLength(1)
    expect(children[0]?.count).toBeNull()
  })
})

describe('ClaimsNavGroup', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    localStorage.clear()
  })

  it('lists the live categories with what is still open under each', async () => {
    await renderGroup()

    expect(screen.getByRole('link', { name: /Mašinska obrada/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Mašinska obrada/ })).toHaveTextContent('9')
    expect(screen.queryByRole('link', { name: /Kompresori/ })).not.toBeInTheDocument()
  })

  it('lights exactly one child — the place you are in', async () => {
    await renderGroup('/reklamacije/kategorija/MASINSKA_OBRADA')

    const current = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Mašinska obrada')
  })

  it('remembers whether the group was left open', async () => {
    const user = userEvent.setup()
    await renderGroup()

    await user.click(screen.getByRole('button', { name: /Reklamacije/ }))

    expect(screen.queryByRole('link', { name: /Mašinska obrada/ })).not.toBeInTheDocument()
    expect(localStorage.getItem('mrr:internal:nav:reklamacije-open')).toBe('0')
  })

  it('is one icon with a flyout when the rail is collapsed', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(claimCategoryCountsOptions().queryKey, COUNTS)

    const rootRoute = createRootRoute({
      component: () => (
        <QueryClientProvider client={queryClient}>
          <ClaimsNavGroup item={CLAIMS_ITEM} collapsed onNavigate={vi.fn()} />
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
    render(<RouterProvider router={router as never} />)

    // Collapsed, the categories are behind the icon — nothing is listed until it is opened.
    const trigger = await screen.findByRole('button', { name: 'Reklamacije' })
    expect(screen.queryByRole('link', { name: /Mašinska obrada/ })).not.toBeInTheDocument()

    await user.click(trigger)
    expect(await screen.findByRole('link', { name: /Mašinska obrada/ })).toBeInTheDocument()
  })
})
