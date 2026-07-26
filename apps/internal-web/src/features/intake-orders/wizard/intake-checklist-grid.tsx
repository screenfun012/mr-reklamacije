import { m } from '@mr/i18n'
import { INTAKE_CHECKLIST_KEYS, type IntakeChecklist, type IntakeChecklistKey } from '@mr/shared'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

const ITEM_LABELS: Record<IntakeChecklistKey, () => string> = {
  rezervna: m.intake_checklist_rezervna,
  dizalica: m.intake_checklist_dizalica,
  komplet: m.intake_checklist_komplet,
  saobracajna: m.intake_checklist_saobracajna,
  vozacka: m.intake_checklist_vozacka,
  prvaPomoc: m.intake_checklist_prva_pomoc,
  prsluk: m.intake_checklist_prsluk,
  lanci: m.intake_checklist_lanci,
}

export function countConfirmed(checklist: IntakeChecklist): number {
  return INTAKE_CHECKLIST_KEYS.filter((key) => checklist[key] !== null).length
}

export interface IntakeChecklistGridProps {
  checklist: IntakeChecklist
  onChange: (checklist: IntakeChecklist) => void
}

/**
 * Eight equipment items, each a DA/NE pair rather than a single checkbox. The third state
 * matters: a row nobody touched must not read as "missing", because this document is the
 * evidence if the customer later says a jack was in the boot.
 */
export function IntakeChecklistGrid({
  checklist,
  onChange,
}: IntakeChecklistGridProps): ReactElement {
  const set = (key: IntakeChecklistKey, value: boolean): void => {
    // Tapping the active side again clears the row back to untouched — the only way to undo
    // a mis-tap without reloading the wizard.
    onChange({ ...checklist, [key]: checklist[key] === value ? null : value })
  }

  return (
    <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
      {INTAKE_CHECKLIST_KEYS.map((key) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-[15px] text-mri-text">
            {ITEM_LABELS[key]()}
          </span>
          <div
            className="flex flex-none overflow-hidden rounded-[10px] border border-mri-border2"
            role="group"
            aria-label={ITEM_LABELS[key]()}
          >
            <button
              type="button"
              onClick={() => set(key, true)}
              aria-pressed={checklist[key] === true}
              className={cn(
                'h-12 w-[62px] cursor-pointer text-[13.5px] font-extrabold uppercase tracking-[0.06em] transition-colors',
                checklist[key] === true
                  ? 'bg-[rgba(31,169,113,0.15)] text-mri-ok'
                  : 'text-mri-text2 hover:bg-mri-rowhv',
              )}
            >
              {m.intake_checklist_yes()}
            </button>
            <span aria-hidden="true" className="w-px bg-mri-border2" />
            <button
              type="button"
              onClick={() => set(key, false)}
              aria-pressed={checklist[key] === false}
              className={cn(
                'h-12 w-[62px] cursor-pointer text-[13.5px] font-extrabold uppercase tracking-[0.06em] transition-colors',
                checklist[key] === false
                  ? 'bg-[rgba(224,92,82,0.15)] text-mri-bad'
                  : 'text-mri-text2 hover:bg-mri-rowhv',
              )}
            >
              {m.intake_checklist_no()}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
