import type { EmployeeListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mr/ui'

import {
  FORM_CONTROL_CLASS,
  SELECT_EMPTY_SENTINEL,
} from '../emotive-claims/create/form-field-styles.js'

interface EmployeeSelectFieldProps {
  id: string
  value: string
  employees: readonly EmployeeListItem[]
  disabled: boolean
  onValueChange: (value: string) => void
  onBlur: () => void
  'aria-label'?: string
}

/**
 * Claim-level "Zaduženi radnik" (assigned worker) picker, shared by the EMOTIVE
 * and DOMACE basic-field forms (create + edit). Optional: the empty option maps
 * back to '' so the caller sends `undefined`/`null`.
 */
export function EmployeeSelectField({
  id,
  value,
  employees,
  disabled,
  onValueChange,
  onBlur,
  'aria-label': ariaLabel,
}: EmployeeSelectFieldProps): React.ReactElement {
  return (
    <Select
      value={value.length > 0 ? value : SELECT_EMPTY_SENTINEL}
      onValueChange={(next) => onValueChange(next === SELECT_EMPTY_SENTINEL ? '' : next)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={FORM_CONTROL_CLASS} aria-label={ariaLabel} onBlur={onBlur}>
        <SelectValue placeholder={m.emotive_claims_create_select_placeholder()} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SELECT_EMPTY_SENTINEL}>
          {m.emotive_claims_create_select_placeholder()}
        </SelectItem>
        {employees.map((employee) => (
          <SelectItem key={employee.id} value={employee.id}>
            {employee.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
