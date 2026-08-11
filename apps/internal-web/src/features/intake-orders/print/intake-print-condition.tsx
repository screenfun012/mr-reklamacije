import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

import type { IntakePrintModel } from './intake-print-data'
import { PRINT_BAND, PRINT_FIGURE, PRINT_FIGURE_LABEL } from './intake-print-styles'

/**
 * The recorded condition. The equipment rows — as many as the order recorded, in four columns — and a
 * row nobody touched prints `—`: collapsing the third state to ✕ puts a statement nobody made onto a
 * document the customer signs (`docs/25` §4.4).
 */
export function IntakePrintCondition({ model }: { model: IntakePrintModel }): ReactElement {
  const { locale } = model

  return (
    <section>
      <div className={PRINT_BAND}>{m.intake_print_section_condition({}, { locale })}</div>

      {/* A band with nothing under it is a heading over a void on a document the customer signs, so
          the absence is stated instead of hidden — reachable only when the catalog was still empty at
          the moment the order was taken. Same reasoning as the third state above: what nobody
          recorded must read as unrecorded, not as blank paper. */}
      {model.checklist.length === 0 ? (
        <div className="mt-[9px] text-[11.5px] text-[#54555b]">
          {m.intake_print_condition_empty({}, { locale })}
        </div>
      ) : (
        <div className="mt-[9px] grid grid-cols-4 gap-x-5 gap-y-[6px] text-[11.5px]">
          {model.checklist.map((row) => (
            <div
              key={row.key}
              data-testid={`print-check-${row.key}`}
              className={cn('flex gap-2', row.muted && 'text-[#54555b]')}
            >
              <span
                className={cn(
                  'font-mono font-bold',
                  row.mark === '✗' ? 'text-[#ed1c24]' : 'text-[#17171a]',
                )}
              >
                {row.mark}
              </span>
              {row.label}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-8 border-t border-[#e6e7e9] pt-[11px]">
        <div>
          <div className={PRINT_FIGURE_LABEL}>{m.intake_print_fuel({}, { locale })}</div>
          <div className={PRINT_FIGURE}>{model.fuelLevel}/8</div>
        </div>
        <div>
          <div className={PRINT_FIGURE_LABEL}>{m.intake_print_defects({}, { locale })}</div>
          <div className={cn(PRINT_FIGURE, 'text-[#ed1c24]')}>{model.damageCount}</div>
        </div>
        <div>
          <div className={PRINT_FIGURE_LABEL}>{m.intake_print_photos({}, { locale })}</div>
          <div className={PRINT_FIGURE}>{model.photoCount}</div>
        </div>
        <div className="flex-1">
          <div className={PRINT_FIGURE_LABEL}>{m.intake_print_remarks({}, { locale })}</div>
          <div className="mt-[2px] text-[11.5px] leading-[1.5]">{model.ownerRemarks}</div>
        </div>
      </div>
    </section>
  )
}
