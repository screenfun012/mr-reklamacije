import { setLocale } from '@mr/i18n'
import {
  ChatConversationType,
  ClaimKind,
  ClaimOutcome,
  type ChatConversationListItem,
  type ClaimListItem,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NewThreadDialog } from '../new-thread-dialog'

const TALKED_ABOUT_ID = '11111111-1111-4111-8111-111111111111'
const FRESH_ID = '22222222-2222-4222-8222-222222222222'
const THREAD_ID = '33333333-3333-4333-8333-333333333333'
const NEW_THREAD_ID = '44444444-4444-4444-8444-444444444444'

function emotiveClaim(
  id: string,
  mr: string,
  outcome: ClaimListItem['outcome'] = ClaimOutcome.Pending,
): ClaimListItem {
  return {
    kind: ClaimKind.Emotive,
    id,
    sequenceNumber: 1,
    claimNumber: null,
    warrantyReport: null,
    engineTypeId: '55555555-5555-4555-8555-555555555555',
    engineTypeCode: 'N47',
    manufacturerId: null,
    manufacturerName: 'BMW',
    engineCode: null,
    dateOfClaim: '2026-08-01',
    mrNumber: mr,
    dateOfFinish: null,
    employeeId: null,
    employeeName: null,
    sourceId: null,
    outcome,
    claimYear: 2026,
    customerId: null,
    customerName: 'Emotive GmbH',
    category: null,
    missingRequiredCategoryFields: [],
  }
}

const CLOSED_ID = '55555555-5555-4555-8555-555555555556'
const CLAIMS = [
  emotiveClaim(TALKED_ABOUT_ID, 'MR 7167/25'),
  emotiveClaim(FRESH_ID, '7089/25'),
  emotiveClaim(CLOSED_ID, 'MR 7000/25', ClaimOutcome.Accepted),
]

const EXISTING_THREAD: ChatConversationListItem = {
  id: THREAD_ID,
  type: ChatConversationType.Claim,
  title: 'MR 7167/25',
  subtitle: 'Emotive GmbH',
  claimKind: ClaimKind.Emotive,
  claimId: TALKED_ABOUT_ID,
  unreadCount: 0,
  isLocked: false,
  isMuted: false,
  lastMessageAt: '2026-08-23T10:00:00.000Z',
}

let requested: string[] = []
let posted: string[] = []
let created = false

function installFetch(): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === 'POST') {
      posted.push(url)
      created = true
      return Response.json(
        { ...EXISTING_THREAD, id: NEW_THREAD_ID, claimId: FRESH_ID },
        {
          status: 201,
        },
      )
    }
    requested.push(url)
    if (url.startsWith('/api/claims')) {
      const pendingOnly = new URL(url, 'http://x').searchParams.get('outcome') === 'pending'
      const items = pendingOnly
        ? CLAIMS.filter((claim) => claim.outcome === ClaimOutcome.Pending)
        : CLAIMS
      return Response.json({ items, total: items.length, page: 1, pageSize: 10 })
    }
    return Response.json({
      items: [
        EXISTING_THREAD,
        ...(created ? [{ ...EXISTING_THREAD, id: NEW_THREAD_ID, claimId: FRESH_ID }] : []),
      ],
      unreadTotal: 0,
    })
  }) as unknown as typeof fetch
}

function renderDialog(onOpened = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <NewThreadDialog
        open
        onOpenChange={vi.fn()}
        conversations={[EXISTING_THREAD]}
        onOpened={onOpened}
        onClosed={vi.fn()}
      />
    </QueryClientProvider>,
  )
  return { onOpened }
}

function row(mr: string): Promise<HTMLElement> {
  return screen.findByRole('button', { name: new RegExp(mr) })
}

describe('NewThreadDialog', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    requested = []
    posted = []
    created = false
    installFetch()
  })

  it('says which claims already have a thread and which do not', async () => {
    renderDialog()

    // The one already talked about is entered, never created twice — "1 claim = 1 thread".
    expect(within(await row('MR 7167/25')).getByText(/nit postoji/i)).toBeInTheDocument()
    expect(within(await row('7089/25')).getByText(/napravi/i)).toBeInTheDocument()
  })

  it('asks the server only for pending claims, so closed claims are never offered', async () => {
    renderDialog()

    await row('MR 7167/25')

    expect(
      requested.some((url) => new URL(url, 'http://x').searchParams.get('outcome') === 'pending'),
    ).toBe(true)
    expect(screen.queryByRole('button', { name: /MR 7000\/25/ })).not.toBeInTheDocument()
  })

  it('opens an existing thread without making anything', async () => {
    const { onOpened } = renderDialog()

    await userEvent.click(await row('MR 7167/25'))

    expect(onOpened).toHaveBeenCalledWith(THREAD_ID)
    expect(posted).toEqual([])
  })

  it('creates the thread for a claim that has none, then opens it', async () => {
    const { onOpened } = renderDialog()

    await userEvent.click(await row('7089/25'))

    await waitFor(() => {
      expect(posted).toEqual([`/api/chat/claims/emotive/${FRESH_ID}/thread`])
    })
    await waitFor(() => {
      expect(onOpened).toHaveBeenCalledWith(NEW_THREAD_ID)
    })
  })

  it('searches on the server, so a match on page four is still findable', async () => {
    renderDialog()
    await row('MR 7167/25')

    await userEvent.type(screen.getByRole('searchbox'), '7089')

    await waitFor(() => {
      expect(requested.some((url) => url.includes('search=7089'))).toBe(true)
    })
  })
})
