import {
  FaultType,
  type DepartmentListItem,
  type EmployeeListItem,
  type ExternalPartyListItem,
} from '@mr/shared'
import { m, setLocale } from '@mr/i18n'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import type { EmotiveClaimFaultDraft } from '../fault-draft.js'
import { FaultRowsEditor } from '../fault-rows-editor.js'

const DEPARTMENTS: DepartmentListItem[] = [
  { id: 'dep-1', code: 'GLAVE', nameSr: 'Glave', nameEn: 'Heads', sortOrder: 1, isActive: true },
  { id: 'dep-2', code: 'BLOK', nameSr: 'Blok', nameEn: 'Block', sortOrder: 2, isActive: true },
]

const EMPLOYEES: EmployeeListItem[] = [
  { id: 'emp-1', full_name: 'Ana Anić', is_active: true, department_id: 'dep-1' },
  { id: 'emp-2', full_name: 'Bojan Bojić', is_active: true, department_id: 'dep-1' },
  { id: 'emp-3', full_name: 'Vera Verić', is_active: true, department_id: 'dep-2' },
]

const EXTERNAL_PARTIES: ExternalPartyListItem[] = [
  { id: 'ext-1', name: 'Dobavljač doo', kind: 'supplier', isActive: true },
]

function Harness({ initial = [] }: { initial?: EmotiveClaimFaultDraft[] }): React.ReactElement {
  const [value, setValue] = useState<EmotiveClaimFaultDraft[]>(initial)
  return (
    <FaultRowsEditor
      value={value}
      onChange={setValue}
      departments={DEPARTMENTS}
      employees={EMPLOYEES}
      externalParties={EXTERNAL_PARTIES}
      errors={{}}
      disabled={false}
    />
  )
}

describe('FaultRowsEditor', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  it('adds a fault row defaulting to a department culprit', () => {
    render(<Harness />)

    expect(screen.queryByLabelText(m.emotive_claims_create_fault_type())).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_create_fault_add() }))

    const typeSelect = screen.getByLabelText(m.emotive_claims_create_fault_type())
    expect(typeSelect).toHaveValue(FaultType.Department)
    expect(screen.getByLabelText(m.emotive_claims_create_fault_department())).toBeInTheDocument()
  })

  it('removes a fault row', () => {
    render(
      <Harness
        initial={[
          { faultType: FaultType.Department, departmentId: 'dep-1' },
          { faultType: FaultType.External, externalPartyId: 'ext-1' },
        ]}
      />,
    )

    expect(screen.getAllByLabelText(m.emotive_claims_create_fault_type())).toHaveLength(2)

    fireEvent.click(
      screen.getAllByRole('button', { name: m.emotive_claims_create_fault_remove() })[0]!,
    )

    expect(screen.getAllByLabelText(m.emotive_claims_create_fault_type())).toHaveLength(1)
  })

  it('keeps the employee select disabled until a department is chosen, then filters by it', () => {
    render(<Harness initial={[{ faultType: FaultType.Employee, employeeId: '' }]} />)

    const employeeSelect = screen.getByLabelText(m.emotive_claims_create_fault_employee())
    expect(employeeSelect).toBeDisabled()

    fireEvent.change(screen.getByLabelText(m.emotive_claims_create_fault_department()), {
      target: { value: 'dep-1' },
    })

    expect(employeeSelect).toBeEnabled()
    const optionLabels = within(employeeSelect)
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(optionLabels).toContain('Ana Anić')
    expect(optionLabels).toContain('Bojan Bojić')
    expect(optionLabels).not.toContain('Vera Verić')
  })

  it('resets the culprit field when the fault type changes', () => {
    render(<Harness initial={[{ faultType: FaultType.Department, departmentId: 'dep-1' }]} />)

    expect(screen.getByLabelText(m.emotive_claims_create_fault_department())).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(m.emotive_claims_create_fault_type()), {
      target: { value: FaultType.External },
    })

    expect(
      screen.queryByLabelText(m.emotive_claims_create_fault_department()),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText(m.emotive_claims_create_fault_external())).toHaveValue('')
  })
})
