import { ClaimKind, ClaimSortBy, ClaimSortDir } from '@mr/shared'
import { setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ClaimsTable } from '../claims-table.js'

// The table reads the actor's permissions from the root route context; mock it
// so a test can grant a specific delete permission (real router stays for links).
const { mockState } = vi.hoisted(() => ({ mockState: { permissions: [] as string[] } }))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    getRouteApi: () => ({
      useRouteContext: () => ({ authSession: { user: { permissions: mockState.permissions } } }),
    }),
  }
})

const defaultSearch = { page: 1, pageSize: 10 as const }

const sampleItems = [
  {
    kind: ClaimKind.Emotive,
    id: '11111111-1111-4111-8111-111111111111',
    sequenceNumber: 1,
    claimNumber: 'EM-2026-001',
    warrantyReport: 'Test',
    engineTypeId: '22222222-2222-4222-8222-222222222222',
    engineTypeCode: 'BMW N47D20D',
    manufacturerId: null,
    manufacturerName: null,
    engineCode: null,
    dateOfClaim: '2026-04-17',
    mrNumber: '5376/26',
    dateOfFinish: '2025-12-15',
    employeeId: '33333333-3333-4333-8333-333333333333',
    employeeName: 'Petar Nikolić',
    sourceId: '44444444-4444-4444-8444-444444444444',
    outcome: 'pending' as const,
    claimYear: 2026,
    customerId: '55555555-5555-4555-8555-555555555555',
    customerName: 'SELMAN',
    category: {
      id: '77777777-7777-4777-8777-777777777777',
      code: 'MASINSKA_OBRADA',
      name: 'Mašinska obrada',
      isActive: true,
    },
    missingRequiredCategoryFields: [],
    createdAt: '2026-04-17T10:00:00.000Z',
  },
  {
    kind: ClaimKind.Domace,
    id: '66666666-6666-4666-8666-666666666666',
    sequenceNumber: 2,
    claimNumber: 'DO-2026-001',
    customerName: 'Auto Stanić',
    warrantyReport: 'Domaća reklamacija',
    engineTypeId: null,
    engineTypeCode: null,
    manufacturerId: null,
    manufacturerName: null,
    engineCode: null,
    dateOfClaim: '2026-05-01',
    mrNumber: '1234/26',
    dateOfFinish: null,
    employeeId: null,
    employeeName: null,
    outcome: 'pending' as const,
    claimYear: 2026,
    totalAmount: null,
    category: {
      id: '88888888-8888-4888-8888-888888888888',
      code: 'KOMPRESORI',
      name: 'Kompresori',
      isActive: false,
    },
    missingRequiredCategoryFields: ['obradjeni_deo'],
    createdAt: '2026-05-01T10:00:00.000Z',
  },
] as const

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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  )
}

