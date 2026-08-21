import { setLocale } from '@mr/i18n'
import { ClaimOutcome, type EmotiveClaimDetail } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { EmotiveClaimClientViewCard } from '../emotive-claim-client-view-card.js'

function claimWith(over: Partial<EmotiveClaimDetail>): EmotiveClaimDetail {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-08-12T00:00:00.000Z',
    outcome: ClaimOutcome.Pending,
    clientVisibleAt: null,
    publishedAt: null,
    ...over,
  } as EmotiveClaimDetail
}

function renderCard(claim: EmotiveClaimDetail): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <EmotiveClaimClientViewCard claim={claim} canPublish={false} />
    </QueryClientProvider>,
  )
}

describe('EmotiveClaimClientViewCard', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('says a published-but-undecided claim is still "U obradi"', () => {
    // ⚙ this is the whole reason the card asks the SHARED rule instead of reading the two
    // timestamps itself: published + pending reads "U obradi" on the portal, and the office
    // has to be told what the client is actually looking at.
    renderCard(
      claimWith({
        clientVisibleAt: null,
        publishedAt: '2026-08-14T00:00:00.000Z',
        outcome: ClaimOutcome.Pending,
      }),
    )

    // "U obradi" is reached AT the publish moment, so that row carries the date …
    const inProgressRow = screen.getByText('U obradi').closest('div')
    expect(inProgressRow).toHaveTextContent('14.08.2026.')

    // … while the outcome row says only that it is not published. It used to print the publish
    // date beside those words, which is a contradiction on one line.
    const outcomeRow = screen.getByText('Ishod — nije objavljen').closest('div')
    expect(outcomeRow).not.toHaveTextContent('14.08.2026.')
  })

  it('reaches the outcome only once the claim is published AND decided', () => {
    renderCard(
      claimWith({
        clientVisibleAt: '2026-08-13T00:00:00.000Z',
        publishedAt: '2026-08-14T00:00:00.000Z',
        outcome: ClaimOutcome.Accepted,
      }),
    )

    expect(screen.getByText('Ishod')).toBeInTheDocument()
    expect(screen.getByText('14.08.2026.')).toBeInTheDocument()
  })

  it('shows a fresh claim as received and nothing more', () => {
    renderCard(claimWith({}))

    expect(screen.getByText('Primljeno')).toBeInTheDocument()
    expect(screen.getByText('12.08.2026.')).toBeInTheDocument()
    expect(screen.getByText('Ishod — nije objavljen')).toBeInTheDocument()
  })
})
