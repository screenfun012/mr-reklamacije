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

import { ClaimThreadConfirm, findClaimThread } from '../open-claim-thread'

const CLAIM_ID = '99999999-9999-4999-8999-999999999999'
const OTHER_CLAIM_ID = '88888888-8888-4888-8888-888888888888'
const TARGET: MrRegistryExistingClaim = { kind: ClaimKind.Emotive, claimId: CLAIM_ID }

const THREAD: ChatConversationListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  type: ChatConversationType.Claim,
  title: 'MR 7167/25',
  subtitle: 'Emotive GmbH · N47',
  claimKind: ClaimKind.Emotive,
  claimId: CLAIM_ID,
  unreadCount: 0,
  isLocked: false,
  isMuted: false,
  lastMessageAt: '2026-08-23T10:00:00.000Z',
}

const GENERAL: ChatConversationListItem = {
  ...THREAD,
  id: '00000000-0000-4000-8000-000000000000',
  type: ChatConversationType.General,
  title: 'Opšti kanal',
  claimKind: null,
  claimId: null,
}

let posted: string[] = []
let postFails = false

function installFetch(): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === 'POST') {
      posted.push(url)
      if (postFails) {
        return new Response(JSON.stringify({ message: 'nope' }), { status: 500 })
      }
      return Response.json(THREAD, { status: 201 })
    }
    return Response.json({ items: [GENERAL, THREAD], unreadTotal: 0 })
  }) as unknown as typeof fetch
}

function renderConfirm(onOpened = vi.fn(), onCancel = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ClaimThreadConfirm target={TARGET} onCancel={onCancel} onOpened={onOpened} />
    </QueryClientProvider>,
  )
  return { onOpened, onCancel }
}

describe('findClaimThread', () => {
  it('finds the thread a claim already has', () => {
    expect(findClaimThread([GENERAL, THREAD], CLAIM_ID)).toBe(THREAD)
  })

  it('finds nothing for a claim nobody has talked about', () => {
    expect(findClaimThread([GENERAL, THREAD], OTHER_CLAIM_ID)).toBeNull()
  })
})

describe('ClaimThreadConfirm', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    posted = []
    postFails = false
    installFetch()
  })

  it('asks before making anything — the dialog alone creates no thread', async () => {
    renderConfirm()

    expect(await screen.findByRole('button', { name: /napravi nit/i })).toBeInTheDocument()
    expect(posted).toEqual([])
  })

  it('creates the thread on confirm and opens what came back', async () => {
    const { onOpened } = renderConfirm()

    await userEvent.click(await screen.findByRole('button', { name: /napravi nit/i }))

    await waitFor(() => {
      expect(posted).toEqual([`/api/chat/claims/emotive/${CLAIM_ID}/thread`])
    })
    await waitFor(() => {
      expect(onOpened).toHaveBeenCalledWith(THREAD.id)
    })
  })

  it('makes nothing when the person backs out', async () => {
    const { onCancel, onOpened } = renderConfirm()

    await userEvent.click(await screen.findByRole('button', { name: /otkaži|odustani/i }))

    expect(onCancel).toHaveBeenCalled()
    expect(onOpened).not.toHaveBeenCalled()
    expect(posted).toEqual([])
  })

  it('does not open a thread the server refused to make', async () => {
    postFails = true
    const { onOpened } = renderConfirm()

    await userEvent.click(await screen.findByRole('button', { name: /napravi nit/i }))

    await waitFor(() => {
      expect(posted).toHaveLength(1)
    })
    expect(onOpened).not.toHaveBeenCalled()
  })
})