describe('ClaimsTable', () => {
  beforeEach(() => {
    setLocale('sr')
    mockState.permissions = []
  })

  it('renders empty state when there are no rows', async () => {
    const onSearchChange = vi.fn()
    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn={false}
        items={[]}
        total={0}
        search={defaultSearch}
        onSearchChange={onSearchChange}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Nema reklamacija')
  })

  it('renders emotive and domace rows with kind badges and detail links', async () => {
    const onSearchChange = vi.fn()
    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn={false}
        total={2}
        items={sampleItems}
        search={defaultSearch}
        onSearchChange={onSearchChange}
      />,
    )

    expect(await screen.findByText('5376/26')).toBeInTheDocument()
    expect(screen.getByText('1234/26')).toBeInTheDocument()
    expect(screen.getByText('SELMAN')).toBeInTheDocument()
    expect(screen.getByText('Auto Stanić')).toBeInTheDocument()
    expect(screen.getByText('EMOTIVE')).toBeInTheDocument()
    expect(screen.getByText('Domaća')).toBeInTheDocument()

    const viewLinks = screen.getAllByRole('link', { name: 'Pregled' })
    expect(viewLinks[0]).toHaveAttribute(
      'href',
      '/reklamacije/emotive/11111111-1111-4111-8111-111111111111?tab=pregled',
    )
    expect(viewLinks[1]).toHaveAttribute(
      'href',
      '/reklamacije/domace/66666666-6666-4666-8666-666666666666?tab=pregled',
    )
  })

  it('applies shared navigable row hover class on data rows', async () => {
    const onSearchChange = vi.fn()
    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn={false}
        total={2}
        items={sampleItems}
        search={defaultSearch}
        onSearchChange={onSearchChange}
      />,
    )

    const dataRows = screen.getAllByRole('row').slice(1)
    for (const row of dataRows) {
      expect(row.className).toContain('hover:bg-muted/40')
      expect(row.className).toContain('cursor-pointer')
    }
  })

  it('calls onSearchChange with expected search when date received header is clicked', async () => {
    const user = userEvent.setup()
    const onSearchChange = vi.fn()

    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn={false}
        total={2}
        items={sampleItems}
        search={{ outcome: 'pending', page: 2, pageSize: 25 }}
        onSearchChange={onSearchChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Datum prijema' }))

    expect(onSearchChange).toHaveBeenCalledWith({
      outcome: 'pending',
      page: 1,
      pageSize: 25,
      sortBy: ClaimSortBy.DateOfClaim,
      sortDir: ClaimSortDir.Asc,
    })
  })

  it('toggles date finish sort direction on repeated header clicks', async () => {
    const user = userEvent.setup()
    const onSearchChange = vi.fn()

    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn={false}
        total={2}
        items={sampleItems}
        search={{
          sortBy: ClaimSortBy.DateOfFinish,
          sortDir: ClaimSortDir.Asc,
          page: 1,
          pageSize: 10,
        }}
        onSearchChange={onSearchChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Datum izrade motora' }))

    expect(onSearchChange).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      sortBy: ClaimSortBy.DateOfFinish,
      sortDir: ClaimSortDir.Desc,
    })
  })

  it('shows a delete action only for kinds the actor may delete and opens the confirm dialog', async () => {
    const user = userEvent.setup()
    mockState.permissions = ['emotive_claims.delete'] // emotive deletable, domace not

    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn={false}
        total={2}
        items={sampleItems}
        search={defaultSearch}
        onSearchChange={vi.fn()}
      />,
    )

    const deleteButtons = screen.getAllByRole('button', { name: 'Obriši' })
    expect(deleteButtons).toHaveLength(1)

    await user.click(deleteButtons[0]!)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Obriši reklamaciju')
    expect(dialog).toHaveTextContent('5376/26')
  })

  it('shows no delete action without the delete permission', async () => {
    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn={false}
        total={2}
        items={sampleItems}
        search={defaultSearch}
        onSearchChange={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Obriši' })).not.toBeInTheDocument()
  })

  it('selects a single row and shows the count, then clears it', async () => {
    const user = userEvent.setup()
    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn={false}
        total={2}
        items={sampleItems}
        search={defaultSearch}
        onSearchChange={vi.fn()}
      />,
    )

    await user.click(screen.getAllByRole('checkbox', { name: 'Označi reklamaciju' })[0]!)
    expect(screen.getByText('1 označeno')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Poništi izbor' }))
    expect(screen.queryByText('1 označeno')).not.toBeInTheDocument()
  })

  it('the header checkbox selects every row on the page', async () => {
    const user = userEvent.setup()
    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn={false}
        total={2}
        items={sampleItems}
        search={defaultSearch}
        onSearchChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Označi sve na strani' }))
    expect(screen.getByText('2 označeno')).toBeInTheDocument()
  })

  it('clicking the checkbox does not navigate to the claim', async () => {
    const user = userEvent.setup()
    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn={false}
        total={2}
        items={sampleItems}
        search={defaultSearch}
        onSearchChange={vi.fn()}
      />,
    )

    const box = screen.getAllByRole('checkbox', { name: 'Označi reklamaciju' })[0]!
    await user.click(box)
    // Selecting is not opening — the count appears, we did not leave the list.
    expect(screen.getByText('1 označeno')).toBeInTheDocument()
    expect(box).toBeChecked()
  })

  it('hides the category column inside one category and shows it in the list of everything', async () => {
    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn={false}
        total={2}
        items={sampleItems}
        search={defaultSearch}
        onSearchChange={vi.fn()}
      />,
    )
    // Inside a category every row would repeat the same word — the column would be noise.
    expect(screen.queryByText('Mašinska obrada')).not.toBeInTheDocument()

    cleanup()

    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn
        total={2}
        items={sampleItems}
        search={defaultSearch}
        onSearchChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Mašinska obrada')).toBeInTheDocument()
  })

  it('marks a retired category so the row says what the claim still carries', async () => {
    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn
        total={2}
        items={sampleItems}
        search={defaultSearch}
        onSearchChange={vi.fn()}
      />,
    )

    // The claim keeps the category the office switched off; the dagger is how the row admits it.
    expect(screen.getByText('Kompresori †')).toBeInTheDocument()
    expect(screen.getByText('Mašinska obrada')).toBeInTheDocument()
  })

  it('marks a claim whose new kind of work is still missing something — in BOTH modes', async () => {
    const label = 'Reklamacija je premeštena u drugu vrstu posla — dopuni polja koja ona traži.'

    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn
        total={2}
        items={sampleItems}
        search={defaultSearch}
        onSearchChange={vi.fn()}
      />,
    )
    expect(screen.getAllByLabelText(label)).toHaveLength(1)

    cleanup()

    // ⚙ the mark used to sit in the category cell, which is HIDDEN inside one category — exactly
    // the list where a claim missing its new fields most needs to be visible. Found in the
    // browser, 2026-08-21. It rides with the MR number now, which never disappears.
    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn={false}
        total={2}
        items={sampleItems}
        search={defaultSearch}
        onSearchChange={vi.fn()}
      />,
    )
    expect(screen.getAllByLabelText(label)).toHaveLength(1)
  })

  it('keeps a two-word category on one line', async () => {
    await renderWithRouter(
      <ClaimsTable
        showCategoryColumn
        total={2}
        items={sampleItems}
        search={defaultSearch}
        onSearchChange={vi.fn()}
      />,
    )

    // Measured in the browser: "Generalni remont motora" broke across three lines and pushed
    // every row from 48px to 76px.
    expect(screen.getByText('Mašinska obrada').className).toContain('whitespace-nowrap')
  })
})
