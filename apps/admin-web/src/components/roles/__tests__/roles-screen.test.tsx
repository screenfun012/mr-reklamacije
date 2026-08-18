import { setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RolesScreen } from '../roles-screen'

const STANDARD_ID = '11111111-1111-4111-8111-111111111111'
const CUSTOM_ID = '22222222-2222-4222-8222-222222222222'
const HELD_ID = '33333333-3333-4333-8333-333333333333'

const CATALOG = [
  {
    id: 'intake_orders.view',
    module: 'intake_orders',
    nameSr: 'Vidi sve naloge prijema',
    nameEn: 'See every intake order',
    descriptionSr: 'Cela radionica, ne samo svoji nalozi.',
    descriptionEn: 'The whole shop, not only his own orders.',
  },
  {
    id: 'intake_orders.send_document',
    module: 'intake_orders',
    nameSr: 'Šalje papir vlasniku na mejl',
    nameEn: 'Sends the document to the owner',
    descriptionSr: 'Isti zapečaćeni fajl, nikad novi.',
    descriptionEn: 'The same sealed file, never a new one.',
  },
  {
    id: 'audit.view',
    module: 'audit',
    nameSr: 'Vidi Istoriju',
    nameEn: 'See the audit trail',
    descriptionSr: 'Ko je šta promenio i kada.',
    descriptionEn: 'Who changed what, and when.',
  },
]

const LIST = [
  {
    id: STANDARD_ID,
    code: 'intake_office',
    nameSr: 'Prijem — kancelarija',
    nameEn: 'Intake — office',
    description: null,
    isSystem: true,
    userCount: 0,
    permissionCount: 1,
  },
  {
    id: CUSTOM_ID,
    code: 'moje_ovlascenje',
    nameSr: 'Moje ovlašćenje',
    nameEn: 'My privilege',
    description: null,
    isSystem: false,
    userCount: 0,
    permissionCount: 1,
  },
  {
    id: HELD_ID,
    code: 'drzano',
    nameSr: 'Držano ovlašćenje',
    nameEn: 'Held privilege',
    description: null,
    isSystem: false,
    userCount: 3,
    permissionCount: 1,
  },
]

const DETAIL: Record<string, { permissions: string[] }> = {
  [STANDARD_ID]: { permissions: ['intake_orders.view'] },
  [CUSTOM_ID]: { permissions: ['audit.view'] },
  [HELD_ID]: { permissions: ['audit.view'] },
}

function stubFetch(): { patches: { url: string; body: unknown }[] } {
  const patches: { url: string; body: unknown }[] = []

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const json = (value: unknown, status = 200): Response =>
        new Response(JSON.stringify(value), {
          status,
          headers: { 'content-type': 'application/json' },
        })

      if (url === '/api/roles' && (init?.method ?? 'GET') === 'GET') return json({ items: LIST })
      if (url === '/api/permissions') return json({ items: CATALOG })

      const detailMatch = /^\/api\/roles\/([0-9a-f-]+)$/.exec(url)
      if (detailMatch?.[1] !== undefined) {
        const id = detailMatch[1]
        const item = LIST.find((row) => row.id === id)
        if (item === undefined) throw new Error(`unknown role ${id}`)

        if (init?.method === 'PATCH') {
          patches.push({ url, body: JSON.parse(String(init.body)) })
          return json({ ...item, ...DETAIL[id] })
        }

        return json({ ...item, ...DETAIL[id] })
      }

      throw new Error(`unexpected fetch: ${String(init?.method ?? 'GET')} ${url}`)
    }),
  )

  return { patches }
}

function renderScreen(held: readonly string[]): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <RolesScreen heldPermissions={held} />
    </QueryClientProvider>,
  )
}

const ALL_HELD = CATALOG.map((item) => item.id)

describe('the privileges screen', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    vi.unstubAllGlobals()
  })

  it('offers only copying on a standard privilege, never editing', async () => {
    stubFetch()
    renderScreen(ALL_HELD)

    const row = await screen.findByRole('row', { name: /Prijem — kancelarija/ })

    expect(within(row).getByRole('button', { name: 'Umnoži' })).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Izmeni' })).not.toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Obriši' })).not.toBeInTheDocument()
    expect(within(row).getByText('STANDARDNO')).toBeInTheDocument()
  })

  /**
   * The screen refuses before the server does, and says the number — a dead button with no reason
   * is the thing this codebase treats as a bug.
   */
  it('will not delete a privilege somebody holds, and says how many', async () => {
    stubFetch()
    renderScreen(ALL_HELD)

    const row = await screen.findByRole('row', { name: /Držano ovlašćenje/ })
    const remove = within(row).getByRole('button', { name: 'Obriši' })

    expect(remove).toBeDisabled()
    expect(within(row).getByText(/Broj korisnika: 3/)).toBeInTheDocument()
  })

  it('names the consequence, with the number, before a held privilege is saved', async () => {
    stubFetch()
    renderScreen(ALL_HELD)

    const row = await screen.findByRole('row', { name: /Držano ovlašćenje/ })
    await userEvent.click(within(row).getByRole('button', { name: 'Izmeni' }))

    expect(
      await screen.findByText(/Broj korisnika koji drže ovo ovlašćenje: 3/),
    ).toBeInTheDocument()
    expect(screen.getByText(/biće im prekinuta prijava/)).toBeInTheDocument()
  })

  /**
   * "You cannot hand out what you do not hold", shown on the screen. The server judges it
   * (`RolesService.assertActorHolds`); this is the half that stops somebody ticking a box that
   * would only come back as a 403.
   */
  it('kills the checkbox for an action the actor does not hold, and says why', async () => {
    stubFetch()
    renderScreen(['audit.view', 'intake_orders.view'])

    const row = await screen.findByRole('row', { name: /Moje ovlašćenje/ })
    await userEvent.click(within(row).getByRole('button', { name: 'Izmeni' }))

    const dead = await screen.findByRole('checkbox', { name: /Šalje papir vlasniku na mejl/ })
    expect(dead).toBeDisabled()
    expect(screen.getByText(/Ovu radnju ni sam nemaš/)).toBeInTheDocument()

    // What he does hold stays usable.
    expect(screen.getByRole('checkbox', { name: /Vidi sve naloge prijema/ })).toBeEnabled()
  })

  it('saves the actions that were ticked', async () => {
    const { patches } = stubFetch()
    renderScreen(ALL_HELD)

    const row = await screen.findByRole('row', { name: /Moje ovlašćenje/ })
    await userEvent.click(within(row).getByRole('button', { name: 'Izmeni' }))

    await userEvent.click(await screen.findByRole('checkbox', { name: /Vidi sve naloge prijema/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    await waitFor(() => {
      expect(patches).toHaveLength(1)
    })
    expect(patches[0]?.url).toBe(`/api/roles/${CUSTOM_ID}`)
    expect((patches[0]?.body as { permissions: string[] }).permissions).toEqual(
      expect.arrayContaining(['audit.view', 'intake_orders.view']),
    )
  })
})
