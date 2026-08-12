import { m } from '@mr/i18n'
import type { IntakeChecklistItemListItem } from '@mr/shared'
import type { ReactElement } from 'react'

import { InternalFieldGroup } from '~/components/internal-field-group'
import { IntakeChecklistGrid, countConfirmed } from './intake-checklist-grid'
import { IntakeExtraRowAdder } from './intake-extra-row-adder'
import { IntakeFuelGauge } from './intake-fuel-gauge'
import { IntakePanel } from './intake-panel'
import type { IntakeWizardValues } from './intake-wizard-state'

export interface StepChecklistProps {
  values: IntakeWizardValues
  /** The catalog as it stands today, active items only — the picker (plan D3). */
  items: readonly IntakeChecklistItemListItem[]
  onPatch: (patch: Partial<IntakeWizardValues>) => void
}

export function StepChecklist({ values, items, onPatch }: StepChecklistProps): ReactElement {
  const codes = items.map((item) => item.code)
  const confirmed = countConfirmed(values.checklist, codes, values.extraChecklist)
  // The catalog PLUS what the serviser wrote in — never a literal. A total that does not move when
  // the list under it does is the same bug the browser caught in part B ("Korak 2 / 5" over four).
  const total = items.length + values.extraChecklist.length

  return (
    // `items-stretch` is what makes the two cards end level, as step 1 and the prototype already
    // do; `items-start` left the shorter gauge card floating above the checklist's bottom edge.
    <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
      <IntakePanel
        title={m.intake_card_fuel()}
        className="w-full items-center lg:w-[330px] lg:flex-none"
      >
        <IntakeFuelGauge
          eighths={values.fuelLevel}
          onChange={(fuelLevel) => onPatch({ fuelLevel })}
        />
      </IntakePanel>

      <IntakePanel
        title={m.intake_card_condition()}
        className="min-w-0 flex-1"
        action={
          // Nothing to count while there is nothing at all, and "0 / 0 potvrđeno" over an
          // instruction reads as a broken screen rather than an unfinished setup. A written-in row
          // is something to count even with the catalog empty.
          total === 0 ? undefined : (
            <span className="font-mono text-[11px] uppercase text-mri-text2">
              {m.intake_checklist_confirmed({ confirmed, total })}
            </span>
          )
        }
      >
        {total === 0 ? (
          // A fresh database has no checklist until the office fills one in, and an empty card is a
          // dead end the serviser cannot get out of (docs/25 §3.0). Say who adds them, and where —
          // and the adder below still lets him record what he is looking at.
          <p className="px-2.5 py-3 text-[13.5px] italic text-mri-text2">
            {m.intake_checklist_empty()}
          </p>
        ) : (
          <IntakeChecklistGrid
            items={items}
            checklist={values.checklist}
            onChange={(checklist) => onPatch({ checklist })}
            extra={values.extraChecklist}
            onExtraChange={(extraChecklist) => onPatch({ extraChecklist })}
          />
        )}

        <IntakeExtraRowAdder
          label={m.intake_extra_add_item()}
          placeholder={m.intake_extra_item_placeholder()}
          onAdd={(name) =>
            onPatch({ extraChecklist: [...values.extraChecklist, { name, value: null }] })
          }
        />

        <InternalFieldGroup id="intake-equipment-note" label={m.intake_field_equipment_note()}>
          <textarea
            id="intake-equipment-note"
            value={values.equipmentNote}
            onChange={(event) => onPatch({ equipmentNote: event.target.value })}
            placeholder={m.intake_field_equipment_note_placeholder()}
            rows={3}
            className="mri-input min-h-[74px] rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 py-2.5 font-sans text-[13.5px] text-mri-text outline-none"
          />
        </InternalFieldGroup>
      </IntakePanel>
    </div>
  )
}
