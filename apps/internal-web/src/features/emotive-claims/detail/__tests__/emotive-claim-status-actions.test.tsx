import { setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EmotiveClaimStatusActions } from '../emotive-claim-status-actions.js'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'

function renderWithClient(node: ReactElement): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>)
}

describe('EmotiveClaimStatusActions', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing without the change_outcome permission', () => {
    renderWithClient(
      <EmotiveClaimStatusActions
        claimId={CLAIM_ID}
        currentOutcome="pending"
        canChangeOutcome={false}
        canReopen={false}
      />,
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers the other flow outcomes (registry-driven, archived excluded) for a pending claim', () => {
    renderWithClient(
      <EmotiveClaimStatusActions
        claimId={CLAIM_ID}
        currentOutcome="pending"
        canChangeOutcome
        canReopen={false}
      />,
    )

    expect(screen.getByRole('button', { name: 'Prihvati' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Odbij' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vrati u obradu' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Arhivirano' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('emotive-claim-lock-indicator')).not.toBeInTheDocument()
  })

  it('shows the lock indicator and no reopen button for an operator on a completed claim', () => {
    renderWithClient(
      <EmotiveClaimStatusActions
        claimId={CLAIM_ID}
        currentOutcome="accepted"
        canChangeOutcome
        canReopen={false}
      />,
    )

    expect(screen.getByTestId('emotive-claim-lock-indicator')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vrati u obradu' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Prihvati' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Odbij' })).not.toBeInTheDocument()
  })

  it('shows the reopen button for an admin on a completed claim', () => {
    renderWithClient(
      <EmotiveClaimStatusActions
        claimId={CLAIM_ID}
        currentOutcome="rejected"
        canChangeOutcome
        canReopen
      />,
    )

    expect(screen.getByTestId('emotive-claim-lock-indicator')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vrati u obradu' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Odbij' })).not.toBeInTheDocument()
  })

  // Accepting also locks the claim irreversibly for operators, so it must confirm too.
  it('requires a two-step confirmation before accepting', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    renderWithClient(
      <EmotiveClaimStatusActions
        claimId={CLAIM_ID}
        currentOutcome="pending"
        canChangeOutcome
        canReopen={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Prihvati' }))

    expect(screen.getByText('Potvrditi prihvatanje?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Potvrdi prihvatanje' })).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Otkaži' }))

    expect(screen.queryByText('Potvrditi prihvatanje?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prihvati' })).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('requires a two-step confirmation before rejecting', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    renderWithClient(
      <EmotiveClaimStatusActions
        claimId={CLAIM_ID}
        currentOutcome="pending"
        canChangeOutcome
        canReopen={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Odbij' }))

    expect(screen.getByText('Potvrditi odbijanje?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Potvrdi odbijanje' })).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Otkaži' }))

    expect(screen.queryByText('Potvrditi odbijanje?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prihvati' })).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
