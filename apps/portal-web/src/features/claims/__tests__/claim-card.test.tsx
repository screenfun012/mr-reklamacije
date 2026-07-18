import { setLocale } from '@mr/i18n'
import { ClaimKind, ClaimOutcome, ClientClaimPhase, type ClientClaimListItem } from '@mr/shared'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { ClaimCard } from '../claim-card'

function baseClaim(overrides: Partial<ClientClaimListItem> = {}): ClientClaimListItem {
  return {
    kind: ClaimKind.Emotive,
    id: 'c1111111-1111-1111-1111-111111111111',
    claimNumber: '7167/25',
    mrNumber: 'MR-7167',
    warrantyReport: null,
    engineTypeCode: 'X200',
    manufacturerName: 'Acme',
    engineCode: 'ENG-1',
    dateOfClaim: '2026-06-01',
    dateOfFinish: null,
    outcome: ClaimOutcome.Pending,
    claimYear: 2026,
    customerName: 'Partner d.o.o.',
    createdAt: '2026-06-01T00:00:00.000Z',
    clientPhase: ClientClaimPhase.InProgress,
    ...overrides,
  }
}

async function renderCard(claim: ClientClaimListItem): Promise<void> {
  const rootRoute = createRootRoute({
    component: () => <ClaimCard claim={claim} index={0} />,
  })
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/claims/$id',
    component: () => <div data-testid="detail-page" />,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
}

describe('ClaimCard', () => {
  beforeEach(() => setLocale('sr'))

  it('renders a non-clickable card with the Primljena chip for a Received claim', async () => {
    await renderCard(
      baseClaim({ clientPhase: ClientClaimPhase.Received, outcome: ClaimOutcome.Pending }),
    )

    expect(screen.getByText('Primljena')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText(/Detalji/)).not.toBeInTheDocument()
  })

  it('renders a clickable card with the U obradi chip for an InProgress claim', async () => {
    await renderCard(
      baseClaim({ clientPhase: ClientClaimPhase.InProgress, outcome: ClaimOutcome.Pending }),
    )

    expect(screen.getByText('U obradi')).toBeInTheDocument()
    expect(screen.getByRole('link')).toBeInTheDocument()
  })

  it('renders the accepted verdict for a published, accepted Outcome claim', async () => {
    await renderCard(
      baseClaim({ clientPhase: ClientClaimPhase.Outcome, outcome: ClaimOutcome.Accepted }),
    )

    expect(screen.getByText('Prihvaćena')).toBeInTheDocument()
    expect(screen.getByRole('link')).toBeInTheDocument()
  })

  it('renders the declined verdict for a published, rejected Outcome claim', async () => {
    await renderCard(
      baseClaim({ clientPhase: ClientClaimPhase.Outcome, outcome: ClaimOutcome.Rejected }),
    )

    expect(screen.getByText('Odbijena')).toBeInTheDocument()
    expect(screen.getByRole('link')).toBeInTheDocument()
  })
})
