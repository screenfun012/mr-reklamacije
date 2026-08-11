import { getLocale, m } from '@mr/i18n'
import type { IntakeChecklistItemListItem } from '@mr/shared'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

import { intakeChecklistItemName, type IntakeChecklistByCode } from '../intake-checklist-catalog'

/**
 * Confirmed = the serviser actually said DA or NE. Counted over the CODES the caller names, not over
 * the map's own keys: step 2 counts what the catalog offers today, while a resumed order may still
 * carry a code the shop has retired since.
 */
export function countConfirmed(checklist: IntakeChecklistByCode, codes: readonly string[]): number {
  return codes.filter((code) => checklist[code] === true || checklist[code] === false).length
}

export interface IntakeChecklistGridProps {
  /** The catalog, live and active — the wizard offers what the shop offers today (plan D4). */
  items: readonly IntakeChecklistItemListItem[]
  checklist: IntakeChecklistByCode
  onChange: (checklist: IntakeChecklistByCode) => void
}

/**
 * The shop's equipment items, each a DA/NE pair rather than a single checkbox. The third state
 * matters: a row nobody touched must not read as "missing", because this document is the
 * evidence if the customer later says a jack was in the boot.
 */
export function IntakeChecklistGrid({
  items,
  checklist,
  onChange,
}: IntakeChecklistGridProps): ReactElement {
  const locale = getLocale()

  const set = (code: string, value: boolean): void => {
    // Tapping the active side again clears the row back to untouched — the only way to undo
    // a mis-tap without reloading the wizard.
    onChange({ ...checklist, [code]: checklist[code] === value ? null : value })
  }

  return (
    <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
      {items.map((item) => {
        const name = intakeChecklistItemName(item, locale)
        return (
          <div key={item.code} className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-[15px] text-mri-text">{name}</span>
            <div
              className="flex flex-none overflow-hidden rounded-[10px] border border-mri-border2"
              role="group"
              aria-label={name}
            >
              <button
                type="button"
                onClick={() => set(item.code, true)}
                aria-pressed={checklist[item.code] === true}
                className={cn(
                  'h-12 w-[62px] cursor-pointer text-[13.5px] font-extrabold uppercase tracking-[0.06em] transition-colors',
                  checklist[item.code] === true
                    ? 'bg-[rgba(31,169,113,0.16)] text-mri-ok'
                    : 'text-mri-text2 hover:bg-mri-rowhv',
                )}
              >
                {m.intake_checklist_yes()}
              </button>
              <span aria-hidden="true" className="w-px bg-mri-border2" />
              <button
                type="button"
                onClick={() => set(item.code, false)}
                aria-pressed={checklist[item.code] === false}
                className={cn(
                  'h-12 w-[62px] cursor-pointer text-[13.5px] font-extrabold uppercase tracking-[0.06em] transition-colors',
                  checklist[item.code] === false
                    ? 'bg-[rgba(237,28,36,0.16)] text-mri-redh'
                    : 'text-mri-text2 hover:bg-mri-rowhv',
                )}
              >
                {m.intake_checklist_no()}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
