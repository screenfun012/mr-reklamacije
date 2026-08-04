import { m, setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Hoisted with the mocks: `vi.mock` factories are lifted above every `const`, so a plain top-level
// binding referenced inside one is still in its temporal dead zone when the factory runs.
const { deleteIntakeOrderMock, navigateMock, toastMock, SERVISER_EMAIL } = vi.hoisted(() => ({
  deleteIntakeOrderMock: vi.fn(),
  navigateMock: vi.fn(),
  toastMock: vi.fn(),
  SERVISER_EMAIL: 'marko@mrgroup.rs',
}))

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
})
