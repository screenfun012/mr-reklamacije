import type { ClaimCategoryFieldValues, DomaceClaimFaultInput } from '@mr/shared'
import { z } from 'zod'

import type { DomaceClaimDetail } from '@mr/shared'

import {
  domaceClaimBasicFieldsSchema,
  type DomaceClaimFormValues,
} from '../create/domace-claim-create-schemas.js'
import { faultDraftsToInput, faultItemToDraft } from '../../emotive-claims/faults/fault-draft.js'
import { m } from '@mr/i18n'

/** Client-side validation for basic-field edits on the detail screen. */
export const domaceClaimDetailBasicSchema = domaceClaimBasicFieldsSchema.refine(
  (value) => value.mrNumber.trim() !== '' || value.customerName.trim() !== '',
  {
    message: m.domace_claims_create_field_at_least_one(),
    path: ['mrNumber'],
  },
)

/**
 * The zod schema validates the typed fields; the category's own answers ride along on the form
 * but are judged by the SERVER against the catalogue, which no client schema can know.
 */
export type DomaceClaimDetailBasicValues = z.infer<typeof domaceClaimDetailBasicSchema> & {
  categoryFieldValues: ClaimCategoryFieldValues
}

/**
 * Everything "Izmeni podatke" saves on a DOMAĆA claim: the basic fields, the amounts, the
 * category's answers and the fault rows (replace-all) — one payload, one transaction.
 */
export interface DomaceClaimBasicEdit {
  categoryFieldValues: ClaimCategoryFieldValues
  mrNumber: string | null
  customerName: string | null
  claimNumber: string | null
  invoiceNumber: string | null
  manufacturerId: string | null
  categoryId: string
  engineTypeId: string | null
  engineCode: string | null
  dateOfClaim: string | null
  dateOfFinish: string | null
  employeeId: string | null
  warrantyReport: string | null
  originalInvoiceAmount: number | null
  partsAmount: number | null
  laborAmount: number | null
  faults: DomaceClaimFaultInput[]
}

function amountToInput(value: number | null): string {
  return value === null ? '' : String(value)
}

function inputToAmount(value: string): number | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : Number(trimmed)
}

export function claimToDetailBasicValues(claim: DomaceClaimDetail): DomaceClaimFormValues {
  return {
    faults: claim.faults.map(faultItemToDraft),
    mrNumber: claim.mrNumber ?? '',
    claimNumber: claim.claimNumber ?? '',
    invoiceNumber: claim.invoiceNumber ?? '',
    customerName: claim.customerName ?? '',
    manufacturerId: claim.manufacturerId ?? '',
    categoryId: claim.category?.id ?? '',
    categoryFieldValues: claim.categoryFieldValues,
    engineTypeId: claim.engineTypeId ?? '',
    engineCode: claim.engineCode ?? '',
    dateOfFinish: claim.dateOfFinish ?? '',
    dateOfClaim: claim.dateOfClaim ?? '',
    warrantyReport: claim.warrantyReport ?? '',
    employeeId: claim.employeeId ?? '',
    originalInvoiceAmount: amountToInput(claim.originalInvoiceAmount),
    partsAmount: amountToInput(claim.partsAmount),
    laborAmount: amountToInput(claim.laborAmount),
  }
}

export function detailBasicValuesToPatch(values: DomaceClaimFormValues): DomaceClaimBasicEdit {
  const mrNumber = values.mrNumber.trim()
  const customerName = values.customerName.trim()
  const claimNumber = values.claimNumber.trim()
  const invoiceNumber = values.invoiceNumber.trim()
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
    invoiceNumber: invoiceNumber === '' ? null : invoiceNumber,
    manufacturerId: manufacturerId === '' ? null : manufacturerId,
    categoryId: values.categoryId,
    categoryFieldValues: values.categoryFieldValues,
    engineTypeId: engineTypeId === '' ? null : engineTypeId,
    engineCode: engineCode === '' ? null : engineCode,
    dateOfClaim: dateOfClaim === '' ? null : dateOfClaim,
    dateOfFinish: dateOfFinish === '' ? null : dateOfFinish,
    employeeId: values.employeeId.trim() === '' ? null : values.employeeId,
    warrantyReport: warrantyReport === '' ? null : warrantyReport,
    originalInvoiceAmount: inputToAmount(values.originalInvoiceAmount),
    partsAmount: inputToAmount(values.partsAmount),
    laborAmount: inputToAmount(values.laborAmount),
    faults: faultDraftsToInput(values.faults),
  }
}
