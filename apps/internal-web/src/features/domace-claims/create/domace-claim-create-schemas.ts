import { DomaceClaimCreateInputSchema, type DomaceClaimCreateInput } from '@mr/shared'
import { z } from 'zod'

import { m } from '@mr/i18n'

import {
  faultDraftsToInput,
  type EmotiveClaimFaultDraft,
} from '../../emotive-claims/faults/fault-draft.js'

export {
  faultDraftsToInput,
  validateFaultDrafts,
  type EmotiveClaimFaultDraft as DomaceClaimFaultDraft,
} from '../../emotive-claims/faults/fault-draft.js'
export { formatZodFieldErrors } from '../../emotive-claims/create/emotive-claim-create-schemas.js'

function isValidDateString(value: string): boolean {
  if (value.trim() === '') {
    return false
  }
  return !Number.isNaN(Date.parse(value))
}

const optionalDateField = z
  .string()
  .trim()
  .refine((value) => value === '' || isValidDateString(value), {
    message: m.emotive_claims_create_field_date_invalid(),
  })

/**
 * Shared field validators for DOMACE create and detail basic edit forms.
 */
export const domaceClaimBasicFieldsSchema = z.object({
  mrNumber: z.string().trim().max(50),
  claimNumber: z.string().trim().max(50),
  customerName: z.string().trim().max(255),
  engineTypeId: z.string().trim(),
  engineCode: z.string().trim().max(100),
  dateOfFinish: optionalDateField,
  dateOfClaim: optionalDateField,
  warrantyReport: z.string().trim().max(8000),
})

const atLeastOneMrOrCustomerRefine = {
  message: m.domace_claims_create_field_at_least_one(),
  path: ['mrNumber'],
}

/**
 * Client-side validation for the DOMACE create form. Every field is optional;
 * the only hard rule is "at least one of mrNumber / customerName" (mirrors the
 * shared {@link DomaceClaimCreateInputSchema} refine). Faults are validated
 * separately via {@link validateFaultDrafts}.
 */
export const domaceClaimFormSchema = domaceClaimBasicFieldsSchema.refine(
  (value) => value.mrNumber.trim() !== '' || value.customerName.trim() !== '',
  atLeastOneMrOrCustomerRefine,
)

export type DomaceClaimFormValues = {
  mrNumber: string
  claimNumber: string
  customerName: string
  engineTypeId: string
  engineCode: string
  dateOfFinish: string
  dateOfClaim: string
  warrantyReport: string
  faults: EmotiveClaimFaultDraft[]
}

export const DOMACE_CLAIM_FORM_DEFAULTS: DomaceClaimFormValues = {
  mrNumber: '',
  claimNumber: '',
  customerName: '',
  engineTypeId: '',
  engineCode: '',
  dateOfFinish: '',
  dateOfClaim: '',
  warrantyReport: '',
  faults: [],
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

export function formValuesToCreateInput(values: DomaceClaimFormValues): DomaceClaimCreateInput {
  // total_amount is intentionally omitted here: it represents our cost to fix an
  // accepted claim and is only known during processing (see DOMACE detail, 1.2c).
  return DomaceClaimCreateInputSchema.parse({
    mrNumber: emptyToUndefined(values.mrNumber),
    claimNumber: emptyToUndefined(values.claimNumber),
    customerName: emptyToUndefined(values.customerName),
    engineTypeId: emptyToUndefined(values.engineTypeId),
    engineCode: emptyToUndefined(values.engineCode),
    dateOfClaim: emptyToUndefined(values.dateOfClaim),
    dateOfFinish: emptyToUndefined(values.dateOfFinish),
    warrantyReport: emptyToUndefined(values.warrantyReport),
    faults: faultDraftsToInput(values.faults),
  })
}
