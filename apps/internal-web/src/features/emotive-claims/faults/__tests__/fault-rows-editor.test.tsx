import {
  FaultType,
  type DepartmentListItem,
  type EmployeeListItem,
  type ExternalPartyListItem,
} from '@mr/shared'
import { m, setLocale } from '@mr/i18n'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('adds a fault row defaulting to a department culprit', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(
      screen.queryByRole('combobox', { name: m.emotive_claims_create_fault_type() }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: m.emotive_claims_create_fault_add() }))

    expect(
      screen.getByRole('combobox', { name: m.emotive_claims_create_fault_type() }),
    ).toHaveTextContent(m.emotive_claims_create_fault_type_department())
    expect(
      screen.getByRole('combobox', { name: m.emotive_claims_create_fault_department() }),
    ).toBeInTheDocument()
  })

  it('removes a fault row', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        initial={[
          { faultType: FaultType.Department, departmentId: 'dep-1' },
          { faultType: FaultType.External, externalPartyId: 'ext-1' },
        ]}
      />,
    )

    expect(
      screen.getAllByRole('combobox', { name: m.emotive_claims_create_fault_type() }),
    ).toHaveLength(2)

    await user.click(
      screen.getAllByRole('button', { name: m.emotive_claims_create_fault_remove() })[0]!,
    )

    expect(
      screen.getAllByRole('combobox', { name: m.emotive_claims_create_fault_type() }),
    ).toHaveLength(1)
  })

  it('keeps the employee select disabled until a department is chosen, then filters by it', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ faultType: FaultType.Employee, employeeId: '' }]} />)

    const employeeSelect = screen.getByRole('combobox', {
      name: m.emotive_claims_create_fault_employee(),
    })
    expect(employeeSelect).toBeDisabled()

    await user.click(
      screen.getByRole('combobox', { name: m.emotive_claims_create_fault_department() }),
    )
    await user.click(screen.getByRole('option', { name: 'Glave' }))

    expect(employeeSelect).toBeEnabled()

    await user.click(employeeSelect)
    const optionLabels = screen.getAllByRole('option').map((option) => option.textContent?.trim())
    expect(optionLabels).toContain('Ana Anić')
    expect(optionLabels).toContain('Bojan Bojić')
    expect(optionLabels).not.toContain('Vera Verić')
  })

  it('records a note typed into a fault row', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ faultType: FaultType.Department, departmentId: 'dep-1' }]} />)

    const notes = screen.getByRole('textbox', { name: m.emotive_claims_create_fault_notes() })
    await user.type(notes, 'Curi ulje')

    expect(notes).toHaveValue('Curi ulje')
  })

  it('resets the culprit field when the fault type changes', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ faultType: FaultType.Department, departmentId: 'dep-1' }]} />)

    expect(
      screen.getByRole('combobox', { name: m.emotive_claims_create_fault_department() }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: m.emotive_claims_create_fault_type() }))
    await user.click(
      screen.getByRole('option', { name: m.emotive_claims_create_fault_type_external() }),
    )

    expect(
      screen.queryByRole('combobox', { name: m.emotive_claims_create_fault_department() }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: m.emotive_claims_create_fault_external() }),
    ).toHaveTextContent(m.emotive_claims_create_select_placeholder())
  })
})
