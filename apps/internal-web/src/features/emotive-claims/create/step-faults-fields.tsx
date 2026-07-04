import type { DepartmentListItem, EmployeeListItem, ExternalPartyListItem } from '@mr/shared'
import { m } from '@mr/i18n'

import { InternalNote } from '~/components/internal-note'

import { FaultRowsEditor } from '../faults/fault-rows-editor.js'
import type { EmotiveClaimFaultDraft } from './emotive-claim-create-schemas.js'

interface StepFaultsFieldsProps {
  form: {
    Field: React.ComponentType<{
      name: 'faults'
      mode?: 'array'
      children: (field: {
        state: { value: EmotiveClaimFaultDraft[] }
        handleChange: (value: EmotiveClaimFaultDraft[]) => void
      }) => React.ReactNode
    }>
  }
  departments: DepartmentListItem[]
  employees: EmployeeListItem[]
  externalParties: ExternalPartyListItem[]
  stepErrors: Record<string, string>
  disabled: boolean
}

export function StepFaultsFields({
  form,
  departments,
  employees,
  externalParties,
  stepErrors,
  disabled,
}: StepFaultsFieldsProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <InternalNote tone="info">{m.emotive_claims_create_faults_optional_note()}</InternalNote>

      <form.Field
        name="faults"
        mode="array"
        children={(field) => (
          <FaultRowsEditor
            value={field.state.value}
            onChange={(next) => field.handleChange(next)}
            departments={departments}
            employees={employees}
            externalParties={externalParties}
            errors={stepErrors}
            disabled={disabled}
          />
        )}
      />
    </div>
  )
}
