import { describe, expect, it } from 'vitest'

import {
  resolveManufacturerColor,
  STATISTICS_MANUFACTURER_OTHERS_CODE,
  STATISTICS_UNKNOWN_MANUFACTURER_CODE,
} from '../statistics-manufacturer-colors.js'

describe('resolveManufacturerColor', () => {
  it('returns fixed BMW blue', () => {
    expect(resolveManufacturerColor('BMW')).toEqual({
      fill: 'var(--color-mr-info)',
      fillStrong: 'var(--color-mr-info-strong)',
    })
  })

  it('returns neutral gray for unknown manufacturer bucket', () => {
    expect(resolveManufacturerColor(STATISTICS_UNKNOWN_MANUFACTURER_CODE).fill).toBe(
      'var(--color-mr-neutral-400)',
    )
  })

  it('returns darker neutral for others roll-up bucket', () => {
    expect(resolveManufacturerColor(STATISTICS_MANUFACTURER_OTHERS_CODE).fill).toBe(
      'var(--color-mr-neutral-500)',
    )
  })

  it('cycles fallback colors for unmapped catalog codes', () => {
    const first = resolveManufacturerColor('IVECO', 0)
    const second = resolveManufacturerColor('IVECO', 1)

    expect(first.fill).not.toBe(second.fill)
    expect(resolveManufacturerColor('IVECO', 0)).toEqual(first)
  })
})
