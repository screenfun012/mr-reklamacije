import type { DomaceClaimCreateInput } from '@mr/shared'

function formatDateParam(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export function serializeDomaceCreateBody(input: DomaceClaimCreateInput): Record<string, unknown> {
  return {
    mrNumber: input.mrNumber,
    claimNumber: input.claimNumber,
    customerName: input.customerName,
    manufacturerId: input.manufacturerId,
    categoryId: input.categoryId,
    engineTypeId: input.engineTypeId,
    engineCode: input.engineCode,
    dateOfClaim: input.dateOfClaim ? formatDateParam(input.dateOfClaim) : undefined,
    dateOfFinish: input.dateOfFinish ? formatDateParam(input.dateOfFinish) : undefined,
    warrantyReport: input.warrantyReport,
    employeeId: input.employeeId,
    internalNotes: input.internalNotes,
    outcome: input.outcome,
    invoiceNumber: input.invoiceNumber,
    originalInvoiceAmount: input.originalInvoiceAmount,
    partsAmount: input.partsAmount,
    laborAmount: input.laborAmount,
    faults: input.faults,
  }
}
