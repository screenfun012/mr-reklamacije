import { useCallback, useState, type RefCallback } from 'react'

/**
 * A4 at 96dpi — the paper's real width, and the only number the preview scales against. The sheet's
 * own class carries the same literal because a Tailwind arbitrary value cannot be dynamic, and
 * `intake-print.css` carries it again for the box that reserves the scaled size.
 */
export const INTAKE_PRINT_SHEET_WIDTH_PX = 794

/**
 * How far the preview has to shrink for the whole page to fit the width it was actually given.
 *
 * Never above 1: the sheet is A4, and blowing it up past its real size would make the preview lie
 * about what comes out of the printer. Below 1 it is a plain ratio of the MEASURED room — no
 * breakpoints and no phone branch, because 90% of intake happens on a tablet or a phone and every
 * one of them is a different width in each orientation.
 *
 * A width of 0 is the first paint, before anything has been measured (and SSR, which never renders
 * this dialog open): 1 is right for the desktop that needs no scaling, and the measurement corrects
 * it everywhere else.
 */
export function intakePrintScale(availableWidthPx: number): number {
  if (availableWidthPx <= 0) {
    return 1
  }
  return Math.min(1, availableWidthPx / INTAKE_PRINT_SHEET_WIDTH_PX)
}

/**
 * The scale for the width the element put on `measureRef` actually has, re-measured whenever it
 * changes.
 *
 * A `ResizeObserver` and not a `resize` listener: it also fires for the rotation that leaves the
 * window's own size alone and for a scrollbar appearing beside the sheet. The vendored
 * `useElementRect` is deliberately not reused — it is `@ts-nocheck`ed TipTap support code that
 * re-measures on every scroll event in the capture phase, and this needs one number.
 *
 * A callback ref rather than `useRef` + `useEffect`: the print dialog is mounted by the detail route
 * with `open={false}` and renders null until it is asked for, so an effect keyed on a ref OBJECT
 * would run once while that ref was still null, find nothing, and never look again — the preview
 * would sit at 1:1 on a phone forever. This fires when the element actually appears, and React runs
 * the cleanup it returns when the element goes away.
 */
export function useIntakePrintScale(): {
  measureRef: RefCallback<HTMLElement>
  scale: number
} {
  const [scale, setScale] = useState(1)

  const measureRef = useCallback<RefCallback<HTMLElement>>((element) => {
    if (element === null) {
      return
    }
    const observer = new ResizeObserver((entries) => {
      // `contentRect` already excludes the padding, so it is exactly the room the sheet may use.
      setScale(intakePrintScale(entries[0]?.contentRect.width ?? 0))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { measureRef, scale }
}
