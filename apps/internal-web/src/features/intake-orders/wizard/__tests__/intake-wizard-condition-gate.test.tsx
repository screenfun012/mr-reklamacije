import { m, setLocale } from '@mr/i18n'
import type { IntakeChecklistItemListItem } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { navigateMock, toastMock, SERVISER_EMAIL } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  toastMock: vi.fn(),
  SERVISER_EMAIL: 'marko@mrgroup.rs',
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('~/lib/use-internal-auth-user', () => ({
  useInternalAuthUser: () => ({ userName: 'Marko Marković', userEmail: SERVISER_EMAIL }),
}))

vi.mock('~/lib/internal-toast', () => ({ showInternalToast: toastMock }))

vi.mock('~/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'user-1' } } }) },
}))

import { IntakeWizard } from '../intake-wizard.js'
import {
  emptyIntakeWizardValues,
  writeIntakeDraft,
  type IntakeWizardValues,
} from '../intake-wizard-state.js'

const CATALOG: IntakeChecklistItemListItem[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'rezervna',
    nameSr: 'Rezervna guma',
    nameEn: 'Spare tyre',
    sortOrder: 10,
    isActive: true,
  },
]

/** Step 1 filled in, so the buffer can drop the wizard on step 2 without typing through it. */
function step2Values(overrides: Partial<IntakeWizardValues> = {}): IntakeWizardValues {
  return {
    ...emptyIntakeWizardValues(),
    orderNumber: 'RN-0249/26',
    plate: 'BG 774-LN',
    vehicle: 'Renault Master',
    ownerName: 'Milan Petrović',
    ownerPhone: '+381 60 111 2233',
    ...overrides,
  }
}

/** `fetchAllReferencePages` walks `{items, nextCursor}` pages — a null cursor ends the walk. */
function stubCatalog(items: IntakeChecklistItemListItem[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input)
      const body = url.includes('/api/intake-checklist-items') ? { items, nextCursor: null } : {}
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }),
  )
}

async function openOnStep2(
  values: IntakeWizardValues,
): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup()
  writeIntakeDraft({ orderId: null, step: 2, values, savedBy: SERVISER_EMAIL })
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <IntakeWizard />
    </QueryClientProvider>,
  )
  await user.click(await screen.findByRole('button', { name: m.intake_draft_resume() }))
  return user
}

function nextButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: m.intake_action_next() }) as HTMLButtonElement
}

describe('the wizard will not leave the checklist step with nothing recorded', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('holds DALJE and says why while nothing is recorded', async () => {
    stubCatalog(CATALOG)
    await openOnStep2(step2Values())

    await waitFor(() => expect(nextButton().disabled).toBe(true))
    expect(screen.getByText(m.intake_hint_condition_empty())).toBeInTheDocument()
  })

  it('releases DALJE on the first answer', async () => {
    stubCatalog(CATALOG)
    const user = await openOnStep2(step2Values())
    await waitFor(() => expect(nextButton().disabled).toBe(true))

    // NE is an answer, not a blank — the whole point of the third state.
    await user.click(await screen.findByRole('button', { name: m.intake_checklist_no() }))

    await waitFor(() => expect(nextButton().disabled).toBe(false))
  })

  it('releases DALJE on the equipment note alone', async () => {
    stubCatalog(CATALOG)
    const user = await openOnStep2(step2Values())
    await waitFor(() => expect(nextButton().disabled).toBe(true))

    await user.type(screen.getByLabelText(m.intake_field_equipment_note()), 'Gepek pun alata')

    await waitFor(() => expect(nextButton().disabled).toBe(false))
  })

  it('never holds DALJE when the catalog is empty', async () => {
    // The office turned everything off; the car is still in the yard, and a serviser cannot fix a
    // catalog from the wizard.
    stubCatalog([])
    await openOnStep2(step2Values())

    await waitFor(() => expect(nextButton().disabled).toBe(false))
  })
})
