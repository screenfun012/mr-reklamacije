import { setLocale } from '@mr/i18n'
import {
  ChatConversationType,
  ClaimKind,
  type ChatConversationListItem,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Composer } from '../composer'

const TALKED_ABOUT_ID = '11111111-1111-4111-8111-111111111111'
const FRESH_ID = '22222222-2222-4222-8222-222222222222'
const THREAD_ID = '33333333-3333-4333-8333-333333333333'

const EXISTING_THREAD: ChatConversationListItem = {
  id: THREAD_ID,
  type: ChatConversationType.Claim,
  title: 'MR 7167/25',
  subtitle: 'Emotive GmbH',
  claimKind: ClaimKind.Emotive,
  claimId: TALKED_ABOUT_ID,
  unreadCount: 0,
  isMuted: false,
  lastMessageAt: '2026-08-23T10:00:00.000Z',
}

/** Which registry keys name a claim. Anything else answers 200 with `null`, like the real one. */
const REGISTRY: Record<string, MrRegistryExistingClaim> = {
  '7167/25': { kind: ClaimKind.Emotive, claimId: TALKED_ABOUT_ID },
  '7089/25': { kind: ClaimKind.Emotive, claimId: FRESH_ID },
}

let posted: string[] = []
let askedKeys: string[] = []

function installFetch(): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === 'POST') {
      posted.push(url)
      return Response.json(EXISTING_THREAD, { status: 201 })
    }
    if (url.startsWith('/api/mr-registry/lookup')) {
      const mr = new URL(url, 'http://x').searchParams.get('mr') ?? ''
      askedKeys.push(mr)
      return Response.json(REGISTRY[mr] ?? null)
    }
    return Response.json({ items: [EXISTING_THREAD], unreadTotal: 0 })
  }) as unknown as typeof fetch
}

/**
 * ⚠ No default for `onOpenClaim`: a default would swallow an explicitly passed `undefined` and
 * quietly turn the "nowhere to go" case into the ordinary one — which is exactly what it did.
 */
function renderComposer(onOpenClaim: ((target: MrRegistryExistingClaim) => void) | undefined): {
  onOpenClaim: ((target: MrRegistryExistingClaim) => void) | undefined
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <Composer isThread={false} onSend={vi.fn()} onOpenClaim={onOpenClaim} />
    </QueryClientProvider>,
  )
  return { onOpenClaim }
}

function field(): HTMLElement {
  return screen.getByRole('textbox')
}

describe('the composer offers the claim whose number is being typed', () => {
  beforeEach(() => {
    setLocale('sr')
    posted = []
    askedKeys = []
    installFetch()
  })

  it('offers to open the thread a written claim already has', async () => {
    const onOpenClaim = vi.fn()
    const user = userEvent.setup()
    renderComposer(onOpenClaim)

    await user.type(field(), 'gotovo je 7167/25')

    const offer = await screen.findByRole('button', { name: /NIT POSTOJI/ })
    // The number is shown as typed — the offer has to be recognisable as the thing on screen.
    expect(screen.getByText('7167/25')).toBeInTheDocument()

    await user.click(offer)
    expect(onOpenClaim).toHaveBeenCalledWith({ kind: ClaimKind.Emotive, claimId: TALKED_ABOUT_ID })
  })

  it('says nothing about numbers that are not a claim', async () => {
    const user = userEvent.setup()
    renderComposer(vi.fn())

    // A phone number, a price, an invoice — the reason this whole offer is opt-in.
    await user.type(field(), 'javi mi na 1234 i posalji 500/25 dinara')

    // Wait for proof the pipeline RAN — `500/25` has the shape, so the server is asked and says
    // null. Asserting the absence of an offer before that would pass with the feature ripped out.
    await waitFor(() => expect(askedKeys.some((key) => key.includes('500'))).toBe(true))
    expect(screen.queryByRole('button', { name: /NIT POSTOJI/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /NAPRAVI/ })).not.toBeInTheDocument()
  })

  it('offers to make a thread that does not exist yet — and makes nothing by itself', async () => {
    const onOpenClaim = vi.fn()
    const user = userEvent.setup()
    renderComposer(onOpenClaim)

    await user.type(field(), 'pogledaj 7089/25')

    const offer = await screen.findByRole('button', { name: /NAPRAVI/ })
    await user.click(offer)

    // The offer only ASKS: the write lives behind the confirm dialog the claim number chip uses.
    expect(onOpenClaim).toHaveBeenCalledWith({ kind: ClaimKind.Emotive, claimId: FRESH_ID })
    expect(posted).toEqual([])
  })

  it('offers the number written last, not the first one in the line', async () => {
    const onOpenClaim = vi.fn()
    const user = userEvent.setup()
    renderComposer(onOpenClaim)

    await user.type(field(), 'bilo je 7167/25, sada je 7089/25')

    await user.click(await screen.findByRole('button', { name: /NAPRAVI/ }))
    expect(onOpenClaim).toHaveBeenCalledWith({ kind: ClaimKind.Emotive, claimId: FRESH_ID })
  })

  it('asks about the finished number, not about every prefix of it', async () => {
    const user = userEvent.setup()
    renderComposer(vi.fn())

    // `MR-716` is already a valid shape — the prefix rule is why the wait before asking exists.
    // Without it every keystroke past the third would spend a request against the session's
    // 120-per-minute budget, shared with the rest of the app.
    await user.type(field(), 'MR-7167')
    await waitFor(() => expect(askedKeys.length).toBeGreaterThan(0))

    expect(askedKeys).not.toContain('716')
    expect(askedKeys.filter((key) => key.includes('716') && !key.includes('7167'))).toEqual([])
  })

  it('stays quiet where there is nowhere to go — and asks the server nothing', async () => {
    const user = userEvent.setup()
    // The claim detail's „Razgovor" tab mounts the composer without a way to open another
    // conversation — the same reason the MR chip is drawn inert there.
    renderComposer(undefined)

    await user.type(field(), 'gotovo je 7167/25')

    // A wait that MUST expire. Nothing positive ever arrives here, so asserting the absence of an
    // offer straight after typing would pass with the whole feature deleted — it would simply be
    // reading the screen before the 300 ms debounce. This gives the offer four times its own wait
    // and proves the server was never asked at all.
    let asked = false
    try {
      await waitFor(() => expect(askedKeys.length).toBeGreaterThan(0), { timeout: 1_200 })
      asked = true
    } catch {
      asked = false
    }
    expect(asked).toBe(false)
    expect(screen.queryByRole('button', { name: /NIT POSTOJI/ })).not.toBeInTheDocument()
  })
})
