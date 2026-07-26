import { m } from '@mr/i18n'
import { IntakeOrderStatus, type IntakeOrderSummary } from '@mr/shared'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

import { INTAKE_STATUS_LABELS, INTAKE_STATUS_ORDER } from './intake-status'

/**
 * The four KPI cards. They double as a serviser's dashboard — he never sees the
 * claim-shaped home screen — so they count what he can actually act on: signed orders
 * only, never half-entered intakes nobody has handed over (docs/25 §3.3).
 */
const CARD_ACCENTS: Record<IntakeOrderStatus, { border: string; dot: string }> = {
  [IntakeOrderStatus.Received]: { border: 'border-mri-info/35', dot: 'bg-mri-info' },
  [IntakeOrderStatus.InProgress]: { border: 'border-mri-warn/35', dot: 'bg-mri-warn' },
  [IntakeOrderStatus.Done]: { border: 'border-mri-ok/35', dot: 'bg-mri-ok' },
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
  /** The status the list is filtered by, so the matching card reads as selected. */
  activeStatus: IntakeOrderStatus | undefined
  onSelect: (status: IntakeOrderStatus | undefined) => void
}

export function IntakeKpiCards({
  summary,
  activeStatus,
  onSelect,
}: IntakeKpiCardsProps): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {INTAKE_STATUS_ORDER.map((status) => {
        const accent = CARD_ACCENTS[status]
        const isActive = activeStatus === status

        return (
          <button
            key={status}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(isActive ? undefined : status)}
            className={cn(
              'flex min-h-[92px] cursor-pointer flex-col justify-between rounded-[12px] border bg-mri-surface px-4 py-3.5 text-left transition-colors hover:bg-mri-rowhv',
              accent.border,
              isActive && 'ring-2 ring-mri-red/40',
            )}
          >
            <span className="flex items-center gap-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-mri-text2">
              <span aria-hidden="true" className={cn('size-1.5 rounded-full', accent.dot)} />
              {INTAKE_STATUS_LABELS[status]()}
            </span>
            <span className="font-mono text-[27px] font-bold leading-none text-mri-text">
              {summary[SUMMARY_KEYS[status]]}
            </span>
          </button>
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
          className="min-h-[92px] animate-pulse rounded-[12px] border border-mri-border bg-mri-surface"
        />
      ))}
    </div>
  )
}
