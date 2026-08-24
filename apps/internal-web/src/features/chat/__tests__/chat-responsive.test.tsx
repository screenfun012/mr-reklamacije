import { ChatConversationType, type ChatConversationListItem } from '@mr/shared'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  CHAT_FRAME_CLASSES,
  CHAT_LIST_BACKDROP_CLASSES,
  CHAT_LIST_BREAKPOINT,
  CHAT_LIST_COLUMN_CLASSES,
  CHAT_LIST_SHEET_CLASSES,
  CHAT_LIST_TOGGLE_CLASSES,
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

function listRoot(): HTMLElement {
  // The list is the only 252px column in the tree.
  const root = screen.getByText('Opšti kanal').closest('div.w-\\[252px\\]')
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
  it('keeps the list a column only while the room is wide enough for both', () => {
    render(
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
    render(
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

  it('agrees with the panel on where the third column stops fitting', () => {
    expect(CHAT_PANEL_RESPONSIVE_CLASSES).toContain(`@min-[${CHAT_PANEL_BREAKPOINT}px]/chat:static`)
    // The panel needs the list's width plus its own, so its breakpoint must sit above the list's.
    expect(CHAT_PANEL_BREAKPOINT).toBeGreaterThan(CHAT_LIST_BREAKPOINT)
  })
})
