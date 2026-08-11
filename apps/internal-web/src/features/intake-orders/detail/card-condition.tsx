import { getLocale, m } from '@mr/i18n'
import { intakeChecklistItemsDisplayOptions, type IntakeOrderDetail } from '@mr/shared'
import { cn } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { resolveIntakeChecklistRows } from '../intake-checklist-catalog'
import { CAPTION, CARD, DASH } from './detail-styles'

/**
 * The recorded condition, read back. The third state is the whole point: the checklist holds
 * `boolean | null` and the prototype's print collapses it to ✓/✕, which prints an item nobody
 * checked as "NE" — a false statement on a document the customer signed (`docs/25` §4.4).
 */
function conditionMark(value: boolean | null): { mark: string; className: string } {
  if (value === true) {
    return { mark: '✓', className: 'text-mri-grn' }
  }
  if (value === false) {
    return { mark: '✗', className: 'text-mri-redh' }
  }
  return { mark: DASH, className: 'text-mri-text2' }
}

/**
 * "Zatečeno stanje" — a pure read of what was recorded at intake. The record is frozen the moment
 * both parties sign it (docs/25 §3.0), so this card has had nothing to correct since H.
 *
 * The rows are the ones the ORDER recorded, and only their names come from the catalog (plan D4):
 * an item the office added this morning must not appear on a work order signed last month. The
 * DISPLAY reader is the one to use here — it carries deactivated and removed items too, so a row a
 * customer signed for keeps its name instead of printing as a bare code (plan D3).
 */
export function CardCondition({ order }: { order: IntakeOrderDetail }): ReactElement {
  const { data: items = [] } = useQuery(intakeChecklistItemsDisplayOptions())
  const rows = resolveIntakeChecklistRows(order.checklist, items, getLocale())
  const unchecked = rows.filter((row) => row.value === null).length

  return (
    <section className={cn(CARD, 'px-5 py-[18px]')}>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <h2 className={CAPTION}>{m.intake_card_condition()}</h2>
        {unchecked > 0 ? (
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-mri-text2">
            {m.intake_condition_unchecked({ count: unchecked })}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 @min-[860px]:grid-cols-4">
        {rows.map((row) => {
          const state = conditionMark(row.value)
          return (
            <div
              key={row.code}
              data-testid={`condition-${row.code}`}
              className="flex min-w-0 items-center gap-2"
            >
              <span className={cn('flex-none font-mono text-sm font-bold', state.className)}>
                {state.mark}
              </span>
              <span className="min-w-0 flex-1 text-[13px] text-mri-text">{row.name}</span>
            </div>
          )
        })}
      </div>

      <EquipmentNote order={order} />
    </section>
  )
}

/** Its own component rather than a branch inline: read mode hides an empty note entirely. */
function EquipmentNote({ order }: { order: IntakeOrderDetail }): ReactElement | null {
  if (order.equipmentNote === null) {
    return null
  }
  return <p className="mt-3.5 text-[13.5px] italic text-mri-text2">{order.equipmentNote}</p>
}
