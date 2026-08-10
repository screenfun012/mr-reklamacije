import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  IntakeSignaturePad,
  SIGNATURE_PAD_HEIGHT,
  SIGNATURE_PAD_WIDTH,
  isSignatureFilled,
  signatureStrokesToPath,
  type SignatureStrokes,
} from '../intake-signature-pad.js'

const stroke = (points: number): [number, number][] =>
  Array.from({ length: points }, (_, index) => [index * 10, index * 5] as [number, number])

describe('isSignatureFilled', () => {
  /**
   * The gate a whole legal document hangs on. A tap while handing the tablet over, or a thumb
   * brushing the edge, must not count as the customer having signed.
   */
  it('refuses a tap and a two-point flick, accepts the shortest real scribble', () => {
    expect(isSignatureFilled([])).toBe(false)
    expect(isSignatureFilled([stroke(1)])).toBe(false)
    expect(isSignatureFilled([stroke(2)])).toBe(false)
    expect(isSignatureFilled([stroke(3)])).toBe(true)
  })

  it('accepts a signature made of several strokes even when some are stray taps', () => {
    expect(isSignatureFilled([stroke(1), stroke(9)])).toBe(true)
  })
})

describe('signatureStrokesToPath', () => {
  it('writes one move-to per stroke, so lifting the finger does not join two letters', () => {
    const strokes: SignatureStrokes = [
      [
        [0, 0],
        [10, 20],
      ],
      [
        [30, 40],
        [50, 60],
      ],
    ]

    expect(signatureStrokesToPath(strokes)).toBe('M0.0 0.0 L10.0 20.0 M30.0 40.0 L50.0 60.0')
  })

  it('is empty for no strokes, which is what the "not signed" state sends nowhere', () => {
    expect(signatureStrokesToPath([])).toBe('')
  })

  it('drops empty strokes rather than emitting a bare M', () => {
    expect(signatureStrokesToPath([[], [[1, 2]]])).toBe('M1.0 2.0')
  })

  /**
   * The path is stored once and printed on A4 from the same string, so it has to stay inside the
   * declared box — and it has to stay small enough for the wire, which caps at 100k characters.
   */
  it('keeps a long signature well inside the wire limit', () => {
    const long: SignatureStrokes = [stroke(400), stroke(400)]
    const path = signatureStrokesToPath(long)

    expect(path.length).toBeLessThan(100_000)
    expect(SIGNATURE_PAD_WIDTH).toBe(460)
    expect(SIGNATURE_PAD_HEIGHT).toBe(200)
  })
})

/*
 * jsdom has no layout, so this pins the DECISION, not the pixels. Measured in the browser
 * 2026-08-10: the drawing surface was 2px tall — the height of its own border. It took `flex-1`
 * inside a chain whose only height promise was an `h-full` resolving against a parent with no
 * definite height, so there was nothing left to take. Points still landed (the `rect.height === 0`
 * guard reads 2, not 0), which is why nothing errored and the pad simply could not be signed.
 */
describe('the pad carries its own shape', () => {
  it('sizes the drawing surface by its own aspect, never by what is left over', () => {
    const { container } = render(
      <IntakeSignaturePad title="Serviser" name="Proba" strokes={[]} onChange={() => {}} />,
    )

    const surface = container.querySelector('svg[viewBox="0 0 460 200"]')?.parentElement

    expect(surface?.className).toContain('aspect-[460/200]')
    // The class that caused the collapse. Its return is the regression.
    expect(surface?.className).not.toContain('flex-1')
  })
})
