import {
  EmotiveClaimCreateInputSchema,
  EmotiveClaimFaultInputSchema,
  FaultType,
  type EmotiveClaimFaultInput,
} from '@mr/shared'
import { z } from 'zod'

import { m } from '@mr/i18n'

export type EmotiveClaimFaultDraft = {
  faultType: (typeof FaultType)[keyof typeof FaultType]
  employeeId?: string
  departmentId?: string
  externalPartyId?: string
  notes?: string
}

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
  engineTypeId: z
    .string()
    .trim()
    .min(1, m.emotive_claims_create_field_engine_type_required())
    .uuid(m.emotive_claims_create_field_engine_type_required()),
  engineCode: z.string().trim().max(100).optional(),
  dateOfFinish: optionalDateField,
  dateOfClaim: requiredDateField,
})

export type EmotiveClaimFormValues = {
  mrNumber: string
  claimNumber: string
  customerId: string
  engineTypeId: string
  engineCode: string
  dateOfFinish: string
  dateOfClaim: string
  warrantyReport: string
  faults: EmotiveClaimFaultDraft[]
}

export const EMOTIVE_CLAIM_FORM_DEFAULTS: EmotiveClaimFormValues = {
  mrNumber: '',
  claimNumber: '',
  customerId: '',
  engineTypeId: '',
  engineCode: '',
  dateOfFinish: '',
  dateOfClaim: '',
  warrantyReport: '',
  faults: [],
}

function faultDraftToPayload(fault: EmotiveClaimFaultDraft): unknown {
  if (fault.faultType === FaultType.Employee) {
    return { faultType: fault.faultType, employeeId: fault.employeeId, notes: fault.notes }
  }
  if (fault.faultType === FaultType.Department) {
    return { faultType: fault.faultType, departmentId: fault.departmentId, notes: fault.notes }
  }
  return { faultType: fault.faultType, externalPartyId: fault.externalPartyId, notes: fault.notes }
}

function parseFaultDrafts(faults: EmotiveClaimFaultDraft[]): EmotiveClaimFaultInput[] {
  return faults.map((fault) => {
    const result = EmotiveClaimFaultInputSchema.safeParse(faultDraftToPayload(fault))
    if (!result.success) {
      throw result.error
    }
    return result.data
  })
}

export function validateFaultDrafts(faults: EmotiveClaimFaultDraft[]): z.ZodError | null {
  const issues: z.ZodIssue[] = []

  faults.forEach((fault, index) => {
    const result = EmotiveClaimFaultInputSchema.safeParse(faultDraftToPayload(fault))
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({
          ...issue,
          path: ['faults', index, ...issue.path],
        })
      }
    }
  })

  if (issues.length === 0) {
    return null
  }

  return new z.ZodError(issues)
}

export function formValuesToCreateInput(values: EmotiveClaimFormValues) {
  return EmotiveClaimCreateInputSchema.parse({
    mrNumber: values.mrNumber,
    claimNumber: values.claimNumber.trim() === '' ? undefined : values.claimNumber,
    customerId: values.customerId,
    engineTypeId: values.engineTypeId,
    engineCode: values.engineCode.trim() === '' ? undefined : values.engineCode,
    dateOfClaim: values.dateOfClaim,
    dateOfFinish: values.dateOfFinish.trim() === '' ? undefined : values.dateOfFinish,
    warrantyReport: values.warrantyReport.trim() === '' ? undefined : values.warrantyReport,
    faults: parseFaultDrafts(values.faults),
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
