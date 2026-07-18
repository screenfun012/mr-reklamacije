import { setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'

import {
  EmotiveClaimStatusActions,
  type EmotiveClaimStatusActionsProps,
} from '../emotive-claim-status-actions.js'

const CLAIM_ID = '11111111-1111-4111-8111-111111111111'

const DEFAULT_PROPS: EmotiveClaimStatusActionsProps = {
  claimId: CLAIM_ID,
  outcome: 'pending',
  clientVisibleAt: null,
  publishedAt: null,
  canChangeOutcome: false,
  canPublish: false,
}

function renderStatusActions(
  overrides: Partial<EmotiveClaimStatusActionsProps> = {},
): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const node: ReactElement = <EmotiveClaimStatusActions {...DEFAULT_PROPS} {...overrides} />
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>)
}

function stubFetchOk(): ReturnType<typeof vi.fn> {
  const fetchSpy = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ id: CLAIM_ID, outcome: 'accepted', publishedAt: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

describe('EmotiveClaimStatusActions', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing without change_outcome or publish permission', () => {
    renderStatusActions()

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers accept and reject to a change_outcome holder', () => {
    renderStatusActions({ canChangeOutcome: true })

    expect(screen.getByRole('button', { name: 'Prihvati' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Odbij' })).toBeInTheDocument()
  })

  // Accepting/rejecting now happens at any time (no more edit-lock/reopen), so
  // both must confirm before the mutation fires.
  it('gates accept behind a confirm dialog; the mutation runs only after confirming', async () => {
    const fetchSpy = stubFetchOk()

    renderStatusActions({ canChangeOutcome: true })

    fireEvent.click(screen.getByRole('button', { name: 'Prihvati' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Označiti reklamaciju kao PRIHVAĆENO?')).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Otkaži' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Prihvati' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Prihvati' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
  })

  it('gates reject behind a confirm dialog; the mutation runs only after confirming', async () => {
    const fetchSpy = stubFetchOk()

    renderStatusActions({ canChangeOutcome: true })

    fireEvent.click(screen.getByRole('button', { name: 'Odbij' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Označiti reklamaciju kao ODBIJENO?')).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Otkaži' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Odbij' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Odbij' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
  })

  describe('publish to client', () => {
    it('shows "Objavi klijentu" when the user can publish and it is unpublished', () => {
      renderStatusActions({ canPublish: true, publishedAt: null })

      expect(screen.getByRole('button', { name: 'Objavi klijentu' })).toBeInTheDocument()
    })

    it('hides "Objavi klijentu" once publishedAt is set', () => {
      renderStatusActions({
        canPublish: true,
        publishedAt: '2026-07-18T09:00:00.000Z',
        outcome: 'accepted',
      })

      expect(screen.queryByRole('button', { name: 'Objavi klijentu' })).not.toBeInTheDocument()
    })

    it('hides "Objavi klijentu" without the publish permission', () => {
      renderStatusActions({ canChangeOutcome: true, canPublish: false, publishedAt: null })

      expect(screen.queryByRole('button', { name: 'Objavi klijentu' })).not.toBeInTheDocument()
    })

    it('gates publish behind a confirm dialog; the mutation runs only after confirming', async () => {
      const fetchSpy = stubFetchOk()

      renderStatusActions({ canPublish: true, publishedAt: null, outcome: 'accepted' })

      fireEvent.click(screen.getByRole('button', { name: 'Objavi klijentu' }))

      const dialog = screen.getByRole('dialog')
      expect(fetchSpy).not.toHaveBeenCalled()

      fireEvent.click(within(dialog).getByRole('button', { name: 'Objavi klijentu' }))

      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(url).toContain(`/api/emotive-claims/${CLAIM_ID}/publish`)
      expect(init.method).toBe('POST')
    })

    it('shows the decided outcome in the confirm copy when the outcome is accepted', () => {
      renderStatusActions({ canPublish: true, publishedAt: null, outcome: 'accepted' })

      fireEvent.click(screen.getByRole('button', { name: 'Objavi klijentu' }))

      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText(/Klijent će videti ishod: Prihvaćeno/)).toBeInTheDocument()
    })

    it('shows the decided outcome in the confirm copy when the outcome is rejected', () => {
      renderStatusActions({ canPublish: true, publishedAt: null, outcome: 'rejected' })

      fireEvent.click(screen.getByRole('button', { name: 'Objavi klijentu' }))

      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText(/Klijent će videti ishod: Odbijeno/)).toBeInTheDocument()
    })

    it('shows the current in-progress status in the confirm copy when the outcome is pending', () => {
      renderStatusActions({ canPublish: true, publishedAt: null, outcome: 'pending' })

      fireEvent.click(screen.getByRole('button', { name: 'Objavi klijentu' }))

      const dialog = screen.getByRole('dialog')
      expect(
        within(dialog).getByText(/Klijent će videti trenutni status: U obradi/),
      ).toBeInTheDocument()
    })
  })

  describe('stage badge', () => {
    it('shows Primljeno when neither timestamp is set', () => {
      renderStatusActions({ clientVisibleAt: null, publishedAt: null })

      expect(screen.getByText('Primljeno')).toBeInTheDocument()
      expect(screen.getByText('Još nije objavljeno')).toBeInTheDocument()
    })

    it('shows U obradi once clientVisibleAt is set but not yet published', () => {
      renderStatusActions({
        clientVisibleAt: '2026-07-01T00:00:00.000Z',
        publishedAt: null,
      })

      expect(screen.getByText('U obradi')).toBeInTheDocument()
      expect(screen.getByText('Još nije objavljeno')).toBeInTheDocument()
    })

    it('shows Objavljeno once publishedAt is set, with no "not published" cue', () => {
      renderStatusActions({
        clientVisibleAt: '2026-07-01T00:00:00.000Z',
        publishedAt: '2026-07-02T00:00:00.000Z',
      })

      expect(screen.getByText('Objavljeno')).toBeInTheDocument()
      expect(screen.queryByText('Još nije objavljeno')).not.toBeInTheDocument()
    })
  })
})
