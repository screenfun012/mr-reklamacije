import { getLocale, m } from '@mr/i18n'
import { act, createEvent, fireEvent, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useState, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  intakeOrderDetailFixture,
  intakePhotoFixture,
  renderDetailUi,
} from '../../detail/__tests__/render-detail.js'
import { IntakePrintDialog } from '../intake-print-dialog.js'
import { intakePrintScale } from '../intake-print-scale.js'
import {
  INTAKE_PRINT_MAX_SCALE,
  clampIntakePrintScale,
  intakePinchScale,
} from '../intake-print-zoom.js'
/*
 * The stylesheet as text: the scale mechanism and its print reset live in CSS, and this is the only
 * way a test can hold them. Read off disk rather than imported — vitest runs with `css: false`, so a
 * `?raw` import of a stylesheet comes back as an empty string, and the `new URL(…, import.meta.url)`
 * form is claimed by Vite's asset handling before Node ever sees it.
 */
const printCss = readFileSync(join(import.meta.dirname, '..', 'intake-print.css'), 'utf8')

describe('IntakePrintDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('draws nothing while it is closed', async () => {
    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open={false} onClose={() => {}} />,
    )

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('prints on demand once it is open', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)

    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open onClose={() => {}} />,
    )

    fireEvent.click(screen.getByRole('button', { name: m.intake_detail_print() }))

    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
  })

  it('is ready to print the moment it opens, and carries no photograph to wait for', async () => {
    // There used to be a gate here: `window.print()` does not wait for images and would print six
    // empty frames. The photographs left the document on 2026-08-10, so the gate went with them
    // rather than being left behind as something nobody could explain.
    //
    // The header emblem is the one image left, and it is a local asset the operator can see in the
    // preview before he presses print — the preview IS the gate now.
    const order = intakeOrderDetailFixture({
      photos: [intakePhotoFixture({ id: '44444444-4444-4444-8444-444444444444' })],
    })

    await renderDetailUi(<IntakePrintDialog order={order} open onClose={() => {}} />)

    expect(screen.getByRole('button', { name: m.intake_detail_print() })).toBeEnabled()
    const images = screen.getAllByRole('img', { hidden: true })
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('alt', 'MR Engines')
  })

  /**
   * The dialog is where the sheet's names come from, and it must read the DISPLAY catalog: `lanci` is
   * retired in the fixture, so the wizard's picker would not carry it and this preview would show a
   * bare code on the paper a customer signs (plan D3). Switch the factory and this goes red.
   */
  it('names a retired checklist item on the paper, not its bare code', async () => {
    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open onClose={() => {}} />,
    )

    expect(screen.getByTestId('print-check-lanci')).toHaveTextContent('Lanci / alat')
  })

  it('prints the language the operator picked, not the one the app is in', async () => {
    // A foreign customer brings the car in. The office keeps working in Serbian; the paper he
    // signs must be English, and choosing that must not change the app around it.
    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open onClose={() => {}} />,
    )

    expect(screen.getByText(m.intake_print_title({}, { locale: 'sr' }))).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'en' }))

    expect(screen.getByText(m.intake_print_title({}, { locale: 'en' }))).toBeDefined()
    expect(screen.queryByText(m.intake_print_title({}, { locale: 'sr' }))).toBeNull()
    expect(getLocale()).toBe('sr')
  })

  it('closes on the close button and on Escape', async () => {
    const onClose = vi.fn()

    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open onClose={onClose} />,
    )

    fireEvent.click(screen.getByRole('button', { name: m.action_close() }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

function firstResizeObserverCallback(): (width: number) => void {
  let callback: ResizeObserverCallback | null = null
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: ResizeObserverCallback) {
        callback = cb
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  return (width) => {
    const entry = { contentRect: { width } } as ResizeObserverEntry
    act(() => callback?.([entry], {} as ResizeObserver))
  }
}

/**
 * The production shape: the detail route mounts the dialog with `open={false}` and toggles the prop
 * (`routes/_shell/prijem/$id.tsx`), so nothing the dialog measures or listens on exists at mount.
 */
function ClosedThenOpen(): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <IntakePrintDialog
        order={intakeOrderDetailFixture()}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

/**
 * One fluid layout, no phone branch. 90% of intake happens on a tablet or a phone, and A4's real
 * 794px is about twice a phone's viewport — centred by the dialog's own `items-center`, which put the
 * left edge of every row at a negative coordinate that `scrollLeft` (floored at 0 in both engines)
 * could never reach.
 *
 * jsdom has no layout, so none of this measures a pixel — the pixels were measured in Chromium and
 * WebKit on 2026-08-11 and are quoted in `intake-print.css`. What is pinned here is the wiring and
 * the reset, which is what a later edit can silently break.
 */
describe('IntakePrintDialog — one fluid layout', () => {
  it('carries no fixed width on the toolbar, so its controls wrap instead of leaving the screen', async () => {
    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open onClose={() => {}} />,
    )

    const toolbar = screen.getByTestId('intake-print-toolbar')

    // The A4 literal that used to be here is what pushed "Zatvori" and "Štampaj" past a 390px screen:
    // the toolbar is chrome, not paper, and has no business being the paper's width.
    expect(toolbar.className).not.toMatch(/(^|\s)w-\[\d+px]/)
    expect(toolbar).toHaveClass('w-full', 'max-w-[794px]', 'flex-wrap')
  })

  it('gives every control a 44px touch target, because a thumb is the only pointer here', async () => {
    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open onClose={() => {}} />,
    )

    for (const name of ['sr', 'en', m.action_close(), m.intake_detail_print()]) {
      expect(screen.getByRole('button', { name })).toHaveClass('min-h-11')
    }
  })

  it('scales the sheet by the width it observed, and stops at the paper’s real size', async () => {
    const resizeTo = firstResizeObserverCallback()

    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open onClose={() => {}} />,
    )

    const scaler = screen.getByTestId('intake-print-scaler')
    // Nothing measured yet: the paper is 1:1, which is also the desktop's answer.
    expect(scaler.style.getPropertyValue('--intake-print-scale')).toBe('1')

    resizeTo(342)
    expect(scaler.style.getPropertyValue('--intake-print-scale')).toBe(
      String(intakePrintScale(342)),
    )

    // A rotation to landscape, then a desktop: the same observer, no breakpoint anywhere.
    resizeTo(700)
    expect(scaler.style.getPropertyValue('--intake-print-scale')).toBe(
      String(intakePrintScale(700)),
    )
    resizeTo(1400)
    expect(scaler.style.getPropertyValue('--intake-print-scale')).toBe('1')
  })

  /**
   * The route mounts this dialog with `open={false}` and toggles the prop
   * (`routes/_shell/prijem/$id.tsx`), so the element being measured does not exist at mount. An
   * earlier version of the hook keyed its effect on a ref OBJECT: it ran once against a null ref,
   * never looked again, and every phone would have sat at 1:1 with the bug fully intact — while the
   * test above, which renders already-open, stayed green. This is the production path.
   */
  it('starts measuring when the dialog is opened, not when it is mounted', async () => {
    const resizeTo = firstResizeObserverCallback()

    await renderDetailUi(<ClosedThenOpen />)
    expect(screen.queryByTestId('intake-print-scaler')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    resizeTo(342)

    expect(
      screen.getByTestId('intake-print-scaler').style.getPropertyValue('--intake-print-scale'),
    ).toBe(String(intakePrintScale(342)))
  })

  it('reserves the height it actually draws, so the dialog scrolls past nothing', () => {
    // A transform does not change layout size. Drop the `height` rule and the dialog goes on
    // scrolling A4's full 1123px past a sheet that paints 484 of them.
    expect(printCss).toMatch(/width:\s*calc\(794px \* var\(--intake-print-scale/)
    expect(printCss).toMatch(/height:\s*calc\(1123px \* var\(--intake-print-scale/)
  })

  /**
   * The zoom made this reachable in a way it never was at fit scale: the sheet is positioned inside the
   * scroll box, so a preview the operator has scrolled printed the paper translated by that scroll —
   * measured at 2× scrolled to (400,600), the printed sheet sat at (-400,-279) in both engines, with
   * the signature block off the page. Taking the overflow away in print resets the offsets with no
   * listener, and it covers Cmd+P as well as our button; it can only win that against a rule of its own
   * kind, which is why the dialog does not use Tailwind's `overflow-auto`.
   */
  it('prints from the top-left corner even when the preview was scrolled', () => {
    const printBlock = printCss.slice(printCss.indexOf('@media print'))

    expect(printCss.slice(0, printCss.indexOf('@media print'))).toMatch(
      /\.intake-print-viewport\s*\{[^}]*overflow:\s*auto/,
    )
    expect(printBlock).toMatch(/\.intake-print-viewport\s*\{[^}]*overflow:\s*visible/)
  })

  it('hands the printer the paper at 1:1, whatever the screen scaled it to', () => {
    // Proven by measurement (both engines, print media emulated: the sheet measures 794x1123 again).
    // What a unit test can hold is that the reset is still there and still last — the screen rules
    // have the same specificity, so source order is the whole mechanism.
    const printBlock = printCss.slice(printCss.indexOf('@media print'))

    expect(printCss.indexOf('.intake-print-scaler {')).toBeLessThan(
      printCss.indexOf('@media print'),
    )
    expect(printBlock).toMatch(/\.intake-print-scaler\s*\{[^}]*height:\s*auto/)
    expect(printBlock).toMatch(/#intake-print-sheet\s*\{[^}]*transform:\s*none/)
  })
})

/**
 * The preview owns its zoom, so the browser's own pinch — which zooms the visual viewport, behaves
 * differently per engine and can re-anchor when the gesture ends on a `position: fixed` overlay —
 * is deliberately taken away with `touch-action: none`.
 *
 * jsdom has no layout and cannot dispatch a pinch: the arithmetic is tested as arithmetic in
 * `intake-print-zoom.test.ts`, and the anchoring and print reset were measured against real layout in
 * Chromium and WebKit on 2026-08-12. What this block holds is the WIRING — that the gestures reach the
 * right function, on a dialog that was mounted CLOSED, which is how the route mounts it.
 */
describe('IntakePrintDialog — the preview owns its zoom', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const PHONE = 342
  const fit = intakePrintScale(PHONE)

  /**
   * A pointer event whose `timeStamp` WE choose: the tap and double-tap windows are milliseconds
   * wide, and a gate under load can put a real pause between two `fireEvent` calls.
   */
  function firePointer(
    element: HTMLElement,
    type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel',
    init: { pointerId: number; clientX: number; clientY: number; at?: number },
  ): void {
    const event = createEvent[type](element, {
      pointerId: init.pointerId,
      clientX: init.clientX,
      clientY: init.clientY,
    })
    Object.defineProperty(event, 'timeStamp', { value: init.at ?? 0 })
    fireEvent(element, event)
  }

  /**
   * jsdom reports every box as 0×0, and the pan is the scroll box's own offsets — so the room has to
   * be stated. The real numbers come from the engines: a 390px phone at 2× holds 1588 + 48 of padding
   * in 390 of room.
   */
  function giveRoom(element: HTMLElement, content: number, viewport: number): void {
    for (const [property, value] of [
      ['scrollWidth', content],
      ['scrollHeight', content],
      ['clientWidth', viewport],
      ['clientHeight', viewport],
    ] as const) {
      Object.defineProperty(element, property, { value, configurable: true })
    }
  }

  async function openOnAPhone(): Promise<{ dialog: HTMLElement; scaler: HTMLElement }> {
    const resizeTo = firstResizeObserverCallback()
    await renderDetailUi(<ClosedThenOpen />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    resizeTo(PHONE)
    return { dialog: screen.getByRole('dialog'), scaler: screen.getByTestId('intake-print-scaler') }
  }

  const scaleOf = (scaler: HTMLElement): string =>
    scaler.style.getPropertyValue('--intake-print-scale')

  function pinch(scaler: HTMLElement, from: number, to: number): void {
    firePointer(scaler, 'pointerDown', { pointerId: 1, clientX: 100, clientY: 400 })
    firePointer(scaler, 'pointerDown', { pointerId: 2, clientX: 100 + from, clientY: 400 })
    firePointer(scaler, 'pointerMove', { pointerId: 2, clientX: 100 + to, clientY: 400 })
  }

  it('takes the gesture off the engine, and centres with a margin so a magnified sheet stays reachable', async () => {
    const { scaler } = await openOnAPhone()

    // `touch-none` is the whole reason the pinch below is ours. `mx-auto` is what keeps the left edge
    // of an overflowing sheet at a coordinate `scrollLeft` can reach: measured at 390px in both
    // engines, `align-items: center` alone put it at -599px with the scroll floored at 0 — the bug the
    // fit-to-width change fixed at 1×, re-armed by zoom.
    expect(scaler).toHaveClass('touch-none', 'select-none', 'mx-auto')
  })

  it('magnifies by the ratio the fingers spread, from the fit scale it started at', async () => {
    const { scaler } = await openOnAPhone()
    expect(scaleOf(scaler)).toBe(String(fit))

    pinch(scaler, 100, 200)

    expect(scaleOf(scaler)).toBe(
      String(intakePinchScale({ startScale: fit, startGap: 100, gap: 200, fitScale: fit })),
    )
  })

  it('stops at the ceiling, and never shrinks the paper below the room it has', async () => {
    const { scaler } = await openOnAPhone()

    pinch(scaler, 100, 4000)
    expect(scaleOf(scaler)).toBe(String(INTAKE_PRINT_MAX_SCALE))

    firePointer(scaler, 'pointerUp', { pointerId: 1, clientX: 100, clientY: 400 })
    firePointer(scaler, 'pointerUp', { pointerId: 2, clientX: 4100, clientY: 400 })
    pinch(scaler, 300, 4)
    expect(scaleOf(scaler)).toBe(String(fit))
  })

  it('pans by scrolling the box, and a drag never changes the scale', async () => {
    const { dialog, scaler } = await openOnAPhone()
    giveRoom(dialog, 1636, 390)

    firePointer(scaler, 'pointerDown', { pointerId: 1, clientX: 200, clientY: 500 })
    firePointer(scaler, 'pointerMove', { pointerId: 1, clientX: 150, clientY: 460 })

    // The paper follows the finger: dragging left shows what is to the right of it.
    expect(dialog.scrollLeft).toBe(50)
    expect(dialog.scrollTop).toBe(40)
    expect(scaleOf(scaler)).toBe(String(fit))
  })

  it('cannot pan an axis with no overflow, which at the fit scale is the horizontal one', async () => {
    const { dialog, scaler } = await openOnAPhone()
    giveRoom(dialog, 390, 390)

    firePointer(scaler, 'pointerDown', { pointerId: 1, clientX: 200, clientY: 500 })
    firePointer(scaler, 'pointerMove', { pointerId: 1, clientX: 100, clientY: 500 })

    expect(dialog.scrollLeft).toBe(0)
  })

  it('does not jump when one finger of a pinch lifts — the other one just pans', async () => {
    const { dialog, scaler } = await openOnAPhone()
    giveRoom(dialog, 1636, 390)

    pinch(scaler, 100, 200)
    const magnified = scaleOf(scaler)
    // Where the pinch's own anchoring left the box — a delta, because that offset is the answer to a
    // geometry jsdom does not have (the anchoring itself was measured in the browsers).
    const anchored = dialog.scrollLeft
    firePointer(scaler, 'pointerUp', { pointerId: 2, clientX: 300, clientY: 400 })

    // The finger left behind continues from where it IS. If the pinch survived the lift, this move
    // would be read as a gap change and the paper would snap.
    firePointer(scaler, 'pointerMove', { pointerId: 1, clientX: 90, clientY: 400 })

    expect(scaleOf(scaler)).toBe(magnified)
    expect(dialog.scrollLeft - anchored).toBeCloseTo(10, 6)
  })

  /**
   * The hand that rests a third finger on the paper mid-pinch and then lifts one of the first two.
   * The two fingers left behind must go on pinching from the gap they have NOW: measured against the
   * gap a lifted finger was holding open, the paper snaps to a scale nobody asked for.
   */
  it('re-arms the pinch on the fingers that remain when one of three lifts', async () => {
    const { scaler } = await openOnAPhone()

    firePointer(scaler, 'pointerDown', { pointerId: 1, clientX: 100, clientY: 400 })
    firePointer(scaler, 'pointerDown', { pointerId: 2, clientX: 200, clientY: 400 })
    firePointer(scaler, 'pointerMove', { pointerId: 2, clientX: 300, clientY: 400 })
    const magnified = Number(scaleOf(scaler))

    firePointer(scaler, 'pointerDown', { pointerId: 3, clientX: 400, clientY: 400 })
    firePointer(scaler, 'pointerUp', { pointerId: 1, clientX: 100, clientY: 400 })
    // Fingers 2 and 3 are 100 apart; spreading them to 200 doubles the magnification they inherited.
    firePointer(scaler, 'pointerMove', { pointerId: 3, clientX: 500, clientY: 400 })

    expect(scaleOf(scaler)).toBe(
      String(intakePinchScale({ startScale: magnified, startGap: 100, gap: 200, fitScale: fit })),
    )
  })

  it('toggles fit ⇄ 1:1 on a double tap', async () => {
    const { scaler } = await openOnAPhone()

    const tapTwice = (start: number): void => {
      for (const at of [start, start + 100]) {
        firePointer(scaler, 'pointerDown', { pointerId: 1, clientX: 180, clientY: 300, at })
        firePointer(scaler, 'pointerUp', { pointerId: 1, clientX: 180, clientY: 300, at: at + 40 })
      }
    }

    tapTwice(1000)
    expect(scaleOf(scaler)).toBe('1')

    tapTwice(5000)
    expect(scaleOf(scaler)).toBe(String(fit))
  })

  it('ignores two slow taps, so a pan that ends twice in the same place is not a zoom', async () => {
    const { scaler } = await openOnAPhone()

    for (const at of [1000, 2000]) {
      firePointer(scaler, 'pointerDown', { pointerId: 1, clientX: 180, clientY: 300, at })
      firePointer(scaler, 'pointerUp', { pointerId: 1, clientX: 180, clientY: 300, at: at + 40 })
    }

    expect(scaleOf(scaler)).toBe(String(fit))
  })

  /**
   * The fit scale is re-measured on rotation, and it is the floor of the zoom — so a magnification
   * that has fallen below the new floor must stop being applied, and one still above it must survive.
   */
  it('re-floors a magnification when a rotation gives the paper more room', async () => {
    const resizeTo = firstResizeObserverCallback()
    await renderDetailUi(<ClosedThenOpen />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    resizeTo(PHONE)
    const scaler = screen.getByTestId('intake-print-scaler')

    pinch(scaler, 100, 130)
    const magnified = Number(scaleOf(scaler))
    expect(magnified).toBeGreaterThan(fit)

    // Landscape: the paper fits at 0.88, which is above the 0.56 the fingers had asked for.
    const landscape = intakePrintScale(700)
    resizeTo(700)
    expect(scaleOf(scaler)).toBe(String(clampIntakePrintScale(magnified, landscape)))
    expect(Number(scaleOf(scaler))).toBe(landscape)

    // …and a magnification the new floor is still under is kept as it was.
    pinch(scaler, 100, 200)
    const kept = scaleOf(scaler)
    resizeTo(PHONE)
    expect(scaleOf(scaler)).toBe(kept)
  })

  it('offers the reading size where the paper does not fit, and stays quiet on a desktop', async () => {
    const resizeTo = firstResizeObserverCallback()
    await renderDetailUi(<ClosedThenOpen />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))

    resizeTo(PHONE)
    expect(screen.getByRole('button', { name: m.intake_print_zoom_actual() })).toBeDefined()

    // A desktop draws the paper at 1:1 already: both ends of the toggle are the same size, so there
    // is nothing to offer and a button that changes nothing reads as broken.
    resizeTo(1400)
    expect(screen.queryByRole('button', { name: m.intake_print_zoom_actual() })).toBeNull()
    expect(screen.queryByRole('button', { name: m.intake_print_zoom_whole() })).toBeNull()
  })

  /**
   * The gestures stay, but nobody has to know them: Nikola cannot pinch with a mouse, and the
   * serviser will not go looking for a gesture nobody named (docs/25 §3.0 — the screen leads).
   */
  it('the button toggles, and its label always names where the next press goes', async () => {
    const resizeTo = firstResizeObserverCallback()
    await renderDetailUi(<ClosedThenOpen />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    resizeTo(PHONE)

    fireEvent.click(screen.getByRole('button', { name: m.intake_print_zoom_actual() }))

    expect(screen.getByRole('button', { name: m.intake_print_zoom_whole() })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: m.intake_print_zoom_whole() }))

    expect(screen.getByRole('button', { name: m.intake_print_zoom_actual() })).toBeDefined()
  })
})
