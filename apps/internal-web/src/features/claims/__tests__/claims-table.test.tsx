import { ClaimKind, ClaimSortBy, ClaimSortDir } from '@mr/shared'
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

import { ClaimsTable } from '../claims-table.js'

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
  render(<RouterProvider router={router as never} />)
}

describe('ClaimsTable', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  it('renders empty state when there are no rows', async () => {
    const onSearchChange = vi.fn()
    await renderWithRouter(
      <ClaimsTable items={[]} total={0} search={defaultSearch} onSearchChange={onSearchChange} />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Nema reklamacija')
  })

  it('renders emotive and domace rows with kind badges and detail links', async () => {
    const onSearchChange = vi.fn()
    await renderWithRouter(
      <ClaimsTable
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
})
