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

import { ClaimsListHeader } from '../claims-list-header.js'

async function renderWithRouter(ui: ReactElement): Promise<void> {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => ui,
  })
  const emotiveRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/emotive/nova',
    component: () => null,
  })
  const domaceRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/domace/nova',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, emotiveRoute, domaceRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  render(<RouterProvider router={router as never} />)
  await screen.findByRole('heading', { level: 1 })
}

describe('ClaimsListHeader', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('names the category and counts what is open inside it', async () => {
    await renderWithRouter(
      <ClaimsListHeader
        mode={{
          kind: 'category',
          code: 'MASINSKA_OBRADA',
          category: {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            code: 'MASINSKA_OBRADA',
            name: 'Mašinska obrada',
            sortOrder: 20,
            isActive: true,
            total: 14,
            pending: 9,
          },
        }}
        pendingTotal={41}
        canCreateEmotive
        canCreateDomace
      />,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mašinska obrada')
    // The category's own numbers, not the whole firm's — the header must not lie about the place.
    expect(screen.getByText(/9/)).toBeInTheDocument()
    expect(screen.getByText(/14/)).toBeInTheDocument()
  })

  it('falls back to the code when the category is one the reader cannot see', async () => {
    await renderWithRouter(
      <ClaimsListHeader
        mode={{ kind: 'category', code: 'NE_POSTOJI', category: null }}
        pendingTotal={0}
        canCreateEmotive={false}
        canCreateDomace={false}
      />,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('NE_POSTOJI')
  })

  it('shows only the doors the actor may open', async () => {
    await renderWithRouter(
      <ClaimsListHeader
        mode={{ kind: 'all' }}
        pendingTotal={41}
        canCreateEmotive={false}
        canCreateDomace
      />,
    )

    expect(screen.queryByRole('link', { name: /EMOTIVE/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })
})
