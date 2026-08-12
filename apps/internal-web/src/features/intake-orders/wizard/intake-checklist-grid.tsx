import { getLocale, m } from '@mr/i18n'
import type { IntakeChecklistItemListItem, IntakeExtraChecklist } from '@mr/shared'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

import { intakeChecklistItemName, type IntakeChecklistByCode } from '../intake-checklist-catalog'

/**
 * Confirmed = the serviser actually said DA or NE. Counted over the CODES the caller names, not over
 * the map's own keys: step 2 counts what the catalog offers today, while a resumed order may still
 * carry a code the shop has retired since. Rows the serviser wrote in himself count too — they print
 * in the same band and assert the same thing.
 */
export function countConfirmed(
  checklist: IntakeChecklistByCode,
  codes: readonly string[],
  extra: IntakeExtraChecklist = [],
): number {
  const answered = (value: boolean | null | undefined): boolean => value === true || value === false

  return (
    codes.filter((code) => answered(checklist[code])).length +
    extra.filter((row) => answered(row.value)).length
  )
}

/**
 * One row's DA/NE pair. Its own component because catalog rows and written-in rows are the same
 * control over different storage — a copy would be two places to keep the third state right in.
 */
function IntakeYesNoPair({
  label,
  value,
  onSet,
}: {
  label: string
  value: boolean | null | undefined
  onSet: (next: boolean) => void
}): ReactElement {
  return (
    <div
      className="flex flex-none overflow-hidden rounded-[10px] border border-mri-border2"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        onClick={() => onSet(true)}
        aria-pressed={value === true}
        className={cn(
          'h-12 w-[62px] cursor-pointer text-[13.5px] font-extrabold uppercase tracking-[0.06em] transition-colors',
          value === true
            ? 'bg-[rgba(31,169,113,0.16)] text-mri-ok'
            : 'text-mri-text2 hover:bg-mri-rowhv',
        )}
      >
        {m.intake_checklist_yes()}
      </button>
      <span aria-hidden="true" className="w-px bg-mri-border2" />
      <button
        type="button"
        onClick={() => onSet(false)}
        aria-pressed={value === false}
        className={cn(
          'h-12 w-[62px] cursor-pointer text-[13.5px] font-extrabold uppercase tracking-[0.06em] transition-colors',
          value === false
            ? 'bg-[rgba(237,28,36,0.16)] text-mri-redh'
            : 'text-mri-text2 hover:bg-mri-rowhv',
        )}
      >
        {m.intake_checklist_no()}
      </button>
    </div>
  )
}

export interface IntakeChecklistGridProps {
  /** The catalog, live and active — the wizard offers what the shop offers today (plan D4). */
  items: readonly IntakeChecklistItemListItem[]
  checklist: IntakeChecklistByCode
  onChange: (checklist: IntakeChecklistByCode) => void
  /** Rows the serviser wrote in on this order alone; the catalog stays the admin's (docs/13). */
  extra: IntakeExtraChecklist
  onExtraChange: (extra: IntakeExtraChecklist) => void
}

/**
 * The shop's equipment items, each a DA/NE pair rather than a single checkbox. The third state
 * matters: a row nobody touched must not read as "missing", because this document is the
 * evidence if the customer later says a jack was in the boot.
 *
 * Written-in rows sit UNDER the catalog ones, in the same shape, and only they carry a `✕` — the
 * catalog is not the serviser's to edit from here.
 */
export function IntakeChecklistGrid({
  items,
  checklist,
  onChange,
  extra,
  onExtraChange,
}: IntakeChecklistGridProps): ReactElement {
  const locale = getLocale()

  const set = (code: string, value: boolean): void => {
    // Tapping the active side again clears the row back to untouched — the only way to undo
    // a mis-tap without reloading the wizard.
    onChange({ ...checklist, [code]: checklist[code] === value ? null : value })
  }

  const setExtra = (index: number, value: boolean): void => {
    onExtraChange(
      extra.map((row, i) =>
        i === index ? { ...row, value: row.value === value ? null : value } : row,
      ),
    )
  }

  return (
    <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
      {items.map((item) => {
        const name = intakeChecklistItemName(item, locale)
        return (
          <div key={item.code} className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-[15px] text-mri-text">{name}</span>
            <IntakeYesNoPair
              label={name}
              value={checklist[item.code]}
              onSet={(next) => set(item.code, next)}
            />
          </div>
        )
      })}

      {/*
        Full width, not half like the catalog rows: a written-in row carries a ✕ the others do not,
        and in a half column that button ate enough room to truncate the name — measured in the
        browser, "Gumeni patosnici" came out as "Gumeni …". A worker who has just typed a name and
        cannot read it back has no way to tell a typo from a correct entry.
      */}
      {extra.map((row, index) => (
        <div
          key={`${row.name}-${index}`}
          className="flex items-center justify-between gap-3 sm:col-span-2"
        >
          <span className="min-w-0 flex-1 truncate text-[15px] text-mri-text">{row.name}</span>
          <button
            type="button"
            aria-label={m.intake_extra_remove()}
            onClick={() => onExtraChange(extra.filter((_, i) => i !== index))}
            className="h-9 w-9 flex-none cursor-pointer rounded-[8px] text-[15px] text-mri-text2 transition-colors hover:text-mri-redh"
          >
            ✕
          </button>
          <IntakeYesNoPair
            label={row.name}
            value={row.value}
            onSet={(next) => setExtra(index, next)}
          />
        </div>
      ))}
    </div>
  )
}
