import type { ExportFaultRow } from './types.js'

function faultToken(fault: ExportFaultRow): string | null {
  switch (fault.faultType) {
    case 'employee':
      return fault.employeeName
    case 'department':
      return fault.departmentName
    case 'external':
      return fault.externalPartyName
    default: {
      const exhaustive: never = fault.faultType
      return exhaustive
    }
  }
}

export function formatGreska(faults: readonly ExportFaultRow[]): string | null {
  const tokens = faults
    .map(faultToken)
    .filter((value): value is string => value !== null && value.trim().length > 0)

  if (tokens.length === 0) {
    return null
  }

  return tokens.join(', ')
}
