import { EmotiveClaimCreateInputSchema, type ClaimCategoryFieldValues } from '@mr/shared'
import { z } from 'zod'

import { m } from '@mr/i18n'

import { faultDraftsToInput, type EmotiveClaimFaultDraft } from '../faults/fault-draft.js'

export { validateFaultDrafts, type EmotiveClaimFaultDraft } from '../faults/fault-draft.js'

function isValidDateString(value: string): boolean {
  if (value.trim() === '') {
    return false
  }
  const parsed = Date.parse(value)
  return !Number.isNaN(parsed)
}

const optionalDateField = z
  .string()
  .trim()
  .optional()
  .refine((value) => value === undefined || value === '' || isValidDateString(value), {
    message: m.emotive_claims_create_field_date_invalid(),
  })

const requiredDateField = z
  .string()
  .trim()
  .min(1, m.emotive_claims_create_field_date_required())
  .refine(isValidDateString, { message: m.emotive_claims_create_field_date_invalid() })

export const emotiveClaimStepBasicSchema = z.object({
  mrNumber: z.string().trim().min(1, m.emotive_claims_create_field_mr_required()).max(50),
  claimNumber: z.string().trim().max(50).optional(),
  customerId: z
    .string()
    .trim()
    .min(1, m.emotive_claims_create_field_customer_required())
    .uuid(m.emotive_claims_create_field_customer_required()),
  manufacturerId: z.string().trim(),
  categoryId: z
    .string()
    .trim()
    .min(1, m.field_claim_category_required())
    .uuid(m.field_claim_category_required()),
  engineTypeId: z
    .string()
    .trim()
    .min(1, m.emotive_claims_create_field_engine_type_required())
    .uuid(m.emotive_claims_create_field_engine_type_required()),
  engineCode: z.string().trim().max(100).optional(),
  dateOfFinish: optionalDateField,
  dateOfClaim: requiredDateField,
  warrantyReport: z.string().trim().max(8000).optional(),
  employeeId: z.string().trim().optional(),
})

export type EmotiveClaimFormValues = {
  /** Answers to the category's own fields — edited on the detail, set by the wizard. */
  categoryFieldValues: ClaimCategoryFieldValues
  mrNumber: string
  claimNumber: string
  customerId: string
  manufacturerId: string
  categoryId: string
  engineTypeId: string
  engineCode: string
  dateOfFinish: string
  dateOfClaim: string
  warrantyReport: string
  employeeId: string
  faults: EmotiveClaimFaultDraft[]
}

export const EMOTIVE_CLAIM_FORM_DEFAULTS: EmotiveClaimFormValues = {
  categoryFieldValues: {},
  mrNumber: '',
  claimNumber: '',
  customerId: '',
  manufacturerId: '',
  categoryId: '',
  engineTypeId: '',
  engineCode: '',
  dateOfFinish: '',
  dateOfClaim: '',
  warrantyReport: '',
  employeeId: '',
  faults: [],
}

export function formValuesToCreateInput(values: EmotiveClaimFormValues) {
  return EmotiveClaimCreateInputSchema.parse({
    mrNumber: values.mrNumber,
    claimNumber: values.claimNumber.trim() === '' ? undefined : values.claimNumber,
    customerId: values.customerId,
    manufacturerId: values.manufacturerId.trim() === '' ? undefined : values.manufacturerId,
    categoryId: values.categoryId,
    categoryFieldValues: values.categoryFieldValues,
    engineTypeId: values.engineTypeId,
    engineCode: values.engineCode.trim() === '' ? undefined : values.engineCode,
    dateOfClaim: values.dateOfClaim,
    dateOfFinish: values.dateOfFinish.trim() === '' ? undefined : values.dateOfFinish,
    warrantyReport: values.warrantyReport.trim() === '' ? undefined : values.warrantyReport,
    employeeId: values.employeeId.trim() === '' ? undefined : values.employeeId,
    faults: faultDraftsToInput(values.faults),
  })
}

export function formatZodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (key && fieldErrors[key] === undefined) {
      fieldErrors[key] = issue.message
    }
  }
  return fieldErrors
}
