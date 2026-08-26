import { m } from '@mr/i18n'
import { ChatConversationType, type ChatConversationListItem } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  CHAT_FRAME_CLASSES,
  CHAT_LIST_BACKDROP_CLASSES,
  CHAT_LIST_BREAKPOINT,
  CHAT_LIST_COLUMN_CLASSES,
  CHAT_LIST_SHEET_CLASSES,
  CHAT_LIST_TOGGLE_CLASSES,
  CHAT_PANEL_BACKDROP_CLASSES,
  CHAT_PANEL_BREAKPOINT,
  CHAT_PANEL_RESPONSIVE_CLASSES,
} from '../chat-layout'
import { ConversationList } from '../conversation-list'

const GENERAL: ChatConversationListItem = {
  id: 'g0000000-0000-4000-8000-000000000000',
  type: ChatConversationType.General,
  title: 'Opšti kanal',
  subtitle: '9 ČLANOVA',
  claimKind: null,
  claimId: null,
  unreadCount: 0,
  isLocked: false,
  isMuted: false,
  lastMessageAt: '2026-08-23T10:00:00.000Z',
}

/** The list carries the push switch now, which asks the server a question — hence a client. */
function renderList(ui: React.ReactElement): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

function listRoot(): HTMLElement {
  const row = screen.getByText('Opšti kanal').closest('button')
  const root = row?.parentElement?.parentElement
  if (!(root instanceof HTMLElement)) {
    throw new Error('conversation list root not found')
  }
  return root
}

/*
 * jsdom does no layout and does not evaluate container queries, so these assert the DECLARATION
 * rather than the rendered result — deliberately, and it is the only guard there can be.
 *
 * ⚠ A `@min-[…]` that names no container, or names one nothing declares, simply never matches.
 * Nothing errors: the app just draws the narrow shape forever, on every monitor. The measured
 * proof that the switch works is the browser run of 2026-08-24 — list as a column down to a
 * 722px container at viewport 1024, as a sheet at 634 and below, and the panel over the
 * conversation from 878 down.
 */
describe('the chat gives its width to the conversation', () => {
  it('keeps 420px for the conversation beside a compact 220px list', () => {
    renderList(
      <ConversationList
        userId="u0000000-0000-4000-8000-000000000000"
        items={[GENERAL]}
        activeId={GENERAL.id}
        onSelect={vi.fn()}
        onNewThread={vi.fn()}
        onNewChannel={vi.fn()}
        onManageChannels={vi.fn()}
        open={false}
      />,
    )

    expect(listRoot()).toHaveClass('w-[220px]')
    expect(CHAT_LIST_BREAKPOINT - 220).toBe(420)
    expect(CHAT_PANEL_BREAKPOINT - 220 - 250).toBe(420)
  })

  it('draws compact sidebar controls without shrinking their 40px hit boxes', () => {
    renderList(
      <ConversationList
        userId="u0000000-0000-4000-8000-000000000000"
        items={[GENERAL]}
        activeId={GENERAL.id}
        onSelect={vi.fn()}
        onNewThread={vi.fn()}
        onNewChannel={vi.fn()}
        onManageChannels={vi.fn()}
        open={false}
      />,
    )

    for (const title of [
      m.chat_channel_manage(),
      m.chat_new_channel_title(),
      m.chat_new_thread_title(),
      m.chat_dnd_title(),
    ]) {
      const control = screen.getByTitle(title)
      expect(control).toHaveClass('size-10')
      expect(control.firstElementChild).toHaveClass('h-7')
    }
  })

  it('keeps the list a column only while the room is wide enough for both', () => {
    renderList(
      <ConversationList
        items={[GENERAL]}
        activeId={GENERAL.id}
        onSelect={vi.fn()}
        onNewThread={vi.fn()}
        open={false}
      />,
    )

    // Hidden below the breakpoint, a column above it — and BOTH halves must name the same width,
    // or there is a band where the list is neither.
    expect(listRoot().className).toContain(`@min-[${CHAT_LIST_BREAKPOINT}px]/chat:flex`)
    expect(listRoot().className).toContain('hidden')
  })

  it('lays the list over the conversation when it is out as a sheet', () => {
    renderList(
      <ConversationList
        items={[GENERAL]}
        activeId={GENERAL.id}
        onSelect={vi.fn()}
        onNewThread={vi.fn()}
        open
      />,
    )

    expect(listRoot().className).toContain('absolute')
    // ...and goes back to being a column at the same width the closed state uses.
    expect(listRoot().className).toContain(`@min-[${CHAT_LIST_BREAKPOINT}px]/chat:static`)
  })

  it('names a container the frame actually declares', () => {
    // A query naming `/chat` while nothing declares `@container/chat` never fires, and nothing
    // errors — the app just draws the narrow shape forever. These two live or die together.
    expect(CHAT_FRAME_CLASSES).toContain('@container/chat')
    // The sheets are absolutely positioned; without this they would escape to the page.
    expect(CHAT_FRAME_CLASSES).toContain('relative')
  })

  it('says the same width in every place the list is drawn', () => {
    for (const classes of [
      CHAT_LIST_COLUMN_CLASSES,
      CHAT_LIST_SHEET_CLASSES,
      CHAT_LIST_BACKDROP_CLASSES,
      CHAT_LIST_TOGGLE_CLASSES,
    ]) {
      expect(classes).toContain(`@min-[${CHAT_LIST_BREAKPOINT}px]/chat:`)
    }
  })

  /**
   * The panel needs a way out, and it is not decoration.
   *
   * Below its breakpoint it lies over the right 250px of the conversation — which is exactly where
   * the ⓘ that opened it sits. Without this, one tap on a tablet ends the conversation until the
   * page is reloaded: the toggle is underneath, the panel has no ✕, and a tablet has no Escape.
   */
  it('gives the panel a way out on exactly the widths where it covers its own toggle', () => {
    expect(CHAT_PANEL_BACKDROP_CLASSES).toContain(`@min-[${CHAT_PANEL_BREAKPOINT}px]/chat:hidden`)
    expect(CHAT_PANEL_BACKDROP_CLASSES).toContain('absolute inset-0')
    // Under the panel, over the conversation.
    expect(CHAT_PANEL_BACKDROP_CLASSES).toContain('z-10')
    expect(CHAT_PANEL_RESPONSIVE_CLASSES).toContain('z-20')
  })

  it('agrees with the panel on where the third column stops fitting', () => {
    expect(CHAT_PANEL_RESPONSIVE_CLASSES).toContain(`@min-[${CHAT_PANEL_BREAKPOINT}px]/chat:static`)
    // The panel needs the list's width plus its own, so its breakpoint must sit above the list's.
    expect(CHAT_PANEL_BREAKPOINT).toBeGreaterThan(CHAT_LIST_BREAKPOINT)
  })
})
