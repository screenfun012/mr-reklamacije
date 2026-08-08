import { m, setLocale } from '@mr/i18n'
import {
  IntakeNumberCheckStatus,
  IntakeOrderListItemSchema,
  IntakeOrdersSearchSchema,
  type IntakeOrderDetail,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Hoisted with the mocks: `vi.mock` factories are lifted above every `const`, so a plain top-level
// binding referenced inside one is still in its temporal dead zone when the factory runs.
const { deleteIntakeOrderMock, navigateMock, toastMock, liveSession, SERVISER_EMAIL } = vi.hoisted(
  () => ({
    deleteIntakeOrderMock: vi.fn(),
    navigateMock: vi.fn(),
    toastMock: vi.fn(),
    /** Mutable so a case can decide whether the live session has answered yet, and with whom. */
    liveSession: { userId: undefined as string | undefined },
    SERVISER_EMAIL: 'marko@mrgroup.rs',
  }),
)

vi.mock('@mr/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mr/shared')>()
  return { ...actual, deleteIntakeOrder: deleteIntakeOrderMock }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

// The real hook reads the root route's context, which would drag a whole router in for a name.
vi.mock('~/lib/use-internal-auth-user', () => ({
  useInternalAuthUser: () => ({ userName: 'Marko Marković', userEmail: SERVISER_EMAIL }),
}))

// Sonner needs a <Toaster> to render anything, and what the serviser is TOLD is the point here.
vi.mock('~/lib/internal-toast', () => ({ showInternalToast: toastMock }))

// The user id lives only in the live session, and the guard under test turns on whether it has
// arrived yet — so the whole point is being able to say "not yet".
vi.mock('~/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: liveSession.userId } } }) },
}))

import {
  intakeDraftFixture,
  intakeOrderDetailFixture,
  renderDetailUi,
} from '../../detail/__tests__/render-detail.js'
import { UnfinishedBanner } from '~/routes/_shell/prijem/index.js'
import { IntakeWizard } from '../intake-wizard.js'
import {
  emptyIntakeWizardValues,
  INTAKE_DRAFT_STORAGE_KEY,
  writeIntakeDraft,
  type IntakeWizardValues,
} from '../intake-wizard-state.js'

function bufferedValues(): IntakeWizardValues {
  return {
    ...emptyIntakeWizardValues(),
    orderNumber: 'RN-0249/26',
    plate: 'BG 774-LN',
    vehicle: 'Renault Master',
    ownerName: 'Milan Petrović',
    ownerPhone: '+381 60 111 2233',
  }
}

function renderWizard(resumeOrderId?: string): ReturnType<typeof render> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <IntakeWizard {...(resumeOrderId === undefined ? {} : { resumeOrderId })} />
    </QueryClientProvider>,
  )
}

function storedDraft(): string | null {
  return window.localStorage.getItem(INTAKE_DRAFT_STORAGE_KEY)
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Answers by URL fragment, first match wins — so `check-number` has to be listed before the
 * detail path it is a prefix of. Anything unlisted gets `{}`, which is what `beforeEach` gives
 * every request: a body the wire schemas reject, i.e. a query that never resolves to data.
 */
function stubFetch(answers: ReadonlyArray<readonly [string, unknown]>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input)
      const hit = answers.find(([fragment]) => url.includes(fragment))
      return jsonResponse(hit === undefined ? {} : hit[1])
    }),
  )
}

/** Serves one order at its own detail URL — the only thing a `?resume=` fetch needs. */
function stubOrderFetch(order: IntakeOrderDetail): void {
  stubFetch([[`/api/intake-orders/${order.id}`, order]])
}

/** Opens the confirm dialog from the footer and confirms it — both buttons read "Odustani". */
async function confirmDiscard(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: m.intake_action_discard() }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: m.intake_action_discard() }))
}

