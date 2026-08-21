import { m, setLocale } from '@mr/i18n'
import { FaultType } from '@mr/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { formatZodFieldErrors } from '../../create/emotive-claim-create-schemas.js'
import { validateFaultDrafts } from '../fault-draft.js'

describe('validateFaultDrafts messages', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('names the missing culprit in Serbian, not zod English', () => {
    // What the shop actually saw: a fault row added, nobody picked yet, the green SAČUVAJ doing
    // nothing, and "Invalid UUID" printed under the select (2026-08-21).
    const error = validateFaultDrafts([{ faultType: FaultType.Department, departmentId: '' }])

    expect(error).not.toBeNull()
    const fields = formatZodFieldErrors(error!)
    expect(fields['faults.0.departmentId']).toBe(m.emotive_claims_create_fault_culprit_required())
    expect(JSON.stringify(fields)).not.toMatch(/uuid/i)
  })

  it('says the same thing for a worker and for an outside firm', () => {
    const employee = formatZodFieldErrors(
      validateFaultDrafts([{ faultType: FaultType.Employee, employeeId: '' }])!,
    )
    const external = formatZodFieldErrors(
      validateFaultDrafts([{ faultType: FaultType.External, externalPartyId: '' }])!,
    )

    expect(employee['faults.0.employeeId']).toBe(m.emotive_claims_create_fault_culprit_required())
    expect(external['faults.0.externalPartyId']).toBe(
      m.emotive_claims_create_fault_culprit_required(),
    )
  })

  it('keys the message to the ROW, so the second fault marks the second row', () => {
    const error = validateFaultDrafts([
      { faultType: FaultType.Department, departmentId: '11111111-1111-4111-8111-111111111111' },
      { faultType: FaultType.Department, departmentId: '' },
    ])

    const fields = formatZodFieldErrors(error!)
    expect(fields['faults.0.departmentId']).toBeUndefined()
    expect(fields['faults.1.departmentId']).toBe(m.emotive_claims_create_fault_culprit_required())
  })

  it('accepts a complete row', () => {
    expect(
      validateFaultDrafts([
        { faultType: FaultType.Employee, employeeId: '22222222-2222-4222-8222-222222222222' },
      ]),
    ).toBeNull()
  })
})
