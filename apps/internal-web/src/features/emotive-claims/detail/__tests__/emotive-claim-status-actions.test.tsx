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
  canChangeOutcome: false,
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

  it('renders nothing without the change_outcome permission', () => {
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
})