describe('the wizard and the tablet draft buffer', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    window.localStorage.clear()
    deleteIntakeOrderMock.mockReset()
    navigateMock.mockReset()
    toastMock.mockReset()
    liveSession.userId = undefined
    // Nothing here needs a real response: with the number field empty every query on the mount
    // path is disabled, and the ones a resume wakes up only feed the note we are not asserting on.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      ),
    )
  })

  it('still offers a draft the serviser neither took nor waved away, after the tablet reloads', async () => {
    writeIntakeDraft({ orderId: null, step: 2, values: bufferedValues(), savedBy: SERVISER_EMAIL })

    const first = renderWizard()
    expect(
      await screen.findByText(m.intake_draft_found({ number: 'RN-0249/26', step: 2 })),
    ).toBeInTheDocument()

    // The tablet is discarded in the background and comes back — the serviser never answered.
    first.unmount()
    renderWizard()

    expect(
      await screen.findByText(m.intake_draft_found({ number: 'RN-0249/26', step: 2 })),
    ).toBeInTheDocument()
  })

  it('lets go of the intake on ODUSTANI even when the server refuses to delete it', async () => {
    const user = userEvent.setup()
    deleteIntakeOrderMock.mockRejectedValue(new Error('order already gone'))
    writeIntakeDraft({
      orderId: 'order-1',
      step: 1,
      values: bufferedValues(),
      savedBy: SERVISER_EMAIL,
    })

    renderWizard()
    await user.click(await screen.findByRole('button', { name: m.intake_draft_resume() }))
    await confirmDiscard(user)

    // The server row may survive and stays recoverable in his unfinished list; the tablet must not
    // keep offering it, and ODUSTANI must not become a button that only shows an error.
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/prijem' }))
    expect(deleteIntakeOrderMock).toHaveBeenCalledWith('order-1')
    expect(storedDraft()).toBeNull()
    // And he is told, in words that hold whether the row survived or the response was simply lost.
    expect(toastMock).toHaveBeenCalledWith(m.intake_discard_failed())
  })

  it('does not write the buffer back when the tablet sleeps right after ODUSTANI', async () => {
    const user = userEvent.setup()
    deleteIntakeOrderMock.mockResolvedValue(undefined)
    writeIntakeDraft({
      orderId: 'order-1',
      step: 1,
      values: bufferedValues(),
      savedBy: SERVISER_EMAIL,
    })

    renderWizard()
    await user.click(await screen.findByRole('button', { name: m.intake_draft_resume() }))
    await confirmDiscard(user)
    await waitFor(() => expect(storedDraft()).toBeNull())

    // iPadOS freezes the page without warning, and the visibility listener still holds the draft
    // it closed over — so clearing storage is not enough on its own.
    document.dispatchEvent(new Event('visibilitychange'))

    expect(storedDraft()).toBeNull()
  })

  it("asked for one intake by id, never offers the tablet's copy of a different one", async () => {
    // The worst shape of this bug: the tablet still holds RN-0249/26 while the serviser taps
    // NASTAVI PRIJEM on another order. Honouring the buffer would open the wrong car's intake —
    // with that customer's name, phone and address on screen.
    writeIntakeDraft({
      orderId: 'order-1',
      step: 2,
      values: bufferedValues(),
      savedBy: SERVISER_EMAIL,
    })

    renderWizard('order-2')

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(
      screen.queryByText(m.intake_draft_found({ number: 'RN-0249/26', step: 2 })),
    ).not.toBeInTheDocument()
  })

  it('still offers the tablet copy when no particular intake was asked for', async () => {
    writeIntakeDraft({
      orderId: 'order-1',
      step: 2,
      values: bufferedValues(),
      savedBy: SERVISER_EMAIL,
    })

    renderWizard()

    expect(
      await screen.findByText(m.intake_draft_found({ number: 'RN-0249/26', step: 2 })),
    ).toBeInTheDocument()
  })

  it("keeps this tablet's own copy of the intake it was asked to resume", async () => {
    // `?resume=` is never cleared, so this is every reload after the first: the server copy is one
    // step patch behind, and adopting it over the buffer loses a whole step's typing.
    const order = intakeDraftFixture()
    liveSession.userId = order.technicianId
    writeIntakeDraft({
      orderId: order.id,
      step: 4,
      values: bufferedValues(),
      savedBy: SERVISER_EMAIL,
    })
    stubOrderFetch(order)

    renderWizard(order.id)

    // The buffer's number, not the server's RN-0950/26 — and the buffer's step, not draftStep 3.
    expect(await screen.findByDisplayValue('RN-0249/26')).toBeInTheDocument()
    expect(screen.getByText(m.intake_hint_step({ step: 4 }))).toBeInTheDocument()
  })

  it("does not fold the tablet's copy of a DIFFERENT intake into the one asked for", async () => {
    // The same danger as the offer it replaces: the tablet holds RN-0249/26 while the serviser is
    // sent into another order, and honouring that buffer would open the wrong customer's car.
    const order = intakeDraftFixture()
    liveSession.userId = order.technicianId
    writeIntakeDraft({
      orderId: 'another-order',
      step: 5,
      values: bufferedValues(),
      savedBy: SERVISER_EMAIL,
    })
    stubOrderFetch(order)

    renderWizard(order.id)

    expect(await screen.findByDisplayValue(order.orderNumber)).toBeInTheDocument()
    expect(screen.queryByDisplayValue('RN-0249/26')).toBeNull()
  })

  it("refuses a colleague's intake, and puts nothing of it on the tablet", async () => {
    // Reachable for the office only: a serviser's GET 404s on the row scope, while an operator
    // holds `view` + `create` and gets a 200 on any draft.
    const order = intakeDraftFixture()
    liveSession.userId = '33333333-3333-4333-8333-333333333333'
    stubOrderFetch(order)

    renderWizard(order.id)

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(m.intake_resume_failed()))
    expect(screen.queryByDisplayValue(order.orderNumber)).toBeNull()
    expect(screen.queryByDisplayValue(order.ownerName)).toBeNull()
  })

  it('refuses an intake that has already been signed', async () => {
    const order = intakeOrderDetailFixture()
    liveSession.userId = order.technicianId
    stubOrderFetch(order)

    renderWizard(order.id)

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(m.intake_resume_failed()))
    expect(screen.queryByDisplayValue(order.orderNumber)).toBeNull()
  })

  it('opens his own intake even though the live session has not answered yet', async () => {
    // The id arrives with hydration. Refusing while it is missing would turn a serviser away from
    // his own work — so the owner clause fails OPEN, unlike the detail bar's hidden button.
    const order = intakeDraftFixture()
    stubOrderFetch(order)

    renderWizard(order.id)

    expect(await screen.findByDisplayValue(order.orderNumber)).toBeInTheDocument()
    expect(toastMock).toHaveBeenCalledWith(m.intake_resume_loaded())
    // Once, not once per render. The identity lives in a ref precisely so `resumeServerOrder` stays
    // referentially stable: put it in the mount effect's dependency array instead and adopting sets
    // a fresh `values` object, which re-renders, which builds a fresh identity, which re-fires the
    // effect — a resume that never stops re-adopting, and the step keeps resetting under the
    // serviser's hands. Measured: 1 here, 3 and climbing without the ref.
    expect(toastMock).toHaveBeenCalledTimes(1)
  })

  it('stops DALJE past step 1 once the number belongs to a signed order', async () => {
    const user = userEvent.setup()
    writeIntakeDraft({
      orderId: 'order-1',
      step: 2,
      values: bufferedValues(),
      savedBy: SERVISER_EMAIL,
    })
    stubFetch([
      [
        '/api/intake-orders/check-number',
        {
          status: IntakeNumberCheckStatus.TakenOrder,
          // A valid wire shape (the id is withheld from a caller who may not open that order) and
          // the one that keeps this harness router-free: with an id the bar renders `Otvori nalog`
          // as a <Link>, and a <Link> with no RouterProvider around it throws.
          orderId: null,
          draftStep: null,
          takenByName: null,
          vehicle: 'Opel Astra',
          plate: 'BG-950-AA',
        },
      ],
    ])

    renderWizard()
    await user.click(await screen.findByRole('button', { name: m.intake_draft_resume() }))

    // Every patch from here dead-ends on a 422, so the button must not be live — and it has to
    // say why, which is why the number hint now outranks the plain "Korak 2 / 5".
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: m.intake_action_next() })).toBeDisabled()
      },
      { timeout: 3000 },
    )
    expect(screen.getByText(m.intake_hint_number_taken())).toBeInTheDocument()
  })
})

describe('the unfinished-intake banner on the list', () => {
  /** The list row for the same draft, parsed through the wire schema like every other fixture. */
  const draftRow = IntakeOrderListItemSchema.parse({
    ...intakeDraftFixture(),
    damageCount: 0,
    photoCount: 0,
  })

  it('sends the serviser into that intake, not into whatever the tablet still holds', async () => {
    stubFetch([['/api/intake-orders?', { items: [draftRow], total: 1, page: 1, pageSize: 25 }]])

    await renderDetailUi(
      <Suspense fallback={null}>
        <UnfinishedBanner search={IntakeOrdersSearchSchema.parse({})} seesWholeShop={false} />
      </Suspense>,
    )

    expect(await screen.findByRole('link', { name: m.intake_draft_resume() })).toHaveAttribute(
      'href',
      `/prijem/novi?resume=${draftRow.id}`,
    )
  })
})
