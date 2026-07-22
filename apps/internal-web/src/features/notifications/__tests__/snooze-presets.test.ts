import { NotificationSnoozePreset } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { resolveSnoozeUntil } from '../snooze-presets'

const FROM = new Date('2026-07-22T14:30:00')

describe('resolveSnoozeUntil', () => {
  it('adds the fixed offsets', () => {
    expect(resolveSnoozeUntil(NotificationSnoozePreset.FifteenMinutes, FROM)).toEqual(
      new Date('2026-07-22T14:45:00'),
    )
    expect(resolveSnoozeUntil(NotificationSnoozePreset.OneHour, FROM)).toEqual(
      new Date('2026-07-22T15:30:00'),
    )
    expect(resolveSnoozeUntil(NotificationSnoozePreset.ThreeHours, FROM)).toEqual(
      new Date('2026-07-22T17:30:00'),
    )
  })

  it('resolves tomorrow morning to 08:00 the next day', () => {
    expect(resolveSnoozeUntil(NotificationSnoozePreset.TomorrowMorning, FROM)).toEqual(
      new Date('2026-07-23T08:00:00'),
    )
  })

  it('rolls tomorrow morning over a month boundary', () => {
    expect(
      resolveSnoozeUntil(NotificationSnoozePreset.TomorrowMorning, new Date('2026-07-31T23:10:00')),
    ).toEqual(new Date('2026-08-01T08:00:00'))
  })

  it('always lands in the future', () => {
    for (const preset of Object.values(NotificationSnoozePreset)) {
      expect(resolveSnoozeUntil(preset, FROM).getTime()).toBeGreaterThan(FROM.getTime())
    }
  })
})
