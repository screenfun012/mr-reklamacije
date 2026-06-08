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

import { SELECT_FIELD_CLASS } from './form-field-styles.js'
import type { EmotiveClaimFaultDraft } from './emotive-claim-create-schemas.js'

interface StepFaultsFieldsProps {
  form: {
    Field: React.ComponentType<{
      name: 'faults'
      mode?: 'array'
      children: (field: {
        state: { value: EmotiveClaimFaultDraft[] }
        pushValue: (value: EmotiveClaimFaultDraft) => void
        removeValue: (index: number) => void
        replaceValue: (index: number, value: EmotiveClaimFaultDraft) => void
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
  const [employeeDepartmentByIndex, setEmployeeDepartmentByIndex] = useState<
    Record<number, string>
  >({})

  return (
    <div className="flex flex-col gap-4">
      <div
        role="note"
        className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
      >
        {m.emotive_claims_create_faults_optional_note()}
      </div>

      <form.Field
        name="faults"
        mode="array"
        children={(field) => (
          <div className="flex flex-col gap-4">
            {field.state.value.map((fault, index) => (
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
                      field.removeValue(index)
                      setEmployeeDepartmentByIndex((prev) => {
                        const next: Record<number, string> = {}
                        for (const [key, value] of Object.entries(prev)) {
                          const rowIndex = Number(key)
                          if (rowIndex < index) {
                            next[rowIndex] = value
                          } else if (rowIndex > index) {
                            next[rowIndex - 1] = value
                          }
                        }
                        return next
                      })
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
                        field.replaceValue(index, { faultType, employeeId: '' })
                      } else if (faultType === FaultType.Department) {
                        field.replaceValue(index, { faultType, departmentId: '' })
                      } else {
                        field.replaceValue(index, { faultType, externalPartyId: '' })
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
                    error={stepErrors[`faults.${index}.departmentId`]}
                    disabled={disabled}
                    options={departments.map((department) => ({
                      id: department.id,
                      label: department.nameSr,
                    }))}
                    onChange={(departmentId) => {
                      field.replaceValue(index, { ...fault, departmentId })
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
                        setEmployeeDepartmentByIndex((prev) => ({
                          ...prev,
                          [index]: departmentId,
                        }))
                        field.replaceValue(index, { ...fault, employeeId: '' })
                      }}
                    />
                    <FaultReferenceSelect
                      id={`fault-employee-${index}`}
                      label={m.emotive_claims_create_fault_employee()}
                      value={fault.employeeId ?? ''}
                      error={stepErrors[`faults.${index}.employeeId`]}
                      disabled={disabled || !(employeeDepartmentByIndex[index] ?? '')}
                      options={employees
                        .filter(
                          (employee) => employee.department_id === employeeDepartmentByIndex[index],
                        )
                        .map((employee) => ({
                          id: employee.id,
                          label: employee.full_name,
                        }))}
                      onChange={(employeeId) => {
                        field.replaceValue(index, { ...fault, employeeId })
                      }}
                    />
                  </>
                ) : null}

                {fault.faultType === FaultType.External ? (
                  <FaultReferenceSelect
                    id={`fault-external-${index}`}
                    label={m.emotive_claims_create_fault_external()}
                    value={fault.externalPartyId ?? ''}
                    error={stepErrors[`faults.${index}.externalPartyId`]}
                    disabled={disabled}
                    options={externalParties.map((party) => ({
                      id: party.id,
                      label: party.name,
                    }))}
                    onChange={(externalPartyId) => {
                      field.replaceValue(index, { ...fault, externalPartyId })
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
                field.pushValue({ faultType: FaultType.Department, departmentId: '' })
              }}
            >
              <Plus className="size-4" />
              {m.emotive_claims_create_fault_add()}
            </Button>
          </div>
        )}
      />
    </div>
  )
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
