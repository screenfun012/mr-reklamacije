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

function stubFetch(): {
  patches: { url: string; body: unknown }[]
  /** Every DELETE that reached the server — empty is the proof a blocked button did not act. */
  deletes: string[]
  /** Changes what the NEXT detail read answers, the way another admin's edit would. */
  bumpHolders: () => void
  /** How many times the detail row has been read — the proof a refetch actually landed. */
  detailReads: () => number
} {
  const patches: { url: string; body: unknown }[] = []
  const deletes: string[] = []
  let holderBump = 0
  let reads = 0

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

        if (init?.method === 'DELETE') {
          deletes.push(url)
          return new Response(null, { status: 204 })
        }

        reads += 1
        return json({ ...item, userCount: item.userCount + holderBump, ...DETAIL[id] })
      }

      throw new Error(`unexpected fetch: ${String(init?.method ?? 'GET')} ${url}`)
    }),
  )

  return {
    patches,
    deletes,
    bumpHolders: () => {
      holderBump += 1
    },
    detailReads: () => reads,
  }
}

function renderScreen(held: readonly string[]): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <RolesScreen heldPermissions={held} />
    </QueryClientProvider>,
  )

  return queryClient
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
    const { deletes } = stubFetch()
    renderScreen(ALL_HELD)

    const row = await screen.findByRole('row', { name: /Držano ovlašćenje/ })
    const remove = within(row).getByRole('button', { name: 'Obriši' })

    // Announced as disabled but still clickable, because a button that cannot act still has to be
    // able to say why — the reason rides along as the tooltip and is printed on click.
    expect(remove).toHaveAttribute('aria-disabled', 'true')
    expect(remove).toHaveAttribute('title', expect.stringContaining('Broj korisnika: 3'))

    await userEvent.click(remove)

    expect(deletes).toHaveLength(0)
    expect(screen.queryByText('Brisanje ovlašćenja')).not.toBeInTheDocument()
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

  /**
   * The editor fills its form from the server answer. React Query keeps a 30 s stale time and
   * refetches on window focus, and ticking through a matrix of 84 boxes takes longer than that — so
   * a refetch lands mid-edit and a form that re-seeds itself on every answer throws the work away
   * without a word.
   *
   * ⚠ The first version of this test passed against the broken code and proved nothing: React
   * Query hands back the SAME object when the refetched row is deeply equal, so the effect never
   * re-ran. It only bites when something actually changed — another admin assigning the set to
   * somebody moves `userCount` — which is exactly the moment a person is mid-edit on a busy day.
   */
  it('keeps what the user ticked when the row changes underneath mid-edit', async () => {
    const { bumpHolders, detailReads } = stubFetch()
    const queryClient = renderScreen(ALL_HELD)

    const row = await screen.findByRole('row', { name: /Moje ovlašćenje/ })
    await userEvent.click(within(row).getByRole('button', { name: 'Izmeni' }))

    const box = await screen.findByRole('checkbox', { name: /Vidi sve naloge prijema/ })
    await userEvent.click(box)
    expect(box).toBeChecked()

    const before = detailReads()
    bumpHolders()
    await queryClient.refetchQueries({ queryKey: ['roles'] })

    // Prove the second answer actually arrived AND reached the cache the dialog subscribes to;
    // otherwise the assertion below would pass on a render that never saw it, which is how the
    // first version of this test lied. It cannot be proven through the form itself — the whole
    // point of the fix is that the form stops following the cache.
    await waitFor(() => {
      expect(detailReads()).toBeGreaterThan(before)
    })
    await waitFor(() => {
      expect(
        (queryClient.getQueryData(['roles', 'detail', CUSTOM_ID]) as { userCount: number })
          .userCount,
      ).toBe(1)
    })

    expect(screen.getByRole('checkbox', { name: /Vidi sve naloge prijema/ })).toBeChecked()
  })

  /**
   * The sentence exists to name the consequence, so it has to be about the set as it is NOW. Read
   * from the list row it would be frozen at the moment the dialog opened: somebody assigned while
   * you were ticking, and you sign three people out having been told nobody holds it.
   */
  it('warns about holders that appeared after the dialog was opened', async () => {
    const { bumpHolders, detailReads } = stubFetch()
    const queryClient = renderScreen(ALL_HELD)

    const row = await screen.findByRole('row', { name: /Moje ovlašćenje/ })
    await userEvent.click(within(row).getByRole('button', { name: 'Izmeni' }))
    await screen.findByRole('checkbox', { name: /Vidi sve naloge prijema/ })

    // Nobody held it when it was opened, so there is nothing to warn about yet.
    expect(screen.queryByText(/Broj korisnika koji drže ovo ovlašćenje/)).not.toBeInTheDocument()

    const before = detailReads()
    bumpHolders()
    await queryClient.refetchQueries({ queryKey: ['roles'] })
    await waitFor(() => {
      expect(detailReads()).toBeGreaterThan(before)
    })

    expect(
      await screen.findByText(/Broj korisnika koji drže ovo ovlašćenje: 1/),
    ).toBeInTheDocument()
  })

  /**
   * Before the row arrives the form is empty, and an empty form is not the set — saving it would
   * send "no actions at all". The server's name rule happens to refuse it today, which makes this a
   * confusing error rather than a wipe; neither is an answer.
   */
  it('does not let the form be saved before the row it edits has arrived', async () => {
    let releaseDetail: (() => void) | null = null
    const held = new Promise<void>((resolve) => {
      releaseDetail = resolve
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const json = (value: unknown): Response =>
          new Response(JSON.stringify(value), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })

        if (url === '/api/roles' && (init?.method ?? 'GET') === 'GET') return json({ items: LIST })
        if (url === '/api/permissions') return json({ items: CATALOG })

        const match = /^\/api\/roles\/([0-9a-f-]+)$/.exec(url)
        if (match?.[1] !== undefined) {
          if (init?.method === 'PATCH') throw new Error('saved before the row arrived')
          await held
          return json({ ...LIST[1], ...DETAIL[CUSTOM_ID] })
        }

        throw new Error(`unexpected fetch: ${url}`)
      }),
    )

    renderScreen(ALL_HELD)

    const row = await screen.findByRole('row', { name: /Moje ovlašćenje/ })
    await userEvent.click(within(row).getByRole('button', { name: 'Izmeni' }))

    expect(await screen.findByRole('button', { name: 'Sačuvaj' })).toBeDisabled()

    releaseDetail?.()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sačuvaj' })).toBeEnabled()
    })
  })
})
