import { describe, expect, it } from 'vitest'

import { fillDashOffset, fuelZone, needleRotationDegrees, needleTip } from '../intake-fuel-gauge'

/**
 * The needle is animated by rotating it instead of moving its tip, which is the only way a
 * transition can apply. That is only allowed to be true if the rotation lands the tip exactly
 * where the handoff's formula does — otherwise the dial reads a different level than the number
 * printed under it, and that number goes onto the work order.
 */
function tipAfterRotation(eighths: number): { x: number; y: number } {
  const CENTER_X = 125
  const CENTER_Y = 132
  const NEEDLE_LENGTH = 78
  // The drawn needle starts at the E end and is rotated about the pivot, clockwise on screen.
  const radians = (needleRotationDegrees(eighths) * Math.PI) / 180
  const startX = CENTER_X - NEEDLE_LENGTH - CENTER_X
  const startY = CENTER_Y - CENTER_Y

  return {
    x: CENTER_X + (startX * Math.cos(radians) - startY * Math.sin(radians)),
    y: CENTER_Y + (startX * Math.sin(radians) + startY * Math.cos(radians)),
  }
}

describe('fuel needle', () => {
  it('rotates to exactly where the handoff formula puts the tip, for every eighth', () => {
    for (let eighths = 0; eighths <= 8; eighths += 1) {
      const formula = needleTip(eighths)
      const rotated = tipAfterRotation(eighths)
      expect(rotated.x).toBeCloseTo(formula.x, 6)
      expect(rotated.y).toBeCloseTo(formula.y, 6)
    }
  })

  it('sweeps a half circle end to end, empty on the left and full on the right', () => {
    expect(needleRotationDegrees(0)).toBe(0)
    expect(needleRotationDegrees(4)).toBe(90)
    expect(needleRotationDegrees(8)).toBe(180)

    expect(needleTip(0).x).toBeCloseTo(47, 6)
    expect(needleTip(4).y).toBeCloseTo(54, 6)
    expect(needleTip(8).x).toBeCloseTo(203, 6)
  })
})

describe('fuel zone', () => {
  /** The filled arc and the big digit both read from this, so the two can never disagree. */
  it('bands the level as the design sets them: reserve ≤1/8, low ≤3/8, fine above', () => {
    expect([0, 1].map(fuelZone)).toEqual(['reserve', 'reserve'])
    expect([2, 3].map(fuelZone)).toEqual(['low', 'low'])
    expect([4, 5, 6, 7, 8].map(fuelZone)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok'])
  })
})

describe('fuel fill', () => {
  /**
   * The arc is drawn by hiding the far end of one full-length stroke. An offset that does not
   * reach 0 at F would leave the dial reading under full on a full tank, which is the one value
   * the customer is most likely to check.
   */
  it('empties the whole arc at E and none of it at F, proportionally in between', () => {
    const full = fillDashOffset(0)
    expect(full).toBeGreaterThan(314)
    expect(fillDashOffset(8)).toBe(0)
    expect(fillDashOffset(4)).toBeCloseTo(full / 2, 6)
    expect(fillDashOffset(2)).toBeCloseTo(full * 0.75, 6)
  })

  it('never grows as the tank fills', () => {
    for (let eighths = 1; eighths <= 8; eighths += 1) {
      expect(fillDashOffset(eighths)).toBeLessThan(fillDashOffset(eighths - 1))
    }
  })
})
