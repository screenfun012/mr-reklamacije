import { getLocale, m } from '@mr/i18n'
import { intakeChecklistItemsDisplayOptions, type IntakeOrderDetail } from '@mr/shared'
import { cn } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactElement } from 'react'

import { INTAKE_VEHICLE_TYPE_LABELS } from '../intake-labels'
import type { IntakePrintLocale } from './intake-print-data'
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
          onClick={() => window.print()}
          className="h-[42px] cursor-pointer rounded-[9px] bg-[#f2f2f3] px-[22px] text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-[#141417] disabled:cursor-not-allowed disabled:opacity-50"
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
      <div className="flex-none shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        <IntakePrintSheet
          key={printLocale}
          order={order}
          checklistItems={checklistItems}
          locale={printLocale}
        />
      </div>
    </div>
  )
}
