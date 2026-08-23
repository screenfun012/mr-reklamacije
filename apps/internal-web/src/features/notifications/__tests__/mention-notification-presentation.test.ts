import { setLocale } from '@mr/i18n'
import { NotificationEntityType, NotificationType, type NotificationItem } from '@mr/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  notificationEyebrow,
  notificationTarget,
  notificationTitle,
} from '../notification-presentation'

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111'
const MESSAGE_ID = '22222222-2222-4222-8222-222222222222'

function mention(data: Partial<NotificationItem['data']> = {}): NotificationItem {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    type: NotificationType.ChatMention,
    entityType: NotificationEntityType.ChatMessage,
    entityId: MESSAGE_ID,
    isRead: false,
    snoozedUntil: null,
    createdAt: '2026-08-23T10:00:00.000Z',
    data: {
      authorName: 'Marko Marković',
      conversationId: CONVERSATION_ID,
      conversationTitle: 'MR 7167/25',
      excerpt: '@Ana pogledaj nalaz',
      ...data,
    },
  }
}

describe('a mention on the bell', () => {
  beforeEach(() => setLocale('sr'))

  it('names the person who wrote it', () => {
    // The handoff asks for exactly this (§7): the eyebrow says who, not what kind of row it is.
    expect(notificationEyebrow(mention())).toContain('Marko Marković')
  })

  it('says where it happened and repeats the words', () => {
    const title = notificationTitle(mention())

    expect(title).toContain('MR 7167/25')
    expect(title).toContain('@Ana pogledaj nalaz')
  })

  it('opens the room, not the message — a message id addresses nothing on screen', () => {
    expect(notificationTarget(mention())).toEqual({
      to: '/razgovori',
      search: { razgovor: CONVERSATION_ID },
    })
  })

  it('opens nothing rather than a broken link when the room is missing from the row', () => {
    expect(notificationTarget(mention({ conversationId: null }))).toBeNull()
  })

  it('degrades to a dash instead of blowing up when the author is missing', () => {
    // Every other title in this file does the same — a notification is never worth a crash.
    expect(() => notificationEyebrow(mention({ authorName: null }))).not.toThrow()
  })
})
