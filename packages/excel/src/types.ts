export interface ExportFaultRow {
  faultType: 'employee' | 'department' | 'external'
  employeeName: string | null
  departmentName: string | null
  externalPartyName: string | null
}

export type EmotiveClaimOutcome = 'pending' | 'accepted' | 'rejected' | 'archived'

export interface EmotiveExportRow {
  sequenceNumber: number
  warrantyReport: string | null
  engineTypeCode: string
  dateOfClaim: string | null
  mrNumber: string
  dateOfFinish: string | null
  claimNumber: string | null
  employeeId: string | null
  employeeName: string | null
  customerName: string | null
  outcome: EmotiveClaimOutcome
  faults: readonly ExportFaultRow[]
  sourceName: string | null
  claimYear: number
}

/** Legacy domace sheet columns + fields needed for UKUPNO master mapping. */
export interface DomaceExportRow {
  sequenceNumber: number
  dateOfClaim: string | null
  customerName: string | null
  mrNumber: string | null
  workOrder: string | null
  invoiceNumber: string | null
  problemDescription: string | null
  dateOfFinish: string | null
  engineTypeCode: string | null
  employeeId: string | null
  employeeName: string | null
  outcome: 'pending' | 'accepted' | 'rejected' | 'archived'
  totalAmount: number | null
  notes: string | null
  claimYear: number
  faults: readonly ExportFaultRow[]
}

export interface EmployeeAssembledYearRow {
  employeeId: string
  employeeName: string
  year: number
  enginesAssembled: number
}

export interface ReklamacijeWorkbookInput {
  emotiveRows: readonly EmotiveExportRow[]
  domaceRows: readonly DomaceExportRow[]
  employeeAssembledByYear: readonly EmployeeAssembledYearRow[]
  includeEmotive: boolean
  includeDomace: boolean
  exportedAt?: Date
}
