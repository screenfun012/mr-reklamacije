import { describe, expect, it } from 'vitest'

import { intakePrintScale } from '../intake-print-scale.js'
import {
  INTAKE_PRINT_MAX_SCALE,
  clampIntakePrintPan,
  clampIntakePrintScale,
  intakeAnchoredScroll,
  intakeDoubleTapScale,
  intakePinchScale,
  intakeTapOf,
  isIntakeDoubleTap,
  pointerGap,
  pointerMidpoint,
} from '../intake-print-zoom.js'

/**
 * jsdom has no layout and cannot dispatch a pinch, so nothing here pretends to measure a pixel or a
 * gesture: what is pinned is the arithmetic every gesture goes through. The layout half — that a
 * magnified sheet stays reachable and that print is still 794×1123 — was measured in Chromium and
 * WebKit on 2026-08-12 and is quoted where it matters.
 *
 * 0.4307 is the real fit scale of a 390px phone: (390 − 2×24 padding) / 794, measured in both engines.
 */
const PHONE_FIT = intakePrintScale(342)

describe('pointerGap / pointerMidpoint', () => {
  it('measures the gap between two fingers and the point between them', () => {
    expect(pointerGap({ x: 0, y: 0 }, { x: 30, y: 40 })).toBe(50)
    expect(pointerMidpoint({ x: 0, y: 0 }, { x: 30, y: 40 })).toEqual({ x: 15, y: 20 })
  })
})

describe('clampIntakePrintScale', () => {
  it('treats the fit scale as the floor, because below it the paper is smaller than its room', () => {
    expect(clampIntakePrintScale(0.1, PHONE_FIT)).toBe(PHONE_FIT)
    expect(clampIntakePrintScale(PHONE_FIT, PHONE_FIT)).toBe(PHONE_FIT)
  })

  it('lets the operator reach 1:1, which is the size the printer produces', () => {
    // The whole point of the feature: the body text on the sheet is 11.5px, so at the phone's fit
    // scale it draws at about 5px — that is what the owner asked about.
    expect(INTAKE_PRINT_MAX_SCALE).toBeGreaterThanOrEqual(1)
    expect(clampIntakePrintScale(1, PHONE_FIT)).toBe(1)
  })

  it('stops at the chosen ceiling however far the fingers travel', () => {
    expect(clampIntakePrintScale(9, PHONE_FIT)).toBe(INTAKE_PRINT_MAX_SCALE)
    expect(clampIntakePrintScale(INTAKE_PRINT_MAX_SCALE + 0.01, PHONE_FIT)).toBe(
      INTAKE_PRINT_MAX_SCALE,
    )
  })

  it('falls back to the floor for a degenerate pinch instead of painting nothing', () => {
    // Two pointers reported on the same pixel make the gap ratio Infinity or NaN. A NaN in the custom
    // property is not a small scale — `scale(NaN)` draws no paper at all, with nothing on screen to
    // explain it.
    expect(clampIntakePrintScale(Number.NaN, PHONE_FIT)).toBe(PHONE_FIT)
    expect(clampIntakePrintScale(Number.POSITIVE_INFINITY, PHONE_FIT)).toBe(PHONE_FIT)
  })
})

describe('intakePinchScale', () => {
  it('scales by the ratio the fingers moved, from the scale the pinch started at', () => {
    expect(
      intakePinchScale({ startScale: 0.5, startGap: 100, gap: 150, fitScale: PHONE_FIT }),
    ).toBeCloseTo(0.75, 10)
    expect(
      intakePinchScale({ startScale: 1, startGap: 200, gap: 100, fitScale: PHONE_FIT }),
    ).toBeCloseTo(0.5, 10)
  })

  it('reads the gap rather than a step, so two gaps give two scales', () => {
    // The assertion that says "continuous": a table of zoom steps would satisfy the rest of this
    // block and fail here.
    const at = (gap: number): number =>
      intakePinchScale({ startScale: 0.5, startGap: 100, gap, fitScale: PHONE_FIT })
    expect(at(101)).not.toBe(at(102))
  })

  it('clamps both ends, so fingers can neither shrink the paper below its room nor blow it up', () => {
    expect(intakePinchScale({ startScale: 1, startGap: 400, gap: 20, fitScale: PHONE_FIT })).toBe(
      PHONE_FIT,
    )
    expect(intakePinchScale({ startScale: 1, startGap: 20, gap: 400, fitScale: PHONE_FIT })).toBe(
      INTAKE_PRINT_MAX_SCALE,
    )
    expect(intakePinchScale({ startScale: 1, startGap: 0, gap: 40, fitScale: PHONE_FIT })).toBe(
      PHONE_FIT,
    )
  })
})

describe('intakeDoubleTapScale', () => {
  it('toggles between the fit and the paper’s real size', () => {
    expect(intakeDoubleTapScale(PHONE_FIT, PHONE_FIT)).toBe(1)
    expect(intakeDoubleTapScale(1, PHONE_FIT)).toBe(PHONE_FIT)
  })

  it('returns to the fit from any magnification, not to the one before it', () => {
    // Whatever the fingers left behind, the way out is one gesture: the whole page, in view.
    expect(intakeDoubleTapScale(INTAKE_PRINT_MAX_SCALE, PHONE_FIT)).toBe(PHONE_FIT)
    expect(intakeDoubleTapScale(0.7, PHONE_FIT)).toBe(PHONE_FIT)
  })

  it('is a no-op on a desktop, where the paper already fits at 1:1', () => {
    expect(intakeDoubleTapScale(1, 1)).toBe(1)
  })
})

