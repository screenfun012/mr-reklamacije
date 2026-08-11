import { getLocale, m } from '@mr/i18n'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
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

    function Harness(): ReactElement {
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

    await renderDetailUi(<Harness />)
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
