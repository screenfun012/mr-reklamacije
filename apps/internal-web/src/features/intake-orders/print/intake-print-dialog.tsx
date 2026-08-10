import { getLocale, m } from '@mr/i18n'
import type { IntakeOrderDetail } from '@mr/shared'
import { cn } from '@mr/ui'
import { useEffect, useState, type ReactElement } from 'react'

import { INTAKE_VEHICLE_TYPE_LABELS } from '../intake-labels'
import { PRINT_MAX_PHOTOS, type IntakePrintLocale } from './intake-print-data'
import { IntakePrintSheet } from './intake-print-sheet'
import './intake-print.css'

const PRINT_LOCALES: readonly IntakePrintLocale[] = ['sr', 'en']

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
  const expected = Math.min(order.photos.length, PRINT_MAX_PHOTOS)
  const [settled, setSettled] = useState(0)
  /**
   * Defaults to the office's own language and is then the operator's to change — a foreign
   * customer signs an English work order while the app around it stays Serbian. Switching resets
   * the image gate, because the sheet remounts and the thumbnails load again.
   */
  const [printLocale, setPrintLocale] = useState<IntakePrintLocale>(() => getLocale())

  useEffect(() => {
    if (!open) {
      setSettled(0)
    }
  }, [open])

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

  const ready = settled >= expected
  const vehicleType = INTAKE_VEHICLE_TYPE_LABELS[order.vehicleType]()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={m.intake_print_preview({ type: vehicleType })}
      className="fixed inset-0 z-50 flex flex-col items-center overflow-auto bg-[rgba(11,11,13,0.92)] p-6"
    >
      <div className="mb-[14px] flex w-[794px] flex-none items-center gap-3">
        <span className="font-mono text-[10.5px] font-semibold tracking-[0.18em] text-white">
          {m.intake_print_preview({ type: vehicleType })}
        </span>
        {ready ? null : (
          <span className="font-mono text-[10.5px] text-[#b9babd]">{m.intake_print_waiting()}</span>
        )}

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
              onClick={() => {
                setPrintLocale(value)
                setSettled(0)
              }}
              className={cn(
                'h-[42px] w-[52px] cursor-pointer font-mono text-[12px] font-bold uppercase',
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
          className="h-[42px] cursor-pointer rounded-[9px] border border-white/25 bg-white/10 px-5 text-[12.5px] font-bold uppercase tracking-[0.06em] text-white"
        >
          {m.action_close()}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => window.print()}
          className="h-[42px] cursor-pointer rounded-[9px] bg-[#f2f2f3] px-[22px] text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-[#141417] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {m.intake_detail_print()}
        </button>
      </div>

      {/*
        `onLoad`/`onError` sit on the WRAPPER on purpose: those events do not bubble in the DOM, but
        React's synthetic system does propagate them — so one pair of handlers counts every
        thumbnail without threading a callback down through three components.
      */}
      <div
        className="flex-none shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
        onLoad={() => setSettled((count) => count + 1)}
        onError={() => setSettled((count) => count + 1)}
      >
        <IntakePrintSheet key={printLocale} order={order} locale={printLocale} />
      </div>
    </div>
  )
}
