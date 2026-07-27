import { m } from '@mr/i18n'
import { INTAKE_CHECKLIST_KEYS } from '@mr/shared'
import type { ReactElement } from 'react'

import { InternalFieldGroup } from '~/components/internal-field-group'
import { IntakeChecklistGrid, countConfirmed } from './intake-checklist-grid'
import { IntakeFuelGauge } from './intake-fuel-gauge'
import { IntakePanel } from './intake-panel'
import type { IntakeWizardValues } from './intake-wizard-state'

export interface StepChecklistProps {
  values: IntakeWizardValues
  onPatch: (patch: Partial<IntakeWizardValues>) => void
}

export function StepChecklist({ values, onPatch }: StepChecklistProps): ReactElement {
  const confirmed = countConfirmed(values.checklist)

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
          <span className="font-mono text-[11px] uppercase text-mri-text2">
            {m.intake_checklist_confirmed({
              confirmed,
              total: INTAKE_CHECKLIST_KEYS.length,
            })}
          </span>
        }
      >
        <IntakeChecklistGrid
          checklist={values.checklist}
          onChange={(checklist) => onPatch({ checklist })}
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
