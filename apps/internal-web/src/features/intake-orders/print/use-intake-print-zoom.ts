import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'

import {
  clampIntakePrintPan,
  clampIntakePrintScale,
  intakeAnchoredScroll,
  intakeDoubleTapScale,
  intakePinchScale,
  intakeTapOf,
  isIntakeDoubleTap,
  pointerGap,
  pointerMidpoint,
  type IntakePrintPoint,
  type IntakePrintTap,
} from './intake-print-zoom'

/** A pointer that is currently down: where it is now, and the tap it might still turn out to be. */
interface ActivePointer {
  x: number
  y: number
  readonly down: IntakePrintTap
}

interface ZoomAnchor {
  /** The scaled box, kept so its new rect can be read once the DOM carries the new scale. */
  readonly element: HTMLElement
  readonly focal: IntakePrintPoint
  /** The point of the paper, in the paper's own pixels, that must stay under the fingers. */
  readonly paper: IntakePrintPoint
}

interface ZoomGesture {
  readonly pointers: Map<number, ActivePointer>
  pinch: { readonly gap: number; readonly scale: number } | null
  lastTap: IntakePrintTap | null
  anchor: ZoomAnchor | null
}

export interface IntakePrintZoomHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => void
}

/** A third finger is ignored: two is a pinch, and the two that arrived first own it. */
function twoPointers(
  pointers: Map<number, ActivePointer>,
): readonly [ActivePointer, ActivePointer] | null {
  const [first, second] = [...pointers.values()]
  return first === undefined || second === undefined ? null : [first, second]
}

/**
 * The pinch is armed from the fingers that are on the glass RIGHT NOW, and re-armed every time that
 * set changes — a finger arriving or leaving. Keeping the gap a lifted finger was holding open is
 * exactly the jump this avoids: with three fingers down and the first one lifted, the two that remain
 * would otherwise be measured against a gap neither of them ever had.
 */
function armPinch(gesture: ZoomGesture, scale: number): void {
  const two = twoPointers(gesture.pointers)
  gesture.pinch = two === null ? null : { gap: pointerGap(two[0], two[1]), scale }
}

/**
 * The pan IS the scroll box. Nothing else has to be clamped, reserved or reset for print, and an axis
 * with no overflow — the horizontal one at the fit scale — cannot move, because there is no room to
 * move it into.
 */
function panBy(box: HTMLElement, dx: number, dy: number): void {
  box.scrollLeft = clampIntakePrintPan(box.scrollLeft - dx, box.scrollWidth, box.clientWidth)
  box.scrollTop = clampIntakePrintPan(box.scrollTop - dy, box.scrollHeight, box.clientHeight)
}

function applyAnchor(box: HTMLElement, anchor: ZoomAnchor, scale: number): void {
  const boxRect = box.getBoundingClientRect()
  const sheetRect = anchor.element.getBoundingClientRect()
  const left = intakeAnchoredScroll({
    scroll: box.scrollLeft,
    sheetStart: sheetRect.left - boxRect.left,
    paperPoint: anchor.paper.x,
    scale,
    focal: anchor.focal.x - boxRect.left,
    contentPx: box.scrollWidth,
    viewportPx: box.clientWidth,
  })
  const top = intakeAnchoredScroll({
    scroll: box.scrollTop,
    sheetStart: sheetRect.top - boxRect.top,
    paperPoint: anchor.paper.y,
    scale,
    focal: anchor.focal.y - boxRect.top,
    contentPx: box.scrollHeight,
    viewportPx: box.clientHeight,
  })
  // Both axes come from the same pair of rects: assigning one offset moves the box, so measuring
  // again for the second axis would read a layout that had already shifted under it.
  box.scrollLeft = left
  box.scrollTop = top
}

/**
 * The user's zoom, layered on top of the measured fit scale.
 *
 * Two pointers pinch, one pointer pans, a double tap toggles fit ⇄ 1:1. Pointer events and not touch
 * events, so a stylus and a trackpad drag behave the same way; the arithmetic is in
 * `intake-print-zoom.ts` and unit-tested there.
 *
 * `userScale` is the number the FINGERS asked for and the returned scale is that number clamped to
 * the fit scale as it is right now, which is what makes a rotation safe: the floor moves under the
 * zoom, and the paper is re-drawn at the new floor without an effect, a listener or a stale value in
 * between. A magnification that is still above the new floor is deliberately kept — rotating the
 * tablet while reading the fine print must not throw the operator back to unreadable — and one that
 * is now below it stops being applied the moment it would make the paper smaller than its room.
 */
