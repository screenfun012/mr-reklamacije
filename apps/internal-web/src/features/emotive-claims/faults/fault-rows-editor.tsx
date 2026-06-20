import {
  FaultType,
  type DepartmentListItem,
  type EmployeeListItem,
  type ExternalPartyListItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button } from '@mr/ui'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { SELECT_FIELD_CLASS } from '../create/form-field-styles.js'
import type { EmotiveClaimFaultDraft } from './fault-draft.js'

interface FaultRowsEditorProps {
  value: EmotiveClaimFaultDraft[]
  onChange: (next: EmotiveClaimFaultDraft[]) => void
  departments: DepartmentListItem[]
  employees: EmployeeListItem[]
  externalParties: ExternalPartyListItem[]
  /** Field errors keyed `faults.<index>.<field>`. */
  errors: Record<string, string>
  disabled: boolean
}

/**
 * Controlled editor for a claim's fault rows (culprit attribution).
 *
 * Presentational and form-library agnostic: the create wizard drives it via a
 * TanStack `form.Field`, the detail screen via local `useState`. The
 * department→employee cascade is UI-only local state; on mount it derives each
 * employee row's department from the employee record so existing faults open
 * with the cascade pre-filled.
 */
export function FaultRowsEditor({
  value,
  onChange,
  departments,
  employees,
  externalParties,
  errors,
  disabled,
}: FaultRowsEditorProps): React.ReactElement {
  const [employeeDepartmentByIndex, setEmployeeDepartmentByIndex] = useState<
    Record<number, string>
  >(() => deriveEmployeeDepartments(value, employees))

  const replaceAt = (index: number, next: EmotiveClaimFaultDraft): void => {
    onChange(value.map((fault, i) => (i === index ? next : fault)))
  }

  return (
    <div className="flex flex-col gap-4">
      {value.map((fault, index) => (
        <div
          key={`fault-${index}`}
          className="rounded-lg border border-border p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {m.emotive_claims_create_fault_row_title({ index: index + 1 })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={disabled}
              onClick={() => {
                onChange(value.filter((_, i) => i !== index))
                setEmployeeDepartmentByIndex((prev) => reindexAfterRemoval(prev, index))
              }}
            >
              <Trash2 className="size-4" />
              {m.emotive_claims_create_fault_remove()}
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`fault-type-${index}`} className="text-sm font-medium">
              {m.emotive_claims_create_fault_type()}
            </label>
            <select
              id={`fault-type-${index}`}
              className={SELECT_FIELD_CLASS}
              value={fault.faultType}
              disabled={disabled}
              onChange={(e) => {
                const faultType = e.target.value as EmotiveClaimFaultDraft['faultType']
                if (faultType === FaultType.Employee) {
                  replaceAt(index, { faultType, employeeId: '' })
                } else if (faultType === FaultType.Department) {
                  replaceAt(index, { faultType, departmentId: '' })
                } else {
                  replaceAt(index, { faultType, externalPartyId: '' })
                }
              }}
            >
              <option value={FaultType.Department}>
                {m.emotive_claims_create_fault_type_department()}
              </option>
              <option value={FaultType.Employee}>
                {m.emotive_claims_create_fault_type_employee()}
              </option>
              <option value={FaultType.External}>
                {m.emotive_claims_create_fault_type_external()}
              </option>
            </select>
          </div>

          {fault.faultType === FaultType.Department ? (
            <FaultReferenceSelect
              id={`fault-department-${index}`}
              label={m.emotive_claims_create_fault_department()}
              value={fault.departmentId ?? ''}
              error={errors[`faults.${index}.departmentId`]}
              disabled={disabled}
              options={departments.map((department) => ({
                id: department.id,
                label: department.nameSr,
              }))}
              onChange={(departmentId) => {
                replaceAt(index, { ...fault, departmentId })
              }}
            />
          ) : null}

          {fault.faultType === FaultType.Employee ? (
            <>
              <FaultReferenceSelect
                id={`fault-employee-department-${index}`}
                label={m.emotive_claims_create_fault_department()}
                value={employeeDepartmentByIndex[index] ?? ''}
                disabled={disabled}
                options={departments.map((department) => ({
                  id: department.id,
                  label: department.nameSr,
                }))}
                onChange={(departmentId) => {
                  setEmployeeDepartmentByIndex((prev) => ({ ...prev, [index]: departmentId }))
                  replaceAt(index, { ...fault, employeeId: '' })
                }}
              />
              <FaultReferenceSelect
                id={`fault-employee-${index}`}
                label={m.emotive_claims_create_fault_employee()}
                value={fault.employeeId ?? ''}
                error={errors[`faults.${index}.employeeId`]}
                disabled={disabled || !(employeeDepartmentByIndex[index] ?? '')}
                options={employees
                  .filter((employee) => employee.department_id === employeeDepartmentByIndex[index])
                  .map((employee) => ({ id: employee.id, label: employee.full_name }))}
                onChange={(employeeId) => {
                  replaceAt(index, { ...fault, employeeId })
                }}
              />
            </>
          ) : null}

          {fault.faultType === FaultType.External ? (
            <FaultReferenceSelect
              id={`fault-external-${index}`}
              label={m.emotive_claims_create_fault_external()}
              value={fault.externalPartyId ?? ''}
              error={errors[`faults.${index}.externalPartyId`]}
              disabled={disabled}
              options={externalParties.map((party) => ({ id: party.id, label: party.name }))}
              onChange={(externalPartyId) => {
                replaceAt(index, { ...fault, externalPartyId })
              }}
            />
          ) : null}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="self-start gap-2"
        disabled={disabled}
        onClick={() => {
          onChange([...value, { faultType: FaultType.Department, departmentId: '' }])
        }}
      >
        <Plus className="size-4" />
        {m.emotive_claims_create_fault_add()}
      </Button>
    </div>
  )
}

function deriveEmployeeDepartments(
  faults: EmotiveClaimFaultDraft[],
  employees: EmployeeListItem[],
): Record<number, string> {
  const map: Record<number, string> = {}
  faults.forEach((fault, index) => {
    if (fault.faultType !== FaultType.Employee || !fault.employeeId) {
      return
    }
    const employee = employees.find((candidate) => candidate.id === fault.employeeId)
    if (employee?.department_id) {
      map[index] = employee.department_id
    }
  })
  return map
}

function reindexAfterRemoval(
  prev: Record<number, string>,
  removedIndex: number,
): Record<number, string> {
  const next: Record<number, string> = {}
  for (const [key, value] of Object.entries(prev)) {
    const rowIndex = Number(key)
    if (rowIndex < removedIndex) {
      next[rowIndex] = value
    } else if (rowIndex > removedIndex) {
      next[rowIndex - 1] = value
    }
  }
  return next
}

interface FaultReferenceSelectProps {
  id: string
  label: string
  value: string
  error?: string | undefined
  disabled: boolean
  options: { id: string; label: string }[]
  onChange: (value: string) => void
}

function FaultReferenceSelect({
  id,
  label,
  value,
  error,
  disabled,
  options,
  onChange,
}: FaultReferenceSelectProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        className={SELECT_FIELD_CLASS}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{m.emotive_claims_create_select_placeholder()}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </div>
  )
}
