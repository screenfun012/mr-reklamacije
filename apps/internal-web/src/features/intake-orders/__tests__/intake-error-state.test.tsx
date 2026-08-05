import { m, setLocale } from '@mr/i18n'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { IntakeErrorState } from '../intake-error-state.js'

/**
 * Its own router rather than the detail harness, because the whole point of this suite is WHICH
 * router call the button makes — so the test needs the instance to spy on.
 */
async function renderWithRouter(
  ui: ReactElement,
): Promise<{ invalidate: ReturnType<typeof vi.fn> }> {
  setLocale('sr', { reload: false })

  const rootRoute = createRootRoute({ component: () => ui })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()

  const invalidate = vi.fn().mockResolvedValue(undefined)
  router.invalidate = invalidate as never

  render(<RouterProvider router={router as never} />)
  return { invalidate }
}

describe('IntakeErrorState', () => {
  /*
   * The assertion is `invalidate`, deliberately, and not "onRetry was called" or "the button
   * exists". When a loader throws, the router match is left in `status: 'error'` and the `reset`
   * an errorComponent receives clears only the catch boundary — the match re-throws on the next
   * render and nothing is refetched. A test that only proved a click reached a callback would
   * stay green while the button did nothing at all, which is exactly the shape shipped in seven
   * other places in this app.
   */
  it('retries by re-running the loader, not by clearing the boundary', async () => {
    const { invalidate } = await renderWithRouter(
      <IntakeErrorState title="Nalog nije moguće učitati." description={null} canRetry />,
    )

    fireEvent.click(screen.getByRole('button', { name: m.route_error_retry() }))

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1))
  })

  it('offers no retry when trying again cannot help', async () => {
    await renderWithRouter(
      <IntakeErrorState title="Nalog nije pronađen" description="Opis" canRetry={false} />,
    )

    expect(screen.queryByRole('button', { name: m.route_error_retry() })).toBeNull()
    expect(screen.queryByText('Opis')).not.toBeNull()
  })
})
