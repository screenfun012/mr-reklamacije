import { m } from '@mr/i18n'
import { INTAKE_CHECKLIST_KEYS, type IntakeOrderDetail } from '@mr/shared'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

import { INTAKE_CHECKLIST_LABELS } from '../intake-labels'
import { countConfirmed, IntakeChecklistGrid } from '../wizard/intake-checklist-grid'
import { CAPTION, CARD, DASH, FIELD_KEY } from './detail-styles'
import type { IntakeAmendEditing } from './use-intake-amend'

/**
 * The recorded condition, read back. The third state is the whole point: `IntakeChecklistSchema`
 * is `boolean | null` and the prototype's print collapses it to ✓/✕, which prints an item nobody
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
 * "Zatečeno stanje" — read and corrected by the SAME card. The prototype draws a second card for
 * the checklist in edit mode; we already have this one, and a second would render the eight rows
 * twice on one screen, one dead and one live, a finger apart.
 *
 * In edit mode the grid is the wizard's `IntakeChecklistGrid`, not a re-drawn DA/NE pair: it is the
 * only control that returns a row to "not checked" on a second tap. The price is the prototype's
 * 52×44 becoming 62px, and the third state is worth more than the number (spec §5.4).
 */
export function CardCondition({
  order,
  amend,
}: {
  order: IntakeOrderDetail
  amend?: IntakeAmendEditing | undefined
}): ReactElement {
  const checklist = amend === undefined ? order.checklist : amend.buffer.checklist
  const unchecked = INTAKE_CHECKLIST_KEYS.length - countConfirmed(checklist)

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

      {amend === undefined ? (
        <div className="grid grid-cols-2 gap-4 @min-[860px]:grid-cols-4">
          {INTAKE_CHECKLIST_KEYS.map((key) => {
            const state = conditionMark(order.checklist[key])
            return (
              <div
                key={key}
                data-testid={`condition-${key}`}
                className="flex min-w-0 items-center gap-2"
              >
                <span className={cn('flex-none font-mono text-sm font-bold', state.className)}>
                  {state.mark}
                </span>
                <span className="min-w-0 flex-1 text-[13px] text-mri-text">
                  {INTAKE_CHECKLIST_LABELS[key]()}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <IntakeChecklistGrid
          checklist={amend.buffer.checklist}
          onChange={(next) => amend.patch({ checklist: next })}
        />
      )}

      <EquipmentNote order={order} amend={amend} />
    </section>
  )
}

/**
 * Its own component rather than a branch inside the card: read mode hides an empty note entirely,
 * edit mode always offers the field, and expressing both in one place needs a nested ternary the
 * house rules forbid.
 */
function EquipmentNote({
  order,
  amend,
}: {
  order: IntakeOrderDetail
  amend?: IntakeAmendEditing | undefined
}): ReactElement | null {
  if (amend === undefined) {
    if (order.equipmentNote === null) {
      return null
    }
    return <p className="mt-3.5 text-[13.5px] italic text-mri-text2">{order.equipmentNote}</p>
  }

  return (
    <label className="mt-3.5 block">
      <span className={cn(FIELD_KEY, 'mb-[5px] block')}>{m.intake_field_equipment_note()}</span>
      <input
        type="text"
        value={amend.buffer.equipmentNote}
        onChange={(event) => amend.patch({ equipmentNote: event.target.value })}
        placeholder={m.intake_field_equipment_note_placeholder()}
        className="mri-input h-11 w-full rounded-[9px] px-3 text-sm"
      />
    </label>
  )
}
