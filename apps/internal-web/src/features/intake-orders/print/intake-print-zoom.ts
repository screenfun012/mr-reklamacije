/**
 * The preview's own zoom, as arithmetic.
 *
 * The preview is a `position: fixed` overlay, and the browser's own pinch on one of those is a
 * different thing in each engine — it zooms the visual viewport, re-anchors when the gesture ends and
 * on iOS can leave the paper somewhere the page cannot scroll to. 90% of intake happens on a tablet
 * or a phone, so the preview owns the gesture instead, the way any document viewer does.
 *
 * Everything in this file is a pure function over numbers the DOM measured. That is deliberate: jsdom
 * has no layout and cannot dispatch a pinch, so this is the part a unit test can hold honestly — and
 * a browser can run these same functions against real layout, which is how the anchoring below was
 * proven in Chromium and WebKit (2026-08-12).
 */

/**
 * Twice the paper, and no further.
 *
 * 1:1 has to be reachable — that is the size the printer produces, and the sheet's own type runs from
 * 8.5px (the eyebrows) to 11.5px (body), so at the fit scale of a 390px phone (0.43) the body text
 * draws at about 5px, which is what the operator complained about. At 1:1 it is 11.5px: legible but
 * tight on glass. At 2× the smallest line on the paper reaches 17px, about the size of the app's own
 * body text, which is where magnifying stops helping. It also bounds the cost: 2× paints 1588×2246,
 * and each step above that is more compositing on the oldest iPad in the shop for type nobody needs
 * bigger than the UI around it.
 */
export const INTAKE_PRINT_MAX_SCALE = 2

/**
 * How far a finger may travel, and how long it may stay down, and still have meant a tap — plus how
 * long the second tap of a double tap may take to arrive. The travel slop is what keeps a slow pan
 * that happens to end where the last one did from reading as a double tap and dumping the
 * magnification the operator was reading at.
 */
const TAP_MAX_TRAVEL_PX = 12
const TAP_MAX_MS = 300
const DOUBLE_TAP_MAX_MS = 320

/** A pointer position in client coordinates — the only thing the gesture needs out of an event. */
export interface IntakePrintPoint {
  readonly x: number
  readonly y: number
}

export interface IntakePrintTap extends IntakePrintPoint {
  readonly at: number
}

export function pointerGap(a: IntakePrintPoint, b: IntakePrintPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function pointerMidpoint(a: IntakePrintPoint, b: IntakePrintPoint): IntakePrintPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * The fit scale is the FLOOR of the user's zoom, never just its starting point: below it the paper
 * would be drawn smaller than the room it has, which is the one thing nobody asked for, and the
 * preview would start lying about the page in the other direction.
 *
 * A non-finite input is the degenerate pinch — two pointers reported on the same pixel, so the gap
 * ratio comes back as Infinity or NaN. The floor is the safe answer: it is a state the operator can
 * see and get out of, where a NaN in the custom property silently paints nothing at all.
 */
export function clampIntakePrintScale(scale: number, fitScale: number): number {
  if (!Number.isFinite(scale)) {
    return fitScale
  }
  return Math.min(Math.max(scale, fitScale), INTAKE_PRINT_MAX_SCALE)
}

/**
 * The scale a pinch has reached: the scale it STARTED at, times how much the gap between the two
 * fingers has grown since. Measured from the start of the gesture and not accumulated per move —
 * accumulating multiplies every rounding error by the number of pointer events, which is the drift a
 * finger feels as the paper sliding away from it.
 *
 * A start gap of zero (two pointers on the same pixel) makes the ratio non-finite, which the clamp
 * turns into the fit scale rather than a blank screen.
 */
export function intakePinchScale(pinch: {
  startScale: number
  startGap: number
  gap: number
  fitScale: number
}): number {
  return clampIntakePrintScale((pinch.startScale * pinch.gap) / pinch.startGap, pinch.fitScale)
}

/**
 * Double tap toggles fit ⇄ 1:1, and not a cycle of magnifications: the operator's question is "let me
 * read this", and the answer is the paper's real size — which is also what comes out of the printer.
 * On a desktop, where the paper already fits at 1:1, both states are the same number, so the tap is a
 * no-op by arithmetic rather than by a branch nobody remembers to keep.
 */
export function intakeDoubleTapScale(scale: number, fitScale: number): number {
  return scale > fitScale ? fitScale : clampIntakePrintScale(1, fitScale)
}

/**
 * A scroll offset the box actually has room for — the pan, clamped, so the paper can never be dragged
 * to where it cannot be dragged back from.
 *
 * The browser clamps an assignment to `scrollLeft` as well. The clamp lives here too because it is
 * the gesture's own invariant and can be proven at this level, rather than trusting two engines to
 * agree about rounding at the ends of the range.
 */
export function clampIntakePrintPan(offset: number, contentPx: number, viewportPx: number): number {
  return Math.min(Math.max(offset, 0), Math.max(0, contentPx - viewportPx))
}

/**
 * Where the box has to be scrolled to for the point of the paper under the fingers to stay under
 * them while the scale changes.
 *
 * `paperPoint` is read with the layout the gesture STARTED from and the rest is measured once the DOM
 * carries the new scale, so this is exact instead of an approximation of what the centring and the
 * toolbar above the paper do to the box's position: the paper point is drawn at
 * `sheetStart + paperPoint * scale` and the fingers are at `focal`, both measured from the same edge
 * of the scroll box, and the difference between them is what the scroll absorbs.
 */
export function intakeAnchoredScroll(anchor: {
  scroll: number
  sheetStart: number
  paperPoint: number
  scale: number
  focal: number
  contentPx: number
  viewportPx: number
}): number {
  const target = anchor.scroll + anchor.sheetStart + anchor.paperPoint * anchor.scale - anchor.focal
  return clampIntakePrintPan(target, anchor.contentPx, anchor.viewportPx)
}

/** The tap this pointer made, or null when it was a drag or a long press. */
export function intakeTapOf(down: IntakePrintTap, up: IntakePrintTap): IntakePrintTap | null {
  if (pointerGap(down, up) > TAP_MAX_TRAVEL_PX || up.at - down.at > TAP_MAX_MS) {
    return null
  }
  return up
}

/**
 * Pointer-based, and deliberately not a `dblclick` listener: a phone synthesises that event late and
 * only once it has decided the taps were not the start of a pinch or a scroll — and on a surface that
 * has taken the gesture away from the engine with `touch-action: none` it may not arrive at all.
 */
export function isIntakeDoubleTap(previous: IntakePrintTap | null, tap: IntakePrintTap): boolean {
  if (previous === null) {
    return false
  }
  return tap.at - previous.at <= DOUBLE_TAP_MAX_MS && pointerGap(previous, tap) <= TAP_MAX_TRAVEL_PX
}
