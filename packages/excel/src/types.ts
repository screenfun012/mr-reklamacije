export interface ExportFaultRow {
  faultType: 'employee' | 'department' | 'external'
  employeeName: string | null
  departmentName: string | null
  externalPartyName: string | null
}

export interface EmotiveExportRow {
  sequenceNumber: number
  warrantyReport: string | null
  engineTypeCode: string
  dateOfClaim: string | null
  mrNumber: string
  dateOfFinish: string | null
  claimNumber: string | null
  employeeName: string | null
  faults: readonly ExportFaultRow[]
  sourceName: string | null
  claimYear: number
}

export interface DomaceExportRow {
  sequenceNumber: number
  dateOfClaim: string | null
  customerName: string | null
  outcome: 'pending' | 'accepted' | 'rejected' | 'archived'
  totalAmount: number | null
  employeeName: string | null
  internalNotes: string | null
}

export interface ReklamacijeWorkbookInput {
  emotiveRows: readonly EmotiveExportRow[]
  domaceRows: readonly DomaceExportRow[]
  includeEmotive: boolean
  includeDomace: boolean
  exportedAt?: Date
}
