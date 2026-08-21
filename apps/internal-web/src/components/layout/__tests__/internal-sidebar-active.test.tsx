import { setLocale } from '@mr/i18n'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { internalNavItems } from '~/config/navigation'
import { InternalSidebar } from '../internal-sidebar'

/**
 * "Mašinska obrada" is no longer a screen of its own — it is the claims list with a category
 * filter. Two entries therefore point at ONE route, and which of them lights up is decided by
 * the search params, not the path. That is invisible to every other test in the app.
 */
async function renderSidebarAt(url: string): Promise<void> {
  const rootRoute = createRootRoute({
    component: () => (
      <InternalSidebar
        items={internalNavItems}
        userName="Nikola"
        userEmail="nikola@example.test"
        onLogout={() => {}}
        collapsed={false}
        mobileOpen={false}
        onCloseMobile={() => {}}
      />
    ),
  })
  const claimsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije',
    validateSearch: (search) => z.object({ categoryCode: z.string().optional() }).parse(search),
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([claimsRoute]),
    history: createMemoryHistory({ initialEntries: [url] }),
    context: { authSession: { user: { roles: ['operator'] } } },
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
}

/** What the eye sees: the red pill. */
function highlightedLabels(): string[] {
  return screen
    .getAllByRole('link')
    .filter((link) => link.className.includes('bg-[rgba(237,28,36,.1)]'))
    .map((link) => link.getAttribute('title') ?? '')
}

/** What a screen reader hears — there can only be one current page. */
function currentPageLabels(): string[] {
  return screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.getAttribute('title') ?? '')
}

describe('sidebar highlighting when two entries share one route', () => {
  beforeEach(() => setLocale('sr'))

  it('lights up only Mašinska obrada on the machining list', async () => {
    await renderSidebarAt('/reklamacije?categoryCode=MASINSKA_OBRADA')

    expect(highlightedLabels()).toEqual(['Mašinska obrada'])
    expect(currentPageLabels()).toEqual(['Mašinska obrada'])
  })

  it('lights up only Reklamacije on the unfiltered list', async () => {
    await renderSidebarAt('/reklamacije')

    expect(highlightedLabels()).toEqual(['Reklamacije'])
    expect(currentPageLabels()).toEqual(['Reklamacije'])
  })

  it('lights up only Reklamacije on a list filtered by some other category', async () => {
    await renderSidebarAt('/reklamacije?categoryCode=NOVI_DELOVI')

    expect(highlightedLabels()).toEqual(['Reklamacije'])
  })
})
