import { m, setLocale } from '@mr/i18n'
import { ClaimKind, type MrRegistryExistingClaim } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MessageBody } from '../message-body'
import { useResolveClaimThread } from '../open-claim-thread'

const CLAIM: MrRegistryExistingClaim = {
  kind: ClaimKind.Emotive,
  claimId: '99999999-9999-4999-8999-999999999999',
}

function resolutions(entries: Array<[string, MrRegistryExistingClaim]>) {
  return new Map(entries)
}

describe('MessageBody', () => {
  it('resolves a sent closed MR only on click and opens its claim without a POST', async () => {
    const requests: Array<{ url: string; method: string }> = []
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), method: init?.method ?? 'GET' })
      return Response.json({
        conversation: {
          id: '11111111-1111-4111-8111-111111111111',
          type: 'claim',
          title: '7167/25',
          subtitle: 'Auto Stanić',
          claimKind: ClaimKind.Emotive,
          claimId: CLAIM.claimId,
          unreadCount: 0,
          isLocked: true,
          isMuted: false,
          lastMessageAt: null,
        },
        canCreateThread: false,
      })
    }) as unknown as typeof fetch
    const onActive = vi.fn()
    const onMissing = vi.fn()
    const onClosed = vi.fn()

    function SentMessage(): React.ReactElement {
      const resolve = useResolveClaimThread({ onActive, onMissing, onClosed })
      return (
        <MessageBody
          body="Stigao motor 7167/25 jutros"
          resolutions={resolutions([['7167/25', CLAIM]])}
          onOpenClaim={(target) => resolve.mutate(target)}
        />
      )
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <SentMessage />
      </QueryClientProvider>,
    )

    expect(requests).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: '7167/25' }))

    await waitFor(() => expect(onClosed).toHaveBeenCalledWith(CLAIM))
    expect(onActive).not.toHaveBeenCalled()
    expect(onMissing).not.toHaveBeenCalled()
    expect(requests).toEqual([
      {
        url: `/api/chat/claims/${ClaimKind.Emotive}/${CLAIM.claimId}/thread`,
        method: 'GET',
      },
    ])
  })

  it('turns a resolved MR number into a chip that opens its claim', async () => {
    const onOpenClaim = vi.fn()
    render(
      <MessageBody
        body="Stigao motor 7167/25 jutros"
        resolutions={resolutions([['7167/25', CLAIM]])}
        onOpenClaim={onOpenClaim}
      />,
    )

    const chip = screen.getByRole('button', { name: '7167/25' })
    await userEvent.click(chip)

    expect(onOpenClaim).toHaveBeenCalledWith(CLAIM)
  })

  it('resolves through the prefix-stripped key when the literal one is unknown', async () => {
    const onOpenClaim = vi.fn()
    render(
      <MessageBody
        body="Vidi MR 7167/25"
        // The registry holds the number as it was typed years ago — without the prefix.
        resolutions={resolutions([['7167/25', CLAIM]])}
        onOpenClaim={onOpenClaim}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'MR 7167/25' }))

    expect(onOpenClaim).toHaveBeenCalledWith(CLAIM)
  })

  it('leaves an unresolved number as plain text', () => {
    render(<MessageBody body="Nema motora 1111/11" resolutions={resolutions([])} />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Nema motora 1111/11')).toBeInTheDocument()
  })

  it('keeps the words around the number, and every line break in them', () => {
    const { container } = render(
      <MessageBody
        body={'Prvi red\nStigao motor 7167/25 jutros'}
        resolutions={resolutions([['7167/25', CLAIM]])}
      />,
    )

    // The text is stored raw and linkified at render — nothing may be lost on the way, the line
    // break included: a message typed on two lines that arrives as one is a different message.
    expect(container.textContent).toBe('Prvi red\nStigao motor 7167/25 jutros')
  })

  it('draws the prototype blue chip, and never a button without a handler', () => {
    render(<MessageBody body="Motor 7167/25" resolutions={resolutions([['7167/25', CLAIM]])} />)

    const chip = screen.getByText('7167/25')
    expect(chip.tagName).toBe('SPAN')
    expect(chip).toHaveClass('bg-mri-info-bg')
    expect(chip).toHaveClass('text-mri-info')
  })
})

describe('a mention in a message', () => {
  beforeEach(() => setLocale('sr'))

  const ANA_ID = 'a1a1a1a1-1111-4111-8111-aaaaaaaaaaaa'

  it('draws the name the server gave, not the one that was typed', () => {
    render(
      <MessageBody
        body={`zdravo @[Staro Ime](${ANA_ID})`}
        resolutions={new Map()}
        mentions={[{ id: ANA_ID, name: 'Ana Anić' }]}
      />,
    )

    expect(screen.getByText('@Ana Anić')).toBeInTheDocument()
    expect(screen.queryByText(/Staro Ime/)).not.toBeInTheDocument()
  })

  it('names @svi on the screen, because the server does not write Serbian', () => {
    render(
      <MessageBody
        body="@[svi](all) hitno"
        resolutions={new Map()}
        mentions={[{ id: 'all', name: null }]}
      />,
    )

    expect(screen.getByText(`@${m.chat_mention_everyone()}`)).toBeInTheDocument()
  })

  it('draws an id that names nobody live as WORDS, never as a chip', () => {
    // A chip pointing at nobody looks exactly like a link to a real person, and these messages are
    // evidence for a claim. So a colleague who has left — or an address somebody typed by hand —
    // reads as the words that were written.
    const { container } = render(
      <MessageBody
        body={`hvala @[Bivši Kolega](${ANA_ID})`}
        resolutions={new Map()}
        mentions={[{ id: ANA_ID, name: null }]}
      />,
    )

    expect(screen.getByText('@Bivši Kolega')).toBeInTheDocument()
    expect(container.querySelector('.text-mri-redh')).toBeNull()
  })

  it('draws an MR number and a mention in one sentence, each in its place', () => {
    const claim = { kind: ClaimKind.Emotive, claimId: 'c1c1c1c1-1111-4111-8111-cccccccccccc' }
    render(
      <MessageBody
        body={`@[Ana](${ANA_ID}) pogledaj 7167/25 danas`}
        resolutions={new Map([['7167/25', claim]])}
        mentions={[{ id: ANA_ID, name: 'Ana Anić' }]}
      />,
    )

    expect(screen.getByText('@Ana Anić')).toBeInTheDocument()
    expect(screen.getByText('7167/25')).toBeInTheDocument()
    expect(screen.getByText(/pogledaj/)).toBeInTheDocument()
  })
})
