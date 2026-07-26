import { m } from '@mr/i18n'
import { IntakeOrderStatus, type IntakeOrderSummary } from '@mr/shared'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

import { INTAKE_STATUS_LABELS, INTAKE_STATUS_ORDER } from './intake-status'

/**
 * The four KPI cards, to the prototype's numbers: `radius 13px`, `padding 15px 17px`, a 6px
 * status dot before a mono 9.5px label, and the value at `700 27px` mono with 8px above it.
 *
 * Plain cards, not buttons — the prototype does not make them filter shortcuts, and the
 * segmented control right below already does that job.
 *
 * They double as a serviser's dashboard (he never sees the claim-shaped home screen), so they
 * count what he can act on: signed orders only, never half-entered intakes (docs/25 §3.3).
 */
const CARD_ACCENTS: Record<IntakeOrderStatus, { border: string; dot: string }> = {
  [IntakeOrderStatus.Received]: { border: 'border-[rgba(46,144,250,0.35)]', dot: 'bg-mri-info' },
  [IntakeOrderStatus.InProgress]: { border: 'border-[rgba(245,166,35,0.35)]', dot: 'bg-mri-warn' },
  [IntakeOrderStatus.Done]: { border: 'border-[rgba(31,169,113,0.35)]', dot: 'bg-mri-ok' },
  [IntakeOrderStatus.PickedUp]: { border: 'border-mri-border', dot: 'bg-mri-archived' },
}

const SUMMARY_KEYS: Record<IntakeOrderStatus, keyof IntakeOrderSummary> = {
  [IntakeOrderStatus.Received]: 'primljeno',
  [IntakeOrderStatus.InProgress]: 'uRadu',
  [IntakeOrderStatus.Done]: 'gotovo',
  [IntakeOrderStatus.PickedUp]: 'preuzeto',
}

export interface IntakeKpiCardsProps {
  summary: IntakeOrderSummary
}

export function IntakeKpiCards({ summary }: IntakeKpiCardsProps): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {INTAKE_STATUS_ORDER.map((status) => {
        const accent = CARD_ACCENTS[status]

        return (
          <div
            key={status}
            className={cn(
              'rounded-[13px] border bg-mri-surface px-[17px] py-[15px]',
              accent.border,
            )}
          >
            <div className="flex items-center gap-[7px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-mri-text2">
              <span aria-hidden="true" className={cn('size-1.5 rounded-full', accent.dot)} />
              {INTAKE_STATUS_LABELS[status]()}
            </div>
            <div className="mt-2 font-mono text-[27px] font-bold leading-none text-mri-text">
              {summary[SUMMARY_KEYS[status]]}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function IntakeKpiCardsSkeleton(): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={m.common_loading()}>
      {INTAKE_STATUS_ORDER.map((status) => (
        <div
          key={status}
          className="h-[84px] animate-pulse rounded-[13px] border border-mri-border bg-mri-surface"
        />
      ))}
    </div>
  )
}
