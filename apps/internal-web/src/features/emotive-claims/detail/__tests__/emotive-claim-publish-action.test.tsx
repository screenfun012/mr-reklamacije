import { setLocale } from '@mr/i18n'
import { ClaimOutcome } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  EmotiveClaimPublishAction,
  type EmotiveClaimPublishActionProps,
} from '../emotive-claim-publish-action.js'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'

const DEFAULT_PROPS: EmotiveClaimPublishActionProps = {
  claimId: CLAIM_ID,
  outcome: ClaimOutcome.Pending,
  publishedAt: null,
  canPublish: false,
}

function renderAction(overrides: Partial<EmotiveClaimPublishActionProps> = {}): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const node: ReactElement = <EmotiveClaimPublishAction {...DEFAULT_PROPS} {...overrides} />
  render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>)
}

function stubFetchOk(): ReturnType<typeof vi.fn> {
  const fetchSpy = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ id: CLAIM_ID, publishedAt: '2026-08-21T00:00:00.000Z' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

describe('EmotiveClaimPublishAction', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows "Objavi klijentu" when the user can publish and it is unpublished', () => {
    renderAction({ canPublish: true })

    expect(screen.getByRole('button', { name: 'Objavi ishod klijentu' })).toBeInTheDocument()
  })

  it('hides "Objavi klijentu" once publishedAt is set', () => {
    renderAction({
      canPublish: true,
      publishedAt: '2026-07-18T09:00:00.000Z',
      outcome: ClaimOutcome.Accepted,
    })

    expect(screen.queryByRole('button', { name: 'Objavi ishod klijentu' })).not.toBeInTheDocument()
  })

  it('hides "Objavi klijentu" without the publish permission', () => {
    renderAction({ canPublish: false })

    expect(screen.queryByRole('button', { name: 'Objavi ishod klijentu' })).not.toBeInTheDocument()
  })

  it('gates publish behind a confirm dialog; the mutation runs only after confirming', async () => {
    const fetchSpy = stubFetchOk()

    renderAction({ canPublish: true, outcome: ClaimOutcome.Accepted })

    fireEvent.click(screen.getByRole('button', { name: 'Objavi ishod klijentu' }))

    const dialog = screen.getByRole('dialog')
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Objavi klijentu' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(`/api/emotive-claims/${CLAIM_ID}/publish`)
    expect(init.method).toBe('POST')
  })

  it('shows the decided outcome in the confirm copy when the outcome is accepted', () => {
    renderAction({ canPublish: true, outcome: ClaimOutcome.Accepted })

    fireEvent.click(screen.getByRole('button', { name: 'Objavi ishod klijentu' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Klijent će videti ishod: Prihvaćeno/)).toBeInTheDocument()
  })

  it('shows the decided outcome in the confirm copy when the outcome is rejected', () => {
    renderAction({ canPublish: true, outcome: ClaimOutcome.Rejected })

    fireEvent.click(screen.getByRole('button', { name: 'Objavi ishod klijentu' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Klijent će videti ishod: Odbijeno/)).toBeInTheDocument()
  })

  it('shows the current in-progress status in the confirm copy when the outcome is pending', () => {
    renderAction({ canPublish: true, outcome: ClaimOutcome.Pending })

    fireEvent.click(screen.getByRole('button', { name: 'Objavi ishod klijentu' }))

    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText(/Klijent će videti trenutni status: U obradi/),
    ).toBeInTheDocument()
  })
})
