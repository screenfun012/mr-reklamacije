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

import { EmotiveClaimsTable } from '../emotive-claims-table.js'

async function renderWithRouter(node: ReactElement): Promise<void> {
  const rootRoute = createRootRoute({ component: () => node })
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reklamacije/emotive/$id',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
}

describe('EmotiveClaimsTable', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  it('renders empty state when there are no rows', async () => {
    await renderWithRouter(<EmotiveClaimsTable items={[]} total={0} />)

    expect(screen.getByRole('status')).toHaveTextContent('Nema reklamacija')
  })

  it('renders claim rows with embedded list fields', async () => {
    await renderWithRouter(
      <EmotiveClaimsTable
        total={1}
        items={[
          {
            kind: 'emotive',
            id: '11111111-1111-4111-8111-111111111111',
            sequenceNumber: 1,
            claimNumber: 'EM-2026-001',
            warrantyReport: 'Test',
            engineTypeId: '22222222-2222-4222-8222-222222222222',
            engineTypeCode: 'BMW N47D20D',
            engineCode: null,
            dateOfClaim: '2026-04-17',
            mrNumber: '5376/26',
            dateOfFinish: '2025-12-15',
            employeeId: '33333333-3333-4333-8333-333333333333',
            employeeName: 'Petar Nikolić',
            sourceId: '44444444-4444-4444-8444-444444444444',
            outcome: 'pending',
            claimYear: 2026,
            customerId: '55555555-5555-4555-8555-555555555555',
            customerName: 'SELMAN',
            createdAt: '2026-04-17T10:00:00.000Z',
          },
        ]}
      />,
    )

    expect(await screen.findByText('5376/26')).toBeInTheDocument()
    expect(screen.getByText('EM-2026-001')).toBeInTheDocument()
    expect(screen.getByText('SELMAN')).toBeInTheDocument()
    expect(screen.getByText('BMW N47D20D')).toBeInTheDocument()
    expect(screen.getByText('Petar Nikolić')).toBeInTheDocument()
    expect(screen.getByText('U obradi')).toBeInTheDocument()
    expect(screen.getByText('15.12.2025.')).toBeInTheDocument()

    const viewLink = screen.getByRole('link', { name: 'Pregled' })
    expect(viewLink).toHaveAttribute(
      'href',
      '/reklamacije/emotive/11111111-1111-4111-8111-111111111111',
    )
  })
})
