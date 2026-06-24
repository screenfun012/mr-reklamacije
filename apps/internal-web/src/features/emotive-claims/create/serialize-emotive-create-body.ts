import type { EmotiveClaimCreateInput } from '@mr/shared'

function formatDateParam(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export function serializeEmotiveCreateBody(
  input: EmotiveClaimCreateInput,
): Record<string, unknown> {
  return {
    mrNumber: input.mrNumber,
    claimNumber: input.claimNumber,
    customerId: input.customerId,
    manufacturerId: input.manufacturerId,
    engineTypeId: input.engineTypeId,
    engineCode: input.engineCode,
    dateOfClaim: formatDateParam(input.dateOfClaim),
    dateOfFinish: input.dateOfFinish ? formatDateParam(input.dateOfFinish) : undefined,
    warrantyReport: input.warrantyReport,
    employeeId: input.employeeId,
    sourceId: input.sourceId,
    internalNotes: input.internalNotes,
    outcome: input.outcome,
    faults: input.faults,
  }
}
