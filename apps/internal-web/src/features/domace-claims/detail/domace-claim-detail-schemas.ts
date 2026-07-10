import { z } from 'zod'

import type { DomaceClaimDetail } from '@mr/shared'

import { domaceClaimBasicFieldsSchema } from '../create/domace-claim-create-schemas.js'
import { m } from '@mr/i18n'

/** Client-side validation for basic-field edits on the detail screen. */
export const domaceClaimDetailBasicSchema = domaceClaimBasicFieldsSchema.refine(
  (value) => value.mrNumber.trim() !== '' || value.customerName.trim() !== '',
  {
    message: m.domace_claims_create_field_at_least_one(),
    path: ['mrNumber'],
  },
)

export type DomaceClaimDetailBasicValues = z.infer<typeof domaceClaimDetailBasicSchema>

export interface DomaceClaimBasicEdit {
  mrNumber: string | null
  customerName: string | null
  claimNumber: string | null
  manufacturerId: string | null
  engineTypeId: string | null
  engineCode: string | null
  dateOfClaim: string | null
  dateOfFinish: string | null
  employeeId: string | null
  warrantyReport: string | null
}

export function claimToDetailBasicValues(claim: DomaceClaimDetail): DomaceClaimDetailBasicValues {
  return {
    mrNumber: claim.mrNumber ?? '',
    claimNumber: claim.claimNumber ?? '',
    customerName: claim.customerName ?? '',
    manufacturerId: claim.manufacturerId ?? '',
    engineTypeId: claim.engineTypeId ?? '',
    engineCode: claim.engineCode ?? '',
    dateOfFinish: claim.dateOfFinish ?? '',
    dateOfClaim: claim.dateOfClaim ?? '',
    warrantyReport: claim.warrantyReport ?? '',
    employeeId: claim.employeeId ?? '',
  }
}

export function detailBasicValuesToPatch(
  values: DomaceClaimDetailBasicValues,
): DomaceClaimBasicEdit {
  const mrNumber = values.mrNumber.trim()
  const customerName = values.customerName.trim()
  const claimNumber = values.claimNumber.trim()
  const engineCode = values.engineCode.trim()
  const engineTypeId = values.engineTypeId.trim()
  const manufacturerId = values.manufacturerId.trim()
  const dateOfClaim = values.dateOfClaim.trim()
  const dateOfFinish = values.dateOfFinish.trim()
  const warrantyReport = values.warrantyReport.trim()

  return {
    mrNumber: mrNumber === '' ? null : mrNumber,
    customerName: customerName === '' ? null : customerName,
    claimNumber: claimNumber === '' ? null : claimNumber,
    manufacturerId: manufacturerId === '' ? null : manufacturerId,
    engineTypeId: engineTypeId === '' ? null : engineTypeId,
    engineCode: engineCode === '' ? null : engineCode,
    dateOfClaim: dateOfClaim === '' ? null : dateOfClaim,
    dateOfFinish: dateOfFinish === '' ? null : dateOfFinish,
    employeeId: values.employeeId.trim() === '' ? null : values.employeeId,
    warrantyReport: warrantyReport === '' ? null : warrantyReport,
  }
}
