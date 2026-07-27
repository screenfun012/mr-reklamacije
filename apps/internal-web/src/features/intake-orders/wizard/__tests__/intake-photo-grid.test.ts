import { IntakeDamageType, type IntakeDamage, type IntakeOrderPhoto } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { buildPhotoCells } from '../intake-photo-grid.js'
import type { IntakePhotoQueueEntry } from '../use-intake-photo-queue.js'

const DAMAGES: IntakeDamage[] = [
  { id: 'd1', type: IntakeDamageType.Scratch, x: 100, y: 60, zone: 'zadnja vrata' },
  { id: 'd2', type: IntakeDamageType.Dent, x: 40, y: 300, zone: 'leva bočna strana' },
]

function serverPhoto(id: string, damageId: string | null): IntakeOrderPhoto {
  return {
    id,
    damageId,
    fileName: `${id}.jpg`,
    caption: null,
    createdAt: '2026-07-27T09:00:00.000Z',
  } as unknown as IntakeOrderPhoto
}

function entry(overrides: Partial<IntakePhotoQueueEntry> = {}): IntakePhotoQueueEntry {
  return {
    id: 'q1',
    damageId: null,
    state: 'up',
    progress: 40,
    previewUrl: 'blob:local',
    attachmentId: null,
    ...overrides,
  }
}

describe('buildPhotoCells', () => {
  it('numbers a photo by its damage position, which is what the map and the list show', () => {
    const cells = buildPhotoCells('o1', [serverPhoto('a', 'd2')], [], DAMAGES)

    expect(cells).toHaveLength(1)
    expect(cells[0]?.number).toBe(2)
    expect(cells[0]?.numberColour?.fill).toBe('var(--mri-amb)')
  })

  it('leaves a photo unnumbered when its damage was removed, rather than losing the photo', () => {
    const cells = buildPhotoCells('o1', [serverPhoto('a', 'gone')], [], DAMAGES)

    expect(cells).toHaveLength(1)
    expect(cells[0]?.number).toBeNull()
    expect(cells[0]?.numberColour).toBeNull()
  })

  it('shows a general photo with no number at all', () => {
    const cells = buildPhotoCells('o1', [serverPhoto('a', null)], [], DAMAGES)

    expect(cells[0]?.number).toBeNull()
  })

  /**
   * Between an upload landing and the detail query refetching, the same photo exists twice: as a
   * finished queue entry and as a server row. Showing both would make the grid appear to double
   * every photo for a second.
   */
  it('drops the queue entry once the server has the photo it produced', () => {
    const cells = buildPhotoCells(
      'o1',
      [serverPhoto('a', 'd1')],
      [entry({ id: 'q1', state: 'ok', attachmentId: 'a' })],
      DAMAGES,
    )

    expect(cells).toHaveLength(1)
    expect(cells[0]?.attachmentId).toBe('a')
    expect(cells[0]?.entryId).toBeNull()
  })

  it('keeps an in-flight entry that the server has not seen yet, with its own preview', () => {
    const cells = buildPhotoCells('o1', [], [entry({ state: 'wait', damageId: 'd1' })], DAMAGES)

    expect(cells).toHaveLength(1)
    expect(cells[0]?.state).toBe('wait')
    expect(cells[0]?.url).toBe('blob:local')
    expect(cells[0]?.number).toBe(1)
    expect(cells[0]?.entryId).toBe('q1')
  })

  it('asks the server for thumbnails, never the full image, for the grid', () => {
    const cells = buildPhotoCells('o1', [serverPhoto('a', null)], [], DAMAGES)

    expect(cells[0]?.url).toBe('/api/intake-orders/o1/photos/a?variant=thumbnail')
  })
})
