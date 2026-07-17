import { m, setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MrDuplicateWarning } from '../mr-duplicate-warning.js'

const EXISTING_ID = '22222222-2222-4222-8222-222222222222'

async function renderWarning(mrNumber: string): Promise<void> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <MrDuplicateWarning mrNumber={mrNumber} />
      </QueryClientProvider>
    ),
  })
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

describe('MrDuplicateWarning', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('warns and links to the existing claim when the MR number is taken', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kind: 'emotive', claimId: EXISTING_ID }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    await renderWarning('MR 100')

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeNull()
    })
    expect(screen.getByText(m.claims_create_mr_conflict_warning(), { exact: false })).toBeTruthy()

    const link = screen.getByRole('link', { name: m.claims_create_mr_conflict_link() })
    expect(link.getAttribute('href')).toContain(`/reklamacije/emotive/${EXISTING_ID}`)

    const lookupUrl = String(fetchSpy.mock.calls[0]?.[0])
    expect(lookupUrl).toContain('/api/mr-registry/lookup?mr=mr%20100')
  })

  it('renders nothing when the registry has no claim for the number', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => null })
    vi.stubGlobal('fetch', fetchSpy)

    await renderWarning('MR 999')

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('does not query the registry for an empty MR number', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await renderWarning('   ')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
