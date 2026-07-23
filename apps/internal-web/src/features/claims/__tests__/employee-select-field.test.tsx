import type { EmployeeListItem } from '@mr/shared'
import { setLocale } from '@mr/i18n'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { EmployeeSelectField } from '../employee-select-field.js'

const ASSEMBLY_ID = '11111111-1111-4111-8111-111111111111'
const OUTSIDER_ID = '22222222-2222-4222-8222-222222222222'

const assemblyWorker: EmployeeListItem = {
  id: ASSEMBLY_ID,
  fullName: 'Sklapač Marko',
  departmentId: '33333333-3333-4333-8333-333333333333',
  departmentName: 'Sklapanje',
  isActive: true,
  usageCount: 0,
}

describe('EmployeeSelectField', () => {
  it('keeps the current assigned worker selectable even when outside the assembly list', () => {
    setLocale('sr')
    render(
      <EmployeeSelectField
        id="employeeId"
        value={OUTSIDER_ID}
        employees={[assemblyWorker]}
        disabled={false}
        currentEmployeeName="Servisni Radnik"
        aria-label="Zaduženi radnik"
        onValueChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    )

    // The claim's worker is not in the (assembly-only) list, yet stays shown so
    // editing never silently drops them.
    expect(screen.getByRole('combobox', { name: 'Zaduženi radnik' })).toHaveTextContent(
      'Servisni Radnik',
    )
  })

  it('shows a listed worker normally, without an orphan fallback', () => {
    setLocale('sr')
    render(
      <EmployeeSelectField
        id="employeeId"
        value={ASSEMBLY_ID}
        employees={[assemblyWorker]}
        disabled={false}
        aria-label="Zaduženi radnik"
        onValueChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Zaduženi radnik' })).toHaveTextContent(
      'Sklapač Marko',
    )
  })
})
