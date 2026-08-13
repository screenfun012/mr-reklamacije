import { getLocale, m } from '@mr/i18n'
import { intakeChecklistItemsDisplayOptions, type IntakeOrderDetail } from '@mr/shared'
import { cn } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'

import { INTAKE_VEHICLE_TYPE_LABELS } from '@mr/intake-document'
import type { IntakePrintLocale } from '@mr/intake-document'
import { useIntakePrintScale } from './intake-print-scale'
import { IntakePrintSheet } from '@mr/intake-document'
import { useIntakePrintZoom } from './use-intake-print-zoom'
import './intake-print.css'

const PRINT_LOCALES: readonly IntakePrintLocale[] = ['sr', 'en']

/**
 * This app's own copy, served from `public/` the way every other brand asset in every other app is —
 * the three front ends are physically isolated and each carries its own (CLAUDE.md §1). The master
 * lives beside the document in `@mr/intake-document/assets`, which is where the API reads it from,
 * and a test pins the two to the same bytes so neither can quietly become the other's past.
 */
const EMBLEM_URL = '/internal/logo-emblem-white.png'

/**
 * The preview, at the paper's real size, with the only two ways out. Its own overlay rather than
 * the shared `ConfirmDialog`: a Radix dialog portals its content under a positioned, scroll-locked
 * wrapper, and the print stylesheet would then have to undo all of it. The photo lightbox next
 * door is built the same way for the same reason.
 *
 * The print button waits for every thumbnail. `window.print()` does not: fired while the images
 * are still arriving it prints empty frames onto the page the customer is about to sign.
 */
export function IntakePrintDialog({
  order,
  open,
  onClose,
}: {
  order: IntakeOrderDetail
  open: boolean
  onClose: () => void
}): ReactElement | null {
  /**
   * Defaults to the office's own language and is then the operator's to change — a foreign
   * customer signs an English work order while the app around it stays Serbian. Switching resets
   * the image gate, because the sheet remounts and the thumbnails load again.
   */
  const [printLocale, setPrintLocale] = useState<IntakePrintLocale>(() => getLocale())

  /**
   * The names the sheet prints. The DISPLAY read, not the wizard's picker: this paper is evidence,
   * and a row whose item the shop deactivated or removed since must still print with its name
   * rather than as a bare code (plan D3). The detail's route loader has already warmed it.
   */
  const { data: checklistItems = [] } = useQuery(intakeChecklistItemsDisplayOptions())

  /**
   * The room the paper has, measured. Everything the dialog lays out sits inside that element, so its
   * content width IS the available width — the dialog's own padding is already out of it.
   */
  const { measureRef, viewport, scale: fitScale } = useIntakePrintScale()

  /**
   * …and what the operator's fingers did to it. The fit scale is the floor and the default, so with no
   * gesture in play this is exactly the number the measurement produced.
   */
  const { scale, toggle, handlers } = useIntakePrintZoom({ fitScale, viewport })

  useEffect(() => {
    if (!open) {
      return
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) {
    return null
  }

  const vehicleType = INTAKE_VEHICLE_TYPE_LABELS[order.vehicleType]()

  /*
   * The scroll box, and therefore the pan: `touch-action: none` on the paper leaves it no native
   * scrolling, and the one-pointer drag drives these offsets instead. `intake-print-viewport` carries
   * the `overflow` rather than a Tailwind utility because print has to be able to take it away — see
   * the stylesheet for what a scrolled preview printed before it could.
   */
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={m.intake_print_preview({ type: vehicleType })}
      ref={measureRef}
      className="intake-print-viewport fixed inset-0 z-50 flex flex-col items-center bg-[rgba(11,11,13,0.92)] p-6"
    >
      {/* `items-center` stays for the toolbar, which is never wider than this box. The paper can now
          be magnified past it, which is why the scaler below centres itself with `mx-auto` instead:
          an auto margin resolves to ZERO when the free space is negative (CSS Flexbox §9.6), so an
          overflowing sheet starts at the left edge and every pixel of it is scrollable, while
          `align-items: center` would centre the overflow and put the left edge at a coordinate
          `scrollLeft` cannot reach. Measured at 390px, both engines, at 2×: -599px with the left edge
          unreachable, exactly the bug the fit-to-width change fixed at 1×. */}
      <div
        data-testid="intake-print-toolbar"
        className="mb-[14px] flex w-full max-w-[794px] flex-none flex-wrap items-center gap-3"
      >
        <span className="font-mono text-[10.5px] font-semibold tracking-[0.18em] text-white">
          {m.intake_print_preview({ type: vehicleType })}
        </span>
        {/* Only where there is something to zoom: on a desktop the paper is already at 1:1 and both
            ends of the toggle are the same size. The gestures stay, but nobody has to know them —
            the workers are not computer literate and will not go looking for a gesture nobody named
            (docs/25 §3.0 — the screen leads), and a mouse cannot pinch at all. The label names WHERE
            THE PRESS GOES rather than what to do with your fingers. */}
        {fitScale < 1 ? (
          <button
            type="button"
            onClick={toggle}
            className="min-h-11 cursor-pointer rounded-[9px] border border-white/25 bg-white/10 px-5 text-[12.5px] font-bold uppercase tracking-[0.06em] text-white"
          >
            {scale > fitScale ? m.intake_print_zoom_whole() : m.intake_print_zoom_actual()}
          </button>
        ) : null}
        {/* The paper's language, not the app's. Two segments rather than a question before the
            preview: the operator SEES what he is about to hand over. */}
        <div
          role="group"
          aria-label={m.intake_print_language()}
          className="ml-auto flex overflow-hidden rounded-[9px] border border-white/25"
        >
          {PRINT_LOCALES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={printLocale === value}
              onClick={() => setPrintLocale(value)}
              className={cn(
                'min-h-11 w-[52px] cursor-pointer font-mono text-[12px] font-bold uppercase',
                printLocale === value ? 'bg-white text-[#141417]' : 'bg-transparent text-white',
              )}
            >
              {value}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-h-11 cursor-pointer rounded-[9px] border border-white/25 bg-white/10 px-5 text-[12.5px] font-bold uppercase tracking-[0.06em] text-white"
        >
          {m.action_close()}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-11 cursor-pointer rounded-[9px] bg-[#f2f2f3] px-[22px] text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-[#141417] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {m.intake_detail_print()}
        </button>
      </div>

      {/*
        No image gate any more, and deliberately none left behind: it existed because
        `window.print()` does not wait for images and would print empty frames. The sheet has
        carried no photographs since 2026-08-10, so there is nothing to wait for — and a dead gate
        kept "just in case" is the thing nobody can explain later.
      */}
      {/* The shadow rides the reserved box rather than the sheet, so it stays a crisp 24px drop at
          every scale instead of shrinking with the paper. `intake-print.css` owns the arithmetic and
          the print reset; the only thing React contributes is the measured number. */}
      {/* `touch-none` is what makes the pinch ours: without it the pointers are taken by the engine
          for its own panning and zooming half way through the gesture. It also means this surface has
          no native scroll left, so the one-pointer drag IS the scroll — see `panBy`. `select-none`
          keeps a mouse drag from selecting the paper's text instead of panning it. */}
      <div
        data-testid="intake-print-scaler"
        className="intake-print-scaler mx-auto flex-none touch-none select-none shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
        style={{ '--intake-print-scale': scale } as CSSProperties}
        {...handlers}
      >
        <IntakePrintSheet
          key={printLocale}
          order={order}
          checklistItems={checklistItems}
          locale={printLocale}
          logoSrc={EMBLEM_URL}
        />
      </div>
    </div>
  )
}
