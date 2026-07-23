import { describe, expect, it } from 'vitest'

import {
  computeCustomerYearStats,
  computeDepartmentFaultYearStats,
  computeEmployeeAcceptedYearStats,
  computeEmployeeClaimRateStats,
} from '../compute-emotive-export-stats.js'
import type { EmotiveExportRow, EmployeeAssembledYearRow } from '../types.js'

const baseRow: Omit<EmotiveExportRow, 'customerName' | 'outcome' | 'employeeName' | 'claimYear'> = {
  sequenceNumber: 1,
  warrantyReport: 'Test',
  engineTypeCode: 'ABC',
  dateOfClaim: '2025-01-01',
  mrNumber: '1/25',
  dateOfFinish: null,
  claimNumber: null,
  employeeId: 'emp-1',
  faults: [],
}

describe('computeCustomerYearStats', () => {
  it('counts accepted and rejected per customer and year', () => {
    const rows: EmotiveExportRow[] = [
      {
        ...baseRow,
        customerName: 'MR ENGINES',
        outcome: 'accepted',
        employeeName: 'IVAN',
        claimYear: 2025,
      },
      {
        ...baseRow,
        sequenceNumber: 2,
        customerName: 'MR ENGINES',
        outcome: 'rejected',
        employeeName: 'IVAN',
        claimYear: 2025,
      },
      {
        ...baseRow,
        sequenceNumber: 3,
        customerName: null,
        outcome: 'accepted',
        employeeName: 'IVAN',
        claimYear: 2024,
      },
    ]

    expect(computeCustomerYearStats(rows)).toEqual([
      {
        customerName: 'MR ENGINES',
        year: 2025,
        accepted: 1,
        rejected: 1,
        total: 2,
      },
      {
        customerName: 'NO NAME',
        year: 2024,
        accepted: 1,
        rejected: 0,
        total: 1,
      },
    ])
  })
})

describe('computeEmployeeClaimRateStats', () => {
  it('claim counts match emotive rows assigned to employees in the same year', () => {
    const rows: EmotiveExportRow[] = [
      {
        ...baseRow,
        customerName: 'MR ENGINES',
        outcome: 'accepted',
        employeeName: 'IVAN',
        employeeId: 'e1',
        claimYear: 2025,
      },
      {
        ...baseRow,
        sequenceNumber: 2,
        customerName: 'MR ENGINES',
        outcome: 'pending',
        employeeName: 'IVAN',
        employeeId: 'e1',
        claimYear: 2025,
      },
      {
        ...baseRow,
        sequenceNumber: 3,
        customerName: 'MR ENGINES',
        outcome: 'accepted',
        employeeName: null,
        employeeId: null,
        claimYear: 2025,
      },
    ]

    const stats = computeEmployeeClaimRateStats(rows, [])
    const ivan2025 = stats.find((row) => row.employeeName === 'IVAN' && row.year === 2025)

    expect(ivan2025?.claimCount).toBe(2)
  })

  it('computes claim rate from assembled output and assigned claims', () => {
    const rows: EmotiveExportRow[] = [
      {
        ...baseRow,
        customerName: 'MR ENGINES',
        outcome: 'accepted',
        employeeName: 'IVICA STANISAVLJEVIC',
        employeeId: 'e1',
        claimYear: 2024,
      },
      {
        ...baseRow,
        sequenceNumber: 2,
        customerName: 'MR ENGINES',
        outcome: 'rejected',
        employeeName: 'IVICA STANISAVLJEVIC',
        employeeId: 'e1',
        claimYear: 2024,
      },
    ]

    const assembled: EmployeeAssembledYearRow[] = [
      {
        employeeId: 'e1',
        employeeName: 'IVICA STANISAVLJEVIC',
        year: 2024,
        enginesAssembled: 880,
      },
    ]

    expect(computeEmployeeClaimRateStats(rows, assembled)).toEqual([
      {
        employeeName: 'IVICA STANISAVLJEVIC',
        year: 2024,
        enginesAssembled: 880,
        claimCount: 2,
        claimRate: 2 / 880,
      },
    ])
  })
})

describe('computeEmployeeAcceptedYearStats', () => {
  it('counts only accepted claims per employee', () => {
    const rows: EmotiveExportRow[] = [
      {
        ...baseRow,
        customerName: 'MR ENGINES',
        outcome: 'accepted',
        employeeName: 'DEJAN MILOVANOVIC',
        claimYear: 2025,
      },
      {
        ...baseRow,
        sequenceNumber: 2,
        customerName: 'MR ENGINES',
        outcome: 'rejected',
        employeeName: 'DEJAN MILOVANOVIC',
        claimYear: 2025,
      },
    ]

    expect(computeEmployeeAcceptedYearStats(rows)).toEqual([
      {
        employeeName: 'DEJAN MILOVANOVIC',
        year: 2025,
        acceptedCount: 1,
      },
    ])
  })
})

describe('computeDepartmentFaultYearStats', () => {
  it('counts department faults per year', () => {
    const rows: EmotiveExportRow[] = [
      {
        ...baseRow,
        customerName: 'MR ENGINES',
        outcome: 'accepted',
        employeeName: 'IVAN',
        claimYear: 2025,
        faults: [
          {
            faultType: 'department',
            employeeName: null,
            departmentName: 'ODELENJE BLOKOVA',
            externalPartyName: null,
          },
        ],
      },
    ]

    expect(computeDepartmentFaultYearStats(rows)).toEqual([
      {
        departmentName: 'ODELENJE BLOKOVA',
        year: 2025,
        faultCount: 1,
      },
    ])
  })
})
