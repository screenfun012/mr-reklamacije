import { m } from '@mr/i18n'
import {
  intakeOrderDetailOptions,
  intakeOrderHistoryOptions,
  intakeOrdersListOptions,
  type IntakeOrderDetail,
} from '@mr/shared'
import { useQuery } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Hoisted with the mock: `vi.mock` factories are lifted above every `const`, so a plain top-level
// binding referenced inside one is still in its temporal dead zone when the factory runs.
const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }))

// Sonner needs a <Toaster> to render anything, and what the operator is TOLD is the point here.
vi.mock('~/lib/internal-toast', () => ({ showInternalToast: toastMock }))

import { TabSpec } from '../tab-spec.js'
import { intakeOrderDetailFixture, renderDetailUi } from './render-detail.js'

/**
 * What the route does: it holds the detail through a query and hands the tab the result, so an
 * optimistic `setQueryData` re-renders the list. Rendering `<TabSpec>` with a literal prop instead
 * would make the optimistic write invisible and the test would fail against correct code.
 *
 * The history and list queries are mounted for a second reason: an invalidation that is wider than
 * it should be shows up here as an extra request and nowhere else.
 */
function SpecUnderRoute({
  order,
  canUpdate = true,
}: {
  order: IntakeOrderDetail
  canUpdate?: boolean
}): ReactElement {
  const { data } = useQuery({ ...intakeOrderDetailOptions(order.id), initialData: order })
  useQuery(intakeOrderHistoryOptions(order.id))
  useQuery(intakeOrdersListOptions({ page: 1 }))
  return <TabSpec order={data} canUpdate={canUpdate} />
}

const SERVICE = 'Zamena filtera'

interface Call {
  url: string
  method: string
}

const calls: Call[] = []

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}

/** Records every request, and answers the two reads the harness makes. */
function stubFetch(patch: (call: Call) => Promise<Response>): void {
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    const call: Call = { url: String(url), method: init?.method ?? 'GET' }
    calls.push(call)
    if (call.method === 'GET') {
      return Promise.resolve(json(call.url.includes('/history') ? [] : { items: [], total: 0 }))
    }
    return patch(call)
  })
}

const patchCount = (): number => calls.filter((call) => call.method === 'PATCH').length
const getCount = (fragment: string): number =>
  calls.filter((call) => call.method === 'GET' && call.url.includes(fragment)).length
/** `endsWith`, because the history URL contains the detail URL as a prefix. */
const detailGetCount = (): number =>
  calls.filter((call) => call.method === 'GET' && call.url.endsWith(intakeOrderDetailFixture().id))
    .length

function serviceInput(): HTMLElement {
  return screen.getByPlaceholderText(m.intake_service_add())
}

/** `queryAll`: a fixture with no materials has no ✕ in that card, which is not a failure. */
function removeButtons(): HTMLElement[] {
  return [
    ...screen.queryAllByRole('button', { name: m.intake_service_remove() }),
    ...screen.queryAllByRole('button', { name: m.intake_material_remove() }),
  ]
}

