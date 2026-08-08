import { m } from '@mr/i18n'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TabHistory } from '../tab-history.js'
import { renderDetailUi } from './render-detail.js'

const ORDER_ID = '11111111-1111-4111-8111-111111111111'

/**
 * Built from a LOCAL wall time and converted, not written as a UTC literal: a hard-coded
 * `T09:14:00.000Z` is the 27th in every zone west of UTC-9, so the expected date would be a lie on
 * a machine in Honolulu and the suite would go red for a reason that has nothing to do with the code.
 */
const STAMPED_AT = new Date(2026, 6, 28, 11, 14)
/** CLDR's `dd.MM.y.` for `sr-Latn` — the trailing dot is real and is kept on purpose. */
const EXPECTED_STAMP = '28.07.2026. 11:14'

const ENTRIES = [
  {
    id: '66666666-6666-4666-8666-666666666666',
    at: STAMPED_AT.toISOString(),
    action: 'update',
    transition: 'spec_updated',
    // A deleted user: the row must still say what happened.
    actorName: null,
    fromStatus: 'primljeno',
    toStatus: 'primljeno',
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    at: '2026-07-27T19:10:00.000Z',
    action: 'create',
    transition: null,
    actorName: 'Miloš Jovanović',
    fromStatus: null,
    toStatus: null,
  },
]

let historyCalls = 0

function stubHistory(respond: () => Promise<Response>): void {
  historyCalls = 0
  vi.stubGlobal('fetch', () => {
    historyCalls += 1
    return respond()
  })
}

describe('TabHistory', () => {
  beforeEach(() => {
    historyCalls = 0
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('labels every row and names who did it, or a dash when nobody is left to name', async () => {
    stubHistory(() =>
      Promise.resolve(
        new Response(JSON.stringify(ENTRIES), { headers: { 'Content-Type': 'application/json' } }),
      ),
    )

    await renderDetailUi(<TabHistory orderId={ORDER_ID} />)

    await waitFor(() =>
      expect(screen.getByText(m.intake_history_spec_updated())).toBeInTheDocument(),
    )
    expect(screen.getByText(m.intake_history_created())).toBeInTheDocument()
    expect(screen.getByText('Miloš Jovanović')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    // Space-joined, not the ` · ` the list and the Pregled card use — the row already carries a
    // `·` inside a status label beside it.
    expect(screen.getByText(EXPECTED_STAMP)).toBeInTheDocument()
  })

  it('keeps the card standing, with a skeleton in it, while the history is still loading', async () => {
    stubHistory(() => new Promise<Response>(() => undefined))

    await renderDetailUi(<TabHistory orderId={ORDER_ID} />)

    // Without a Suspense boundary of its own the route's `pendingComponent` takes over and the
    // header, both bars and the tab strip disappear on every switch to Istorija.
    expect(screen.getByText(m.intake_tab_istorija())).toBeInTheDocument()
    // And a skeleton, not nothing: an empty card reads as "this order has no history".
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  /*
   * `useSuspenseQuery` re-throws, and without a boundary of its own the nearest one is the ROUTE's
   * `errorComponent` — so one flaky fetch for a secondary tab would replace the header, both bars,
   * the tab strip and the three tabs that work with a red box whose only exit is the back link.
   */
  it('keeps its failure inside its own card', async () => {
    stubHistory(() => Promise.resolve(new Response(null, { status: 500 })))

    await renderDetailUi(<TabHistory orderId={ORDER_ID} />)

    await waitFor(() => expect(screen.getByText(m.intake_detail_error_title())).toBeInTheDocument())
    expect(screen.getByText(m.intake_tab_istorija())).toBeInTheDocument()
  })

  it('really refetches when the error box offers to try again', async () => {
    // A retry button that resets the boundary without refetching is the failure this repo has
    // shipped nine times (see `intake-error-state.tsx`), so the proof is a second request.
    stubHistory(() => Promise.resolve(new Response(null, { status: 500 })))

    await renderDetailUi(<TabHistory orderId={ORDER_ID} />)
    const retry = await waitFor(() => screen.getByRole('button', { name: m.route_error_retry() }))
    expect(historyCalls).toBe(1)

    await userEvent.click(retry)

    await waitFor(() => expect(historyCalls).toBe(2))
  })
})