describe('clampIntakePrintScale — a rotation under a zoom in flight', () => {
  /**
   * The fit scale is re-measured on rotation and resize, and it is the FLOOR: a magnification that is
   * still above the new floor is kept, because a serviser reading the fine print must not be thrown
   * back to unreadable by turning the tablet — while one that has fallen below it stops being applied
   * the moment it would draw the paper smaller than the room it now has.
   */
  it('keeps a magnification the new floor is still under, and lifts one it has passed', () => {
    const landscape = intakePrintScale(700)

    expect(clampIntakePrintScale(1, landscape)).toBe(1)
    expect(clampIntakePrintScale(0.6, landscape)).toBe(landscape)
    // …and back to portrait: the floor drops again, and the number the fingers asked for is intact.
    expect(clampIntakePrintScale(0.6, PHONE_FIT)).toBe(0.6)
  })
})

describe('clampIntakePrintPan', () => {
  it('cannot pan an axis with nothing to pan', () => {
    // The horizontal axis at the fit scale: the paper is exactly as wide as its room.
    expect(clampIntakePrintPan(120, 342, 342)).toBe(0)
    expect(clampIntakePrintPan(-120, 342, 342)).toBe(0)
    expect(clampIntakePrintPan(120, 100, 342)).toBe(0)
  })

  it('keeps the paper inside the box at both ends', () => {
    // A 390px phone at 2×: the box holds 1588 + 48 of padding, and the room is 390.
    expect(clampIntakePrintPan(-1, 1636, 390)).toBe(0)
    expect(clampIntakePrintPan(600, 1636, 390)).toBe(600)
    expect(clampIntakePrintPan(9999, 1636, 390)).toBe(1636 - 390)
  })
})

describe('intakeAnchoredScroll', () => {
  /**
   * The property that makes a pinch feel like paper: the point under the fingers does not move. The
   * numbers are the phone case — the sheet drawn at the dialog's 24px padding, fingers 200px in from
   * the box's left edge, zoomed from the fit scale to 1:1.
   */
  it('leaves the point under the fingers where it was', () => {
    const focal = 200
    const sheetStart = 24
    const paperPoint = (focal - sheetStart) / PHONE_FIT

    const scroll = intakeAnchoredScroll({
      scroll: 0,
      sheetStart,
      paperPoint,
      scale: 1,
      focal,
      contentPx: 842,
      viewportPx: 390,
    })

    // Where that point of the paper is drawn after the scroll — the same 200px from the edge.
    expect(sheetStart + paperPoint * 1 - scroll).toBeCloseTo(focal, 6)
  })

  it('holds the anchor when the box is already scrolled', () => {
    const focal = 120
    const sheetStart = -300
    const paperPoint = 500

    const scroll = intakeAnchoredScroll({
      scroll: 700,
      sheetStart,
      paperPoint,
      scale: 1,
      focal,
      contentPx: 1636,
      viewportPx: 390,
    })

    expect(scroll).toBe(700 + sheetStart + paperPoint - focal)
  })

  it('never asks for an offset the box does not have', () => {
    // Zooming out at the far edge: the anchor would pull the scroll past the end of the content, and
    // the paper would be dragged off screen with no way back.
    expect(
      intakeAnchoredScroll({
        scroll: 0,
        sheetStart: 24,
        paperPoint: 0,
        scale: 1,
        focal: 380,
        contentPx: 842,
        viewportPx: 390,
      }),
    ).toBe(0)
    expect(
      intakeAnchoredScroll({
        scroll: 400,
        sheetStart: 24,
        paperPoint: 1123,
        scale: 2,
        focal: 10,
        contentPx: 842,
        viewportPx: 390,
      }),
    ).toBe(842 - 390)
  })
})

describe('intakeTapOf', () => {
  it('is a tap when the finger neither travelled nor stayed', () => {
    expect(intakeTapOf({ x: 100, y: 100, at: 1000 }, { x: 104, y: 103, at: 1090 })).toEqual({
      x: 104,
      y: 103,
      at: 1090,
    })
  })

  it('is not a tap when the finger dragged — a pan must never read as a zoom', () => {
    expect(intakeTapOf({ x: 100, y: 100, at: 1000 }, { x: 100, y: 140, at: 1090 })).toBeNull()
  })

  it('is not a tap when the finger rested on the paper', () => {
    expect(intakeTapOf({ x: 100, y: 100, at: 1000 }, { x: 100, y: 100, at: 1400 })).toBeNull()
  })
})

describe('isIntakeDoubleTap', () => {
  it('needs a first tap', () => {
    expect(isIntakeDoubleTap(null, { x: 10, y: 10, at: 1000 })).toBe(false)
  })

  it('accepts a second tap that arrives soon and near', () => {
    expect(isIntakeDoubleTap({ x: 10, y: 10, at: 1000 }, { x: 14, y: 12, at: 1200 })).toBe(true)
  })

  it('refuses two taps too far apart in time or in place', () => {
    expect(isIntakeDoubleTap({ x: 10, y: 10, at: 1000 }, { x: 10, y: 10, at: 1500 })).toBe(false)
    expect(isIntakeDoubleTap({ x: 10, y: 10, at: 1000 }, { x: 90, y: 10, at: 1100 })).toBe(false)
  })
})
