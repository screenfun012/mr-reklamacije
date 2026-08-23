import { setLocale } from '@mr/i18n'
import { ChatConversationType, ClaimKind, type ChatConversationListItem } from '@mr/shared'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConversationList, sortChatConversations } from '../conversation-list.js'

const GENERAL: ChatConversationListItem = {
  id: 'g0000000-0000-4000-8000-000000000000',
  type: ChatConversationType.General,
  title: 'Opšti kanal',
  subtitle: '9 ČLANOVA',
  claimKind: null,
  claimId: null,
  unreadCount: 0,
  isMuted: false,
  lastMessageAt: '2026-08-23T10:00:00.000Z',
}

function thread(options: {
  id: string
  mr: string
  at: string
  unread?: number
  muted?: boolean
  kind?: ClaimKind
}): ChatConversationListItem {
  return {
    id: options.id,
    type: ChatConversationType.Claim,
    title: options.mr,
    subtitle: 'Emotive GmbH · CFFB',
    claimKind: options.kind ?? ClaimKind.Emotive,
    claimId: '99999999-9999-4999-8999-999999999999',
    unreadCount: options.unread ?? 0,
    isMuted: options.muted ?? false,
    lastMessageAt: options.at,
  }
}

/** Newest activity, but unread; oldest activity, but unread and muted. */
const NEWEST = thread({
  id: '11111111-1111-4111-8111-111111111111',
  mr: 'MR 7102/25',
  at: '2026-08-23T10:00:00.000Z',
})
const UNREAD = thread({
  id: '22222222-2222-4222-8222-222222222222',
  mr: 'MR 7167/25',
  at: '2026-08-23T09:00:00.000Z',
  unread: 2,
})
const MIDDLE = thread({
  id: '33333333-3333-4333-8333-333333333333',
  mr: 'MR 7195/25',
  at: '2026-08-23T09:30:00.000Z',
})
const MUTED = thread({
  id: '44444444-4444-4444-8444-444444444444',
  mr: 'MR 7089/25',
  at: '2026-08-23T08:00:00.000Z',
  unread: 5,
  muted: true,
  kind: ClaimKind.Domace,
})

const THREADS = [NEWEST, UNREAD, MIDDLE, MUTED]

function threadRows(): HTMLElement[] {
  return screen.getAllByRole('button').filter((element) => /^MR \d/.test(element.textContent ?? ''))
}

function mrNumbers(): string[] {
  return threadRows().map((row) => /MR \d{4}\/\d{2}/.exec(row.textContent ?? '')?.[0] ?? '')
}

describe('sortChatConversations', () => {
  it('floats unread above read, then orders by last activity', () => {
    const sorted = sortChatConversations(THREADS)

    // MUTED carries 5 unread but is muted: it shows no badge and does not count, so it must not
    // jump either — a row at the top with nothing on it reads as a bug.
    expect(sorted.map((item) => item.title)).toEqual([
      'MR 7167/25',
      'MR 7102/25',
      'MR 7195/25',
      'MR 7089/25',
    ])
  })

  it('leaves a conversation that was never spoken in at the end', () => {
    const silent = thread({
      id: '55555555-5555-4555-8555-555555555555',
      mr: 'MR 7201/25',
      at: '2026-08-23T09:00:00.000Z',
    })
    const sorted = sortChatConversations([{ ...silent, lastMessageAt: null }, MIDDLE])

    expect(sorted.map((item) => item.title)).toEqual(['MR 7195/25', 'MR 7201/25'])
  })
})

describe('ConversationList', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    localStorage.clear()
  })

  it('lists the threads unread first, newest next', () => {
    render(
      <ConversationList items={[GENERAL, ...THREADS]} activeId={GENERAL.id} onSelect={vi.fn()} />,
    )

    expect(mrNumbers()).toEqual(['MR 7167/25', 'MR 7102/25', 'MR 7195/25', 'MR 7089/25'])
  })

  it('shows the unread count on the row that has one, and on the general channel too', () => {
    render(
      <ConversationList
        items={[{ ...GENERAL, unreadCount: 4 }, ...THREADS]}
        activeId={null}
        onSelect={vi.fn()}
      />,
    )

    const unreadRow = threadRows().find((row) => row.textContent?.includes('MR 7167/25'))
    expect(within(unreadRow as HTMLElement).getByText('2')).toBeInTheDocument()

    // The prototype's fixture had no unread on a channel, so it draws none. A count the menu
    // shows and this list hides would read as broken.
    const general = screen.getByRole('button', { name: /Opšti kanal/ })
    expect(within(general).getByText('4')).toBeInTheDocument()
  })

  it('marks a muted thread and hides its count', () => {
    render(<ConversationList items={[GENERAL, ...THREADS]} activeId={null} onSelect={vi.fn()} />)

    const mutedRow = threadRows().find((row) => row.textContent?.includes('MR 7089/25'))
    expect(within(mutedRow as HTMLElement).getByText('MUTE')).toBeInTheDocument()
    expect(within(mutedRow as HTMLElement).queryByText('5')).not.toBeInTheDocument()
    expect(mutedRow).toHaveClass('opacity-[.65]')
  })

  it('lights exactly one row — the conversation you are in', () => {
    render(
      <ConversationList items={[GENERAL, ...THREADS]} activeId={UNREAD.id} onSelect={vi.fn()} />,
    )

    const current = screen
      .getAllByRole('button')
      .filter((element) => element.getAttribute('aria-current') === 'true')

    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('MR 7167/25')
  })

  it('says the threads section is empty instead of drawing nothing', () => {
    render(<ConversationList items={[GENERAL]} activeId={GENERAL.id} onSelect={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('Još nema nijedne niti.')
    expect(threadRows()).toHaveLength(0)
  })

  it('says what the search box will do rather than pretending to do it', () => {
    render(<ConversationList items={[GENERAL]} activeId={GENERAL.id} onSelect={vi.fn()} />)

    const search = screen.getByPlaceholderText('Pretraga poruka…')
    expect(search).toBeDisabled()
    expect(search).toHaveAttribute('title', 'Pretraga poruka stiže uskoro.')
  })

  it('remembers Do Not Disturb in this browser, and says that is what it means', async () => {
    const user = userEvent.setup()
    render(<ConversationList items={[GENERAL]} activeId={GENERAL.id} onSelect={vi.fn()} />)

    const dnd = screen.getByRole('button', { name: 'DND' })
    expect(dnd).toHaveAttribute(
      'title',
      'Ne uznemiravaj — pauzira popup obaveštenja. Važi samo u ovom pregledaču.',
    )

    await user.click(dnd)

    expect(dnd).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('mrr:internal:chat:dnd')).toBe('1')
  })
})
