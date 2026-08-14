import { getLocale, m } from '@mr/i18n'
import { intakeChecklistItemsDisplayOptions, type IntakeOrderDetail } from '@mr/shared'
import { cn } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { IntakeCheckMark, resolveIntakeChecklistRows } from '@mr/intake-document'
import { CAPTION, CARD } from './detail-styles'

/**
 * The recorded condition, read back. The third state is the whole point: the checklist holds
 * `boolean | null` and the prototype's print collapses it to ✓/✕, which prints an item nobody
 * checked as "NE" — a false statement on a document the customer signed (`docs/25` §4.4).
 */
/**
 * The colour only. The mark itself is drawn by `IntakeCheckMark` — the same drawing the printed
 * sheet uses, so the screen and the copy in the customer's hand cannot show different marks. It used
 * to be the characters ✓ and ✗, which no font we ship contains (2026-08-14).
 */
function conditionColour(value: boolean | null): string {
  if (value === true) {
    return 'text-mri-grn'
  }
  if (value === false) {
    return 'text-mri-redh'
  }
  return 'text-mri-text2'
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
  /**
   * Catalog rows first, then the ones the serviser wrote in — the same order the paper prints and
   * the wizard shows, so a signed order on screen looks like the sheet in the customer's hand.
   * Read only: after signing the record is frozen (part H), and this card never offered an edit.
   */
  const rows = [
    ...resolveIntakeChecklistRows(order.checklist, items, getLocale()),
    ...order.extraChecklist.map((row, index) => ({
      code: `extra-${index}`,
      name: row.name,
      value: row.value,
    })),
  ]
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

      {rows.length === 0 ? (
        /*
         * An order that has recorded no rows yet — a draft stopped before step 2, or an intake taken
         * while the catalog itself was empty. Without this the card was a heading over an empty
         * grid: the badge is suppressed at zero and the note is hidden, so it read as broken
         * (docs/25 §3.0). Factual, not instructional: this is a read-only view of somebody else's
         * order, so there is nothing here for the reader to do.
         *
         * `break-words`, no `truncate`: 90 % of the traffic is a tablet or a phone (Nikola,
         * 2026-08-11), and a caption that clips or widens its cell breaks the two-column grid this
         * card sits in at 390–430 px.
         */
        <p className="break-words text-[13.5px] italic text-mri-text2">
          {m.intake_condition_empty()}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 @min-[860px]:grid-cols-4">
          {rows.map((row) => {
            const colour = conditionColour(row.value)
            return (
              <div
                key={row.code}
                data-testid={`condition-${row.code}`}
                className="flex min-w-0 items-center gap-2"
              >
                <span className={cn('flex-none font-mono text-sm font-bold', colour)}>
                  <IntakeCheckMark value={row.value} />
                </span>
                <span className="min-w-0 flex-1 text-[13px] text-mri-text">{row.name}</span>
              </div>
            )
          })}
        </div>
      )}

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
