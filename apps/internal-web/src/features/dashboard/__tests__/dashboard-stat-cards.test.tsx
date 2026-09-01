import { ClaimKind, ClaimOutcome } from '@mr/shared'
import { setLocale } from '@mr/i18n'
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

import { DashboardStatCards } from '../dashboard-stat-cards.js'

const sampleStats = {
  total: 100,
  pending: 12,
  accepted: 40,
  rejected: 8,
  newThisMonth: 5,
  byKind: { emotive: 60, domace: 40 },
}

const sampleTrends = {
  newThisMonth: { previous: 3, delta: 2 },
  pending: { previous: 4, delta: -1 },
}

async function renderWithRouter(node: ReactElement): Promise<ReturnType<typeof createRouter>> {
  const rootRoute = createRootRoute({ component: () => node })
  const reklamacijeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije',
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => <div data-testid="claims-list" />,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([reklamacijeRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
  return router
}

describe('DashboardStatCards', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  it('links outcome cards to filtered claims list', async () => {
    await renderWithRouter(<DashboardStatCards stats={sampleStats} trends={sampleTrends} />)

    expect(screen.getByRole('link', { name: /u obradi/i })).toHaveAttribute(
      'href',
      `/reklamacije?page=1&pageSize=10&outcome=${ClaimOutcome.Pending}`,
    )
    expect(screen.getByRole('link', { name: /prihvaćeno/i })).toHaveAttribute(
      'href',
      `/reklamacije?page=1&pageSize=10&outcome=${ClaimOutcome.Accepted}`,
    )
    expect(screen.getByRole('link', { name: /odbijeno/i })).toHaveAttribute(
      'href',
      `/reklamacije?page=1&pageSize=10&outcome=${ClaimOutcome.Rejected}`,
    )
  })

  it('links kind cards to filtered claims list', async () => {
    await renderWithRouter(<DashboardStatCards stats={sampleStats} trends={sampleTrends} />)

    expect(screen.getByRole('link', { name: /inostrane/i })).toHaveAttribute(
      'href',
      `/reklamacije?page=1&pageSize=10&kind=${ClaimKind.Emotive}`,
    )
    expect(screen.getByRole('link', { name: /domaće/i })).toHaveAttribute(
      'href',
      `/reklamacije?page=1&pageSize=10&kind=${ClaimKind.Domace}`,
    )
  })

  it('does not link total or this-month cards', async () => {
    await renderWithRouter(<DashboardStatCards stats={sampleStats} trends={sampleTrends} />)

    expect(screen.queryByRole('link', { name: /ukupno/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /ovaj mesec/i })).not.toBeInTheDocument()
  })

  it('renders month-over-month trend badges on this-month and pending cards', async () => {
    await renderWithRouter(<DashboardStatCards stats={sampleStats} trends={sampleTrends} />)

    const badges = screen.getAllByTitle('u odnosu na prošli mesec')
    expect(badges).toHaveLength(2)
    expect(badges.some((badge) => badge.textContent === '▲ 2')).toBe(true)
    expect(badges.some((badge) => badge.textContent === '▼ 1')).toBe(true)
  })
})
