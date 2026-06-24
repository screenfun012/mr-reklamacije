import { ClaimKind } from '@mr/shared'
import { setLocale } from '@mr/i18n'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DashboardClaimList } from '../dashboard-claim-list.js'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

async function renderWithRouter(node: ReactElement): Promise<void> {
  const rootRoute = createRootRoute({ component: () => node })
  const emotiveDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/emotive/$id',
    component: () => null,
  })
  const domaceDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/domace/$id',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([emotiveDetailRoute, domaceDetailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
}

describe('DashboardClaimList', () => {
  beforeEach(() => {
    setLocale('sr')
    navigateMock.mockReset()
  })

  it('renders empty state when there are no rows', async () => {
    await renderWithRouter(
      <DashboardClaimList
        title="Kasne reklamacije"
        emptyMessage="Nema kasnih reklamacija"
        items={[]}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Nema kasnih reklamacija')
  })

  it('navigates to emotive detail when an emotive row is clicked', async () => {
    const user = userEvent.setup()

    await renderWithRouter(
      <DashboardClaimList
        title="Kasne reklamacije"
        emptyMessage="Nema kasnih reklamacija"
        items={[
          {
            kind: ClaimKind.Emotive,
            id: '11111111-1111-4111-8111-111111111111',
            mrNumber: '5376/26',
            customerLabel: 'SELMAN',
            daysOpen: 12,
          },
        ]}
      />,
    )

    await user.click(screen.getByText('5376/26'))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/reklamacije/emotive/$id',
      params: { id: '11111111-1111-4111-8111-111111111111' },
      search: { tab: 'pregled' },
    })
  })

  it('navigates to domace detail when a domace row is clicked', async () => {
    const user = userEvent.setup()

    await renderWithRouter(
      <DashboardClaimList
        title="Kasne reklamacije"
        emptyMessage="Nema kasnih reklamacija"
        items={[
          {
            kind: ClaimKind.Domace,
            id: '66666666-6666-4666-8666-666666666666',
            mrNumber: '1234/26',
            customerLabel: 'Auto Stanić',
            daysOpen: 20,
          },
        ]}
      />,
    )

    await user.click(screen.getByText('1234/26'))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/reklamacije/domace/$id',
      params: { id: '66666666-6666-4666-8666-666666666666' },
      search: { tab: 'pregled' },
    })
  })

  it('renders days badge with warning styling', async () => {
    await renderWithRouter(
      <DashboardClaimList
        title="Kasne reklamacije"
        emptyMessage="Nema kasnih reklamacija"
        items={[
          {
            kind: ClaimKind.Emotive,
            id: '11111111-1111-4111-8111-111111111111',
            mrNumber: '5376/26',
            customerLabel: 'SELMAN',
            daysOpen: 388,
          },
        ]}
      />,
    )

    expect(screen.getByText('388 dana')).toBeInTheDocument()
  })
})
