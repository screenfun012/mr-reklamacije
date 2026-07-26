import { CLAIM_DETAIL_DEFAULT_SEARCH, ClaimKind, type ClaimListItem } from '@mr/shared'
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
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { claimDetailTarget } from '../claim-target'
import { CommandPalette } from '../command-palette'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

async function renderPalette(permissions: readonly string[]): Promise<void> {
  const rootRoute = createRootRoute({ component: () => <CommandPalette /> })
  const emotiveDetail = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/emotive/$id',
    component: () => null,
  })
  const domaceDetail = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/domace/$id',
    component: () => null,
  })
  const statistika = createRoute({
    getParentRoute: () => rootRoute,
    path: '/statistika',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([emotiveDetail, domaceDetail, statistika]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { authSession: { user: { permissions } } },
  })
  await router.load()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  )
}

describe('CommandPalette', () => {
  beforeEach(() => {
    setLocale('sr')
    navigateMock.mockReset()
  })

  it('opens on Cmd/Ctrl+K and shows only permitted navigation commands', async () => {
    const user = userEvent.setup()
    await renderPalette(['emotive_claims.create'])

    await user.keyboard('{Meta>}k{/Meta}')

    expect(
      await screen.findByPlaceholderText('Pretraži komande ili reklamacije…'),
    ).toBeInTheDocument()
    // permitted (has emotive_claims.create)
    expect(screen.getByText('Nova EMOTIVE reklamacija')).toBeInTheDocument()
    // requires client_submissions.manage — hidden
    expect(screen.queryByText('Pristiglo')).not.toBeInTheDocument()
  })

  it('opens clean after being closed with a query typed', async () => {
    const user = userEvent.setup()
    await renderPalette([])

    await user.keyboard('{Meta>}k{/Meta}')
    const input = await screen.findByPlaceholderText('Pretraži komande ili reklamacije…')
    await user.type(input, 'kia')
    expect(input).toHaveValue('kia')

    await user.keyboard('{Escape}')
    await user.keyboard('{Meta>}k{/Meta}')

    expect(await screen.findByPlaceholderText('Pretraži komande ili reklamacije…')).toHaveValue('')
  })

  it('navigates when a navigation command is selected', async () => {
    const user = userEvent.setup()
    // Statistika is permission-gated now, so the caller has to hold it for the command to be
    // in the palette at all — the point of the test is the navigation, not the gating.
    await renderPalette(['statistics.view_emotive'])

    await user.keyboard('{Meta>}k{/Meta}')
    await user.click(await screen.findByText('Statistika'))

    expect(navigateMock).toHaveBeenCalledWith({ to: '/statistika' })
  })
})

describe('claimDetailTarget', () => {
  it('routes an emotive claim to the emotive detail', () => {
    const claim = { kind: ClaimKind.Emotive, id: 'abc' } satisfies Pick<
      ClaimListItem,
      'kind' | 'id'
    >
    expect(claimDetailTarget(claim)).toEqual({
      to: '/reklamacije/emotive/$id',
      params: { id: 'abc' },
      search: CLAIM_DETAIL_DEFAULT_SEARCH,
    })
  })

  it('routes a domace claim to the domace detail', () => {
    const claim = { kind: ClaimKind.Domace, id: 'xyz' } satisfies Pick<ClaimListItem, 'kind' | 'id'>
    expect(claimDetailTarget(claim)).toEqual({
      to: '/reklamacije/domace/$id',
      params: { id: 'xyz' },
      search: CLAIM_DETAIL_DEFAULT_SEARCH,
    })
  })
})
