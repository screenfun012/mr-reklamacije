import {
  intakeChecklistCatalogFixture,
  intakeDraftFixture,
  intakeOrderDetailFixture,
  intakePhotoFixture,
} from '@mr/intake-document/testing'
import { setLocale } from '@mr/i18n'
import { intakeChecklistItemsDisplayQueryKey } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'

/**
 * The detail's components carry `<Link>`s and React Query mutations, so neither renders
 * bare. Routes registered here are the ones those links point at.
 */
export async function renderDetailUi(
  ui: ReactElement,
  /**
   * The checklist catalog the screen reads its names from. Seeded rather than fetched, and seeded on
   * the DISPLAY key, which is the one the condition card and the printed sheet use — a test that
   * passes with the picker's key instead would be proving the wrong reader.
   */
  checklistItems: readonly IntakeChecklistItemListItem[] = intakeChecklistCatalogFixture(),
): Promise<RenderResult> {
  setLocale('sr', { reload: false })

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  queryClient.setQueryData(intakeChecklistItemsDisplayQueryKey(), checklistItems)
  const rootRoute = createRootRoute({
    component: () => <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  })
  const children = (['/prijem', '/prijem/novi', '/prijem/$id'] as const).map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()

  // Hands back the render result so a test that needs a SECOND render of the same component can
  // unmount the first — two mounted copies make every `getBy*` ambiguous.
  return render(<RouterProvider router={router as never} />)
}

/**
 * Re-exported so every existing test keeps its import path. The definitions moved into
 * `@mr/intake-document/testing` when the document did: the package's tests and these assert against
 * the same paper, and two fixture sets would let one of them go green over a change the other calls
 * wrong.
 */
export {
  intakeChecklistCatalogFixture,
  intakeDraftFixture,
  intakeOrderDetailFixture,
  intakePhotoFixture,
}