describe('TabSpec', () => {
  beforeEach(() => {
    calls.length = 0
    toastMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the line before the server answers, and takes it back when refused', async () => {
    // The PATCH is held open on purpose: settled immediately, the rollback would land inside the
    // same click and the optimistic state would never be observable.
    let refuse: (response: Response) => void = () => undefined
    const held = new Promise<Response>((resolve) => {
      refuse = resolve
    })
    stubFetch(() => held)

    await renderDetailUi(
      <SpecUnderRoute order={intakeOrderDetailFixture({ services: ['Pranje'] })} />,
    )

    await userEvent.type(serviceInput(), `${SERVICE}{Enter}`)
    expect(screen.getByText(SERVICE)).toBeInTheDocument()

    refuse(new Response(null, { status: 500 }))

    await waitFor(() => expect(screen.queryByText(SERVICE)).not.toBeInTheDocument())
    expect(screen.getByText('Pranje')).toBeInTheDocument()
    // The one moment the typed line cannot be recovered any other way, so it stays in the field.
    expect(serviceInput()).toHaveValue(SERVICE)
    // `IntakeSpecList` deliberately does not say what failed — only the caller knows — so if this
    // toast goes, a refused edit vanishes with no explanation at all.
    expect(toastMock).toHaveBeenCalledWith(m.intake_detail_action_failed())
  })

  /*
   * The bug this pins is not a race but arithmetic: both cards share one mutation and each PATCH
   * sends a WHOLE array built from what was on screen when it left. Sending a second one before
   * the first answers means the two bodies each omit the other's change — the server keeps
   * whichever lands last, and a failure of the first restores a snapshot older than both, leaving
   * the screen showing neither. For a serviser nothing heals it: SSE never reaches his channel.
   */
  it('accepts no second change while a PATCH is still open', async () => {
    stubFetch(() => new Promise<Response>(() => undefined))

    await renderDetailUi(
      <SpecUnderRoute order={intakeOrderDetailFixture({ services: ['Pranje'] })} />,
    )

    await userEvent.type(serviceInput(), `${SERVICE}{Enter}`)
    await waitFor(() => expect(patchCount()).toBe(1))

    // The optimistic row is already on screen, so its ✕ is there to be tapped.
    expect(screen.getByText(SERVICE)).toBeInTheDocument()
    for (const remove of removeButtons()) {
      expect(remove).toBeDisabled()
    }
    await userEvent.click(removeButtons()[0] as HTMLElement)

    expect(patchCount()).toBe(1)
  })

  it('keeps the server’s version of the list, not the guess it drew first', async () => {
    // The server trims and stores; what comes back is the truth, and it is not always what was
    // typed. If `onSuccess` did not write it, the optimistic guess would stay on screen forever —
    // nothing else refetches the detail.
    const stored = 'Zamena filtera i ulja'
    stubFetch(() =>
      Promise.resolve(json(intakeOrderDetailFixture({ services: ['Pranje', stored] }))),
    )

    await renderDetailUi(
      <SpecUnderRoute order={intakeOrderDetailFixture({ services: ['Pranje'] })} />,
    )

    await userEvent.type(serviceInput(), `${SERVICE}{Enter}`)

    await waitFor(() => expect(screen.getByText(stored)).toBeInTheDocument())
    expect(screen.queryByText(SERVICE)).not.toBeInTheDocument()
  })

  it('refreshes the history the edit wrote a row into, and nothing else', async () => {
    stubFetch(() =>
      Promise.resolve(json(intakeOrderDetailFixture({ services: ['Pranje', SERVICE] }))),
    )

    await renderDetailUi(
      <SpecUnderRoute order={intakeOrderDetailFixture({ services: ['Pranje'] })} />,
    )
    await waitFor(() => expect(getCount('/history')).toBe(1))

    await userEvent.type(serviceInput(), `${SERVICE}{Enter}`)

    await waitFor(() => expect(getCount('/history')).toBe(2))
    // Narrow on purpose: the list carries no services column, so invalidating it buys a request
    // that redraws identical rows, and invalidating the DETAIL races the optimistic write that
    // `cancelQueries` exists to protect.
    expect(getCount('page=')).toBe(1)
    expect(detailGetCount()).toBe(0)
  })

  /**
   * The SECOND freeze, read off `freeFieldsFor` — the same function the server refuses by. Until it
   * was wired the controls stayed live after a signed handover: the optimistic line appeared, the
   * server answered ValidationError, and the operator watched what he had just typed disappear
   * behind the generic toast. And it says why, because controls that vanish in silence read as a
   * broken screen.
   */
  it('closes both cards once the handover is signed, and says why', async () => {
    stubFetch(() => Promise.resolve(json({})))

    await renderDetailUi(
      <SpecUnderRoute
        order={intakeOrderDetailFixture({
          services: ['Pranje'],
          materials: ['Filter'],
          handoverSignedAt: '2026-08-14T10:00:00.000Z',
          archivedAt: null,
          quote: null,
        })}
      />,
    )

    expect(screen.getByText(m.intake_spec_frozen_handover())).toBeInTheDocument()
    expect(serviceInput()).toBeDisabled()
    for (const remove of removeButtons()) {
      expect(remove).toBeDisabled()
    }
  })

  it('leaves both cards open while only the intake is signed', async () => {
    stubFetch(() => Promise.resolve(json({})))

    await renderDetailUi(
      <SpecUnderRoute order={intakeOrderDetailFixture({ services: ['Pranje'] })} />,
    )

    expect(screen.queryByText(m.intake_spec_frozen_handover())).not.toBeInTheDocument()
    expect(serviceInput()).toBeEnabled()
  })

  it('lets nothing be edited without the update permission', async () => {
    // A custom role with `intake_orders.view` and no `update` can open this tab. Every attempt would
    // 403 with only the generic toast to show for it — the same shape as the header's
    // `canAdvance`/`canDelete`/`canChangeStatus`.
    stubFetch(() => Promise.resolve(json({})))

    await renderDetailUi(
      <SpecUnderRoute
        order={intakeOrderDetailFixture({ services: ['Pranje'], materials: ['Filter'] })}
        canUpdate={false}
      />,
    )

    expect(serviceInput()).toBeDisabled()
    for (const add of screen.getAllByRole('button', { name: m.intake_spec_add() })) {
      expect(add).toBeDisabled()
    }
    for (const remove of removeButtons()) {
      expect(remove).toBeDisabled()
    }
  })
})
