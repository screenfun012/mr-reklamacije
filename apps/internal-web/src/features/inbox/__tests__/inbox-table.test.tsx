import { ClientSubmissionStatus, type ClientSubmissionListItem } from '@mr/shared'
import { setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { InboxTable } from '../inbox-table.js'

const ITEMS: ClientSubmissionListItem[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    customerId: '22222222-2222-4222-8222-222222222222',
    customerName: 'SELMAN',
    message: 'Motor lupa na hladno',
    status: ClientSubmissionStatus.Pending,
    attachmentCount: 2,
    createdAt: '2026-07-10T09:30:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    customerId: '44444444-4444-4444-8444-444444444444',
    customerName: 'Auto Stanić',
    message: 'Curi ulje',
    status: ClientSubmissionStatus.Pending,
    attachmentCount: 0,
    createdAt: '2026-07-11T12:00:00.000Z',
  },
]

async function renderWithRouter(node: ReactElement): Promise<void> {
  const rootRoute = createRootRoute({ component: () => node })
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/pristiglo/$id',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  )
}

describe('InboxTable', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  it('renders the empty state when there are no submissions', async () => {
    await renderWithRouter(<InboxTable items={[]} total={0} />)

    expect(screen.getByRole('status')).toHaveTextContent('Nema zahteva na čekanju')
  })

  it('renders a row per submission with firm, reason, attachment count and the total badge', async () => {
    await renderWithRouter(<InboxTable items={ITEMS} total={2} />)

    expect(await screen.findByText('SELMAN')).toBeInTheDocument()
    expect(screen.getByText('Auto Stanić')).toBeInTheDocument()
    expect(screen.getByText('Motor lupa na hladno')).toBeInTheDocument()
    expect(screen.getByText('Curi ulje')).toBeInTheDocument()

    // Header count caption reflects the total.
    expect(screen.getByText('2 zahteva')).toBeInTheDocument()

    // Each row exposes a detail link to /pristiglo/$id.
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/pristiglo/11111111-1111-4111-8111-111111111111')
    expect(links[1]).toHaveAttribute('href', '/pristiglo/33333333-3333-4333-8333-333333333333')
  })
})
