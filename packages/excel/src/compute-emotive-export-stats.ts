import type { EmotiveExportRow, EmployeeAssembledYearRow } from './types.js'

export interface CustomerYearStatRow {
  customerName: string
  year: number
  accepted: number
  rejected: number
  total: number
}

export interface EmployeeAcceptedYearStatRow {
  employeeName: string
  year: number
  acceptedCount: number
}

export interface EmployeeClaimRateStatRow {
  employeeName: string
  year: number
  enginesAssembled: number | null
  claimCount: number
  claimRate: number | null
}

export interface DepartmentFaultYearStatRow {
  departmentName: string
  year: number
  faultCount: number
}

const NO_CUSTOMER_LABEL = 'NO NAME'

export function resolveCustomerLabel(customerName: string | null | undefined): string {
  const trimmed = customerName?.trim()
  if (trimmed === undefined || trimmed.length === 0) {
    return NO_CUSTOMER_LABEL
  }

  return trimmed
}

export function computeCustomerYearStats(rows: readonly EmotiveExportRow[]): CustomerYearStatRow[] {
  const totals = new Map<string, CustomerYearStatRow>()

  for (const row of rows) {
    if (row.outcome !== 'accepted' && row.outcome !== 'rejected') {
      continue
    }

    const customerName = resolveCustomerLabel(row.customerName)
    const key = `${row.claimYear}\0${customerName}`
    const existing = totals.get(key) ?? {
      customerName,
      year: row.claimYear,
      accepted: 0,
      rejected: 0,
      total: 0,
    }

    if (row.outcome === 'accepted') {
      existing.accepted += 1
    } else {
      existing.rejected += 1
    }

    existing.total = existing.accepted + existing.rejected
    totals.set(key, existing)
  }

  return [...totals.values()].sort((left, right) => {
    if (left.year !== right.year) {
      return right.year - left.year
    }

    return left.customerName.localeCompare(right.customerName, 'sr')
  })
}

export function computeEmployeeAcceptedYearStats(
  rows: readonly EmotiveExportRow[],
): EmployeeAcceptedYearStatRow[] {
  const totals = new Map<string, EmployeeAcceptedYearStatRow>()

  for (const row of rows) {
    if (row.outcome !== 'accepted') {
      continue
    }

    const employeeName = row.employeeName?.trim()
    if (employeeName === undefined || employeeName.length === 0) {
      continue
    }

    const key = `${row.claimYear}\0${employeeName}`
    const existing = totals.get(key) ?? {
      employeeName,
      year: row.claimYear,
      acceptedCount: 0,
    }

    existing.acceptedCount += 1
    totals.set(key, existing)
  }

  return [...totals.values()].sort((left, right) => {
    if (left.year !== right.year) {
      return right.year - left.year
    }

    return left.employeeName.localeCompare(right.employeeName, 'sr')
  })
}

function assembledLookupKey(employeeId: string | null, employeeName: string, year: number): string {
  if (employeeId !== null) {
    return `${year}\0${employeeId}`
  }

  return `${year}\0name:${employeeName}`
}

export function computeEmployeeClaimRateStats(
  rows: readonly EmotiveExportRow[],
  assembledRows: readonly EmployeeAssembledYearRow[],
): EmployeeClaimRateStatRow[] {
  const assembledByKey = new Map<string, number>()
  for (const row of assembledRows) {
    assembledByKey.set(
      assembledLookupKey(row.employeeId, row.employeeName, row.year),
      row.enginesAssembled,
    )
  }

  const claimCounts = new Map<string, EmployeeClaimRateStatRow>()

  for (const row of rows) {
    const employeeName = row.employeeName?.trim()
    if (employeeName === undefined || employeeName.length === 0) {
      continue
    }

    const key = assembledLookupKey(row.employeeId, employeeName, row.claimYear)
    const existing = claimCounts.get(key) ?? {
      employeeName,
      year: row.claimYear,
      enginesAssembled: assembledByKey.get(key) ?? null,
      claimCount: 0,
      claimRate: null,
    }

    existing.claimCount += 1
    claimCounts.set(key, existing)
  }

  for (const assembled of assembledRows) {
    const key = assembledLookupKey(assembled.employeeId, assembled.employeeName, assembled.year)
    if (claimCounts.has(key)) {
      continue
    }

    claimCounts.set(key, {
      employeeName: assembled.employeeName,
      year: assembled.year,
      enginesAssembled: assembled.enginesAssembled,
      claimCount: 0,
      claimRate: null,
    })
  }

  return [...claimCounts.values()]
    .map((row) => ({
      ...row,
      claimRate:
        row.enginesAssembled !== null && row.enginesAssembled > 0
          ? row.claimCount / row.enginesAssembled
          : null,
    }))
    .sort((left, right) => {
      if (left.year !== right.year) {
        return right.year - left.year
      }

      return left.employeeName.localeCompare(right.employeeName, 'sr')
    })
}

export function computeDepartmentFaultYearStats(
  rows: readonly EmotiveExportRow[],
): DepartmentFaultYearStatRow[] {
  const totals = new Map<string, DepartmentFaultYearStatRow>()

  for (const row of rows) {
    for (const fault of row.faults) {
      if (fault.faultType !== 'department') {
        continue
      }

      const departmentName = fault.departmentName?.trim()
      if (departmentName === undefined || departmentName.length === 0) {
        continue
      }

      const key = `${row.claimYear}\0${departmentName}`
      const existing = totals.get(key) ?? {
        departmentName,
        year: row.claimYear,
        faultCount: 0,
      }

      existing.faultCount += 1
      totals.set(key, existing)
    }
  }

  return [...totals.values()].sort((left, right) => {
    if (left.year !== right.year) {
      return right.year - left.year
    }

    return left.departmentName.localeCompare(right.departmentName, 'sr')
  })
}

export function distinctClaimYears(rows: readonly EmotiveExportRow[]): number[] {
  return [...new Set(rows.map((row) => row.claimYear))].sort((left, right) => right - left)
}
