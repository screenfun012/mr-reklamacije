import { NotificationEntityType, NotificationType, type NotificationItem } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { popupIsSilenced } from '../notification-popups'

function item(type: NotificationType): NotificationItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    type,
    entityType:
      type === NotificationType.ChatMention
        ? NotificationEntityType.ChatMessage
        : NotificationEntityType.EmotiveClaim,
    entityId: '22222222-2222-4222-8222-222222222222',
    isRead: false,
    snoozedUntil: null,
    createdAt: '2026-08-23T10:00:00.000Z',
    data: {},
  }
}

describe('„Ne uznemiravaj"', () => {
  it('keeps a chat mention off the screen', () => {
    expect(popupIsSilenced(item(NotificationType.ChatMention), true)).toBe(true)
  })

  it('lets it through when the switch is off', () => {
    expect(popupIsSilenced(item(NotificationType.ChatMention), false)).toBe(false)
  })

  it('never silences anything but chat — a claim outcome is not muted by being busy', () => {
    expect(popupIsSilenced(item(NotificationType.OutcomeChanged), true)).toBe(false)
    expect(popupIsSilenced(item(NotificationType.NewSubmission), true)).toBe(false)
    expect(popupIsSilenced(item(NotificationType.AssignedToMe), true)).toBe(false)
  })
})
