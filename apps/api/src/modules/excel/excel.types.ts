import type { ClaimFaultItem } from '@mr/shared'

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
  employeeName: string | null
  sourceName: string | null
  claimYear: number
  faults: ClaimFaultItem[]
}

export interface DomaceExportDbRow {
  sequenceNumber: number
  dateOfClaim: string | null
  customerName: string | null
  outcome: 'pending' | 'accepted' | 'rejected' | 'archived'
  totalAmount: number | null
  employeeName: string | null
  internalNotes: string | null
}
