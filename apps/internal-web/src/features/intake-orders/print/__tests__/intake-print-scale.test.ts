import { describe, expect, it } from 'vitest'

import { INTAKE_PRINT_SHEET_WIDTH_PX, intakePrintScale } from '../intake-print-scale.js'

/**
 * jsdom has no layout, so nothing here pretends to measure a pixel. What it pins is the ARITHMETIC
 * the measured width goes through — the real widths were measured in Chromium and WebKit on
 * 2026-08-11 and are quoted where they matter.
 */
describe('intakePrintScale', () => {
  it('fits the paper into the width it was actually given', () => {
    // 342 = a 390px phone minus the dialog's 24px padding on each side. Both engines reported
    // exactly that, and at scale 1 the sheet's left edge sat at -202px where no scroll could reach it.
    expect(intakePrintScale(342)).toBeCloseTo(342 / INTAKE_PRINT_SHEET_WIDTH_PX, 10)
  })

  it('reads the width rather than a breakpoint, so two widths give two scales', () => {
    // The assertion that says "measured": a constant, a device branch or a table of rounded steps
    // would all satisfy the rest of this suite and fail here.
    expect(intakePrintScale(342)).not.toBe(intakePrintScale(390))
    expect(intakePrintScale(500)).toBeLessThan(intakePrintScale(600))
  })

  it('never magnifies the paper past its real size', () => {
    // A4 is a physical size. Above 1 the preview would promise a page no printer produces.
    expect(intakePrintScale(INTAKE_PRINT_SHEET_WIDTH_PX)).toBe(1)
    expect(intakePrintScale(INTAKE_PRINT_SHEET_WIDTH_PX + 1)).toBe(1)
    expect(intakePrintScale(1440)).toBe(1)
  })

  it('draws the paper full size before anything has been measured', () => {
    // The first paint, and SSR, which never renders this dialog open — also the desktop case, which
    // needs no scaling at all.
    expect(intakePrintScale(0)).toBe(1)
    expect(intakePrintScale(-10)).toBe(1)
  })
})
