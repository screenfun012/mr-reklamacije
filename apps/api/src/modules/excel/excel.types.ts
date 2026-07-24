import type { ClaimFaultItem, Finding } from '@mr/shared'

export interface ExcelActor {
  id: string
  permissions: readonly string[]
}

export interface EmotiveExportDbRow {
  id: string
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
  outcome: 'pending' | 'accepted' | 'rejected' | 'archived'
  claimYear: number
  faults: ClaimFaultItem[]
}

export interface DomaceExportDbRow {
  id: string
  sequenceNumber: number
  dateOfClaim: string | null
  dateOfFinish: string | null
  customerName: string | null
  mrNumber: string | null
  claimNumber: string | null
  invoiceNumber: string | null
  warrantyReport: string | null
  manufacturerName: string | null
  engineTypeCode: string | null
  engineCode: string | null
  employeeId: string | null
  employeeName: string | null
  outcome: 'pending' | 'accepted' | 'rejected' | 'archived'
  originalInvoiceAmount: number | null
  partsAmount: number | null
  laborAmount: number | null
  totalAmount: number | null
  findings: Finding[] | null
  claimYear: number
  faults: ClaimFaultItem[]
}

export interface EmployeeAssembledDbRow {
  employeeId: string
  employeeName: string
  year: number
  enginesAssembled: number
}
