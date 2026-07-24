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
  claimYear: number
}

/** Legacy domace sheet columns + fields needed for UKUPNO master mapping. */
export interface DomaceExportRow {
  sequenceNumber: number
  dateOfClaim: string | null
  customerName: string | null
  /** Excel D VOZILO — composed from manufacturer + engine type + engine code. */
  vehicle: string | null
  mrNumber: string | null
  /** Excel E RADNI NALOG. */
  workOrder: string | null
  /** Excel F STARI R/N — the old work order (claim_number). */
  previousWorkOrder: string | null
  /** Excel G IZNOS ORIGINALNOG RAČUNA. */
  originalInvoiceAmount: number | null
  /** Excel H BROJ RAČUNA — the real invoice number. */
  invoiceNumber: string | null
  problemDescription: string | null
  dateOfFinish: string | null
  engineTypeCode: string | null
  employeeId: string | null
  employeeName: string | null
  outcome: 'pending' | 'accepted' | 'rejected' | 'archived'
  /** Excel K IZNOS DELOVA BEZ PDV. */
  partsAmount: number | null
  /** Excel L IZNOS RADA BEZ PDV. */
  laborAmount: number | null
  /** Excel M UKUPNO — computed parts + labor. */
  totalAmount: number | null
  /** Excel O NAPOMENA — findings composed to one cell. */
  note: string | null
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
