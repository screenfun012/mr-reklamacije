import {
  FaultType,
  type DepartmentListItem,
  type EmployeeListItem,
  type ExternalPartyListItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { cn, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mr/ui'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { InternalButton } from '~/components/internal-button'
import { InternalFieldGroup } from '~/components/internal-field-group'
import { InternalFieldLabel } from '~/components/internal-field'

import { FORM_CONTROL_CLASS, SELECT_EMPTY_SENTINEL } from '../create/form-field-styles.js'
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
const FAULT_TYPE_SEGMENTS = [
  { type: FaultType.Employee, label: m.emotive_claims_create_fault_type_employee },
  { type: FaultType.Department, label: m.emotive_claims_create_fault_type_department },
  { type: FaultType.External, label: m.emotive_claims_create_fault_type_external },
] as const

/**
 * A fresh draft of the chosen kind. Switching the blame CLEARS the old reference on purpose —
 * a row carries exactly one of employee/department/external (the DB has a CHECK for it), and
 * keeping the previous id around is how a claim ends up blaming two parties at once.
 */
function emptyDraftOf(type: (typeof FAULT_TYPE_SEGMENTS)[number]['type']): EmotiveClaimFaultDraft {
  if (type === FaultType.Employee) {
    return { faultType: FaultType.Employee, employeeId: '' }
  }
  if (type === FaultType.Department) {
    return { faultType: FaultType.Department, departmentId: '' }
  }
  return { faultType: FaultType.External, externalPartyId: '' }
}

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
          className="@container/fault flex flex-col gap-3 rounded-md border border-mri-border2 p-[15px]"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-mri-text2">
              {m.emotive_claims_create_fault_row_title({ index: index + 1 })}
            </p>
            <InternalButton
              type="button"
              variant="ghost"
              className="h-7 w-auto gap-1.5 px-1.5 font-mono text-[9px] tracking-[0.1em]"
              disabled={disabled}
              onClick={() => {
                onChange(value.filter((_, i) => i !== index))
                setEmployeeDepartmentByIndex((prev) => reindexAfterRemoval(prev, index))
              }}
            >
              <Trash2 className="size-3" aria-hidden="true" />
              {m.emotive_claims_create_fault_remove()}
            </InternalButton>
          </div>

          {/* The prototype's row: what happened on the left, who carries it on the right. The
              blame is three segments rather than a dropdown — there are exactly three kinds and
              the choice changes which reference is asked for next, so it has to be visible. */}
          <div className="grid gap-[12px_16px] @min-[520px]/fault:grid-cols-2">
            <InternalFieldGroup
              id={`fault-notes-${index}`}
              label={m.emotive_claims_create_fault_notes()}
            >
              <input
                id={`fault-notes-${index}`}
                type="text"
                className={FORM_CONTROL_CLASS}
                value={fault.notes ?? ''}
                disabled={disabled}
                maxLength={4000}
                onChange={(event) => {
                  replaceAt(index, { ...fault, notes: event.target.value })
                }}
              />
            </InternalFieldGroup>

            <div className="flex flex-col gap-[7px]">
              <InternalFieldLabel htmlFor={`fault-type-${index}`}>
                {m.emotive_claims_create_fault_type()}
              </InternalFieldLabel>
              <span
                role="group"
                id={`fault-type-${index}`}
                aria-label={m.emotive_claims_create_fault_type()}
                className="flex flex-wrap gap-[7px]"
              >
                {FAULT_TYPE_SEGMENTS.map((segment) => {
                  const selected = fault.faultType === segment.type
                  return (
                    <button
                      key={segment.type}
                      type="button"
                      disabled={disabled}
                      aria-pressed={selected}
                      onClick={() => replaceAt(index, emptyDraftOf(segment.type))}
                      className={cn(
                        'inline-flex h-[42px] cursor-pointer items-center rounded-lg px-[13px] text-[12.5px] transition-colors',
                        selected
                          ? 'border border-[rgba(237,28,36,.5)] bg-[rgba(237,28,36,.13)] font-bold text-mri-text'
                          : 'border border-mri-border2 font-semibold text-mri-text2 hover:border-mri-text2',
                        disabled && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      {segment.label()}
                    </button>
                  )
                })}
              </span>
            </div>
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
                  .filter((employee) => employee.departmentId === employeeDepartmentByIndex[index])
                  .map((employee) => ({ id: employee.id, label: employee.fullName }))}
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

      <InternalButton
        type="button"
        variant="dashed"
        className="h-11 w-full text-[12px] uppercase tracking-[0.06em]"
        disabled={disabled}
        onClick={() => {
          onChange([...value, { faultType: FaultType.Department, departmentId: '' }])
        }}
      >
        <Plus className="size-4" aria-hidden="true" />
        {m.emotive_claims_create_fault_add()}
      </InternalButton>
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
    if (employee?.departmentId) {
      map[index] = employee.departmentId
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
    <InternalFieldGroup id={id} label={label} error={error}>
      <Select
        value={value.length > 0 ? value : SELECT_EMPTY_SENTINEL}
        disabled={disabled}
        onValueChange={(next) => {
          onChange(next === SELECT_EMPTY_SENTINEL ? '' : next)
        }}
      >
        <SelectTrigger id={id} className={FORM_CONTROL_CLASS} aria-label={label}>
          <SelectValue placeholder={m.emotive_claims_create_select_placeholder()} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SELECT_EMPTY_SENTINEL}>
            {m.emotive_claims_create_select_placeholder()}
          </SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </InternalFieldGroup>
  )
}
