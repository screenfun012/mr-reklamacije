import { m } from '@mr/i18n'
import { INTAKE_CHECKLIST_KEYS } from '@mr/shared'
import type { ReactElement } from 'react'

import { InternalCard, InternalCardHeader } from '~/components/internal-card'
import { InternalFieldGroup } from '~/components/internal-field-group'
import { IntakeChecklistGrid, countConfirmed } from './intake-checklist-grid'
import { IntakeFuelGauge } from './intake-fuel-gauge'
import type { IntakeWizardValues } from './intake-wizard-state'

export interface StepChecklistProps {
  values: IntakeWizardValues
  onPatch: (patch: Partial<IntakeWizardValues>) => void
}

export function StepChecklist({ values, onPatch }: StepChecklistProps): ReactElement {
  const confirmed = countConfirmed(values.checklist)

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <InternalCard className="w-full lg:w-[340px] lg:flex-none">
        <InternalCardHeader title={m.intake_card_fuel()} />
        <div className="p-5">
          <IntakeFuelGauge
            eighths={values.fuelLevel}
            onChange={(fuelLevel) => onPatch({ fuelLevel })}
          />
        </div>
      </InternalCard>

      <InternalCard className="min-w-0 flex-1">
        <InternalCardHeader
          title={m.intake_card_condition()}
          action={
            <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-mri-text2">
              {m.intake_checklist_confirmed({
                confirmed,
                total: INTAKE_CHECKLIST_KEYS.length,
              })}
            </span>
          }
        />
        <div className="flex flex-col gap-5 p-5">
          <IntakeChecklistGrid
            checklist={values.checklist}
            onChange={(checklist) => onPatch({ checklist })}
          />

          <InternalFieldGroup id="intake-equipment-note" label={m.intake_field_equipment_note()}>
            <textarea
              id="intake-equipment-note"
              value={values.equipmentNote}
              onChange={(event) => onPatch({ equipmentNote: event.target.value })}
              rows={3}
              className="mri-input min-h-[84px] rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 py-2.5 font-sans text-[13.5px] text-mri-text outline-none"
            />
          </InternalFieldGroup>
        </div>
      </InternalCard>
    </div>
  )
}
