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
  /**
   * Name of the currently-assigned worker. The list is now limited to assembly
   * workers, so a claim assigned to someone outside that set would otherwise lose
   * its value on edit — keep them selectable so editing never silently clears it.
   */
  currentEmployeeName?: string | undefined
}

/**
 * Claim-level "Zaduženi radnik" (assigned worker) picker, shared by the EMOTIVE
 * and DOMACE basic-field forms (create + edit). Optional: the empty option maps
 * back to '' so the caller sends `undefined`/`null`.
 *
 * When the list comes back EMPTY it says why. The EMOTIVE list is limited to departments the
 * office marked as providing assigned workers, so a shop full of employees who carry no
 * department at all offers nothing here — and an empty dropdown beside a screenful of workers
 * in the admin panel reads as a broken field rather than as a catalogue that needs one setting
 * (found 2026-08-21: 14 active employees, every one of them without a department).
 */
export function EmployeeSelectField({
  id,
  value,
  employees,
  disabled,
  onValueChange,
  onBlur,
  'aria-label': ariaLabel,
  currentEmployeeName,
}: EmployeeSelectFieldProps): React.ReactElement {
  const currentIsListed = value.length > 0 && employees.some((employee) => employee.id === value)
  const noneAssignable = employees.length === 0

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        value={value.length > 0 ? value : SELECT_EMPTY_SENTINEL}
        onValueChange={(next) => onValueChange(next === SELECT_EMPTY_SENTINEL ? '' : next)}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className={FORM_CONTROL_CLASS}
          aria-label={ariaLabel}
          onBlur={onBlur}
        >
          <SelectValue placeholder={m.emotive_claims_create_select_placeholder()} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SELECT_EMPTY_SENTINEL}>
            {m.emotive_claims_create_select_placeholder()}
          </SelectItem>
          {!currentIsListed && value.length > 0 ? (
            <SelectItem value={value}>{currentEmployeeName ?? value}</SelectItem>
          ) : null}
          {employees.map((employee) => (
            <SelectItem key={employee.id} value={employee.id}>
              {employee.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {noneAssignable ? (
        <p className="text-[11.5px] italic text-mri-text2">{m.claims_assigned_worker_none()}</p>
      ) : null}
    </div>
  )
}