export function useIntakePrintZoom({
  fitScale,
  viewport,
}: {
  fitScale: number
  /** The scroll box: the dialog itself, which is also the element the fit scale is measured from. */
  viewport: RefObject<HTMLElement | null>
}): { scale: number; toggle: () => void; handlers: IntakePrintZoomHandlers } {
  const [userScale, setUserScale] = useState<number | null>(null)
  const gesture = useRef<ZoomGesture>({
    pointers: new Map(),
    pinch: null,
    lastTap: null,
    anchor: null,
  })

  const scale = userScale === null ? fitScale : clampIntakePrintScale(userScale, fitScale)

  /**
   * A layout effect, because the scroll offset that keeps the fingers over the same spot can only be
   * assigned once the box has been re-laid out at the new scale — set from the pointer handler it
   * would be clamped against the size the box still had, and the paper would drift a little on every
   * move of every pinch.
   */
  useLayoutEffect(() => {
    const { anchor } = gesture.current
    const box = viewport.current
    gesture.current.anchor = null
    if (anchor !== null && box !== null) {
      applyAnchor(box, anchor, scale)
    }
  }, [scale, viewport])

  /**
   * The same toggle a double tap performs, for a press that has no focal point. Deliberately without
   * an anchor: the layout effect only re-anchors when a gesture stored one, so the scroll simply
   * stays where it is — which from a fitted page is the top-left, i.e. the start of the document
   * somebody pressed the button to read.
   */
  const toggle = (): void => setUserScale(intakeDoubleTapScale(scale, fitScale))

  const zoomTo = (next: number, focal: IntakePrintPoint, element: HTMLElement): void => {
    // Nothing to anchor when nothing moves — and an anchor stored without a re-render to consume it
    // would be applied by the next unrelated one, which is a rotation dragging the paper to a spot
    // some finger was over minutes ago.
    if (next === scale) {
      return
    }
    const rect = element.getBoundingClientRect()
    gesture.current.anchor = {
      element,
      focal,
      paper: { x: (focal.x - rect.left) / scale, y: (focal.y - rect.top) / scale },
    }
    setUserScale(next)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>): void => {
    /*
     * Capture, so the gesture survives a finger wandering off the paper. At the fit scale on a phone
     * the sheet is a 342×484 rectangle in a dark field, and fingers spreading apart leave it within
     * millimetres — without capture the events stop arriving here, and the paper either freezes or
     * jumps by the distance travelled outside when the finger comes back. Released implicitly on
     * pointerup and pointercancel. Guarded because jsdom implements no capture at all, and the wiring
     * around it is what the component tests exercise.
     */
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    const { pointers } = gesture.current
    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      down: { x: event.clientX, y: event.clientY, at: event.timeStamp },
    })
    armPinch(gesture.current, scale)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>): void => {
    const { pointers, pinch } = gesture.current
    const active = pointers.get(event.pointerId)
    const box = viewport.current
    if (active === undefined || box === null) {
      return
    }
    const dx = event.clientX - active.x
    const dy = event.clientY - active.y
    active.x = event.clientX
    active.y = event.clientY
    const two = twoPointers(pointers)
    if (two === null || pinch === null) {
      panBy(box, dx, dy)
      return
    }
    const next = intakePinchScale({
      startScale: pinch.scale,
      startGap: pinch.gap,
      gap: pointerGap(two[0], two[1]),
      fitScale,
    })
    zoomTo(next, pointerMidpoint(two[0], two[1]), event.currentTarget)
  }

  /**
   * A finger leaving never moves the paper. The pinch is re-armed from whoever is left — two fingers
   * carry on pinching from the gap they have now, and a single finger pans from the position it last
   * reported, which is still in the map.
   */
  const endPointer = (event: ReactPointerEvent<HTMLElement>): ActivePointer | undefined => {
    const { pointers } = gesture.current
    const active = pointers.get(event.pointerId)
    pointers.delete(event.pointerId)
    armPinch(gesture.current, scale)
    return active
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>): void => {
    const active = endPointer(event)
    if (active === undefined) {
      return
    }
    const up = { x: event.clientX, y: event.clientY, at: event.timeStamp }
    const tap = intakeTapOf(active.down, up)
    const previous = gesture.current.lastTap
    gesture.current.lastTap = tap
    if (tap === null || !isIntakeDoubleTap(previous, tap)) {
      return
    }
    // A third tap starts over rather than reading as another double tap.
    gesture.current.lastTap = null
    zoomTo(intakeDoubleTapScale(scale, fitScale), tap, event.currentTarget)
  }

  return {
    scale,
    toggle,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: (event) => void endPointer(event),
      onPointerLeave: (event) => void endPointer(event),
    },
  }
}
