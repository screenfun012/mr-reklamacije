import {
  ClaimKind,
  DomaceClaimCreateInputSchema,
  EmotiveClaimCreateInputSchema,
  type ClaimCategoryFieldValues,
  type DomaceClaimCreateInput,
  type EmotiveClaimCreateInput,
} from '@mr/shared'

import { m } from '@mr/i18n'

import {
  faultDraftsToInput,
  type EmotiveClaimFaultDraft,
} from '../../emotive-claims/faults/fault-draft.js'
import {
  domaceClaimBasicFieldsSchema,
  emptyToAmount,
} from '../../domace-claims/create/domace-claim-create-schemas.js'
import {
  emotiveClaimStepBasicSchema,
  formatZodFieldErrors,
} from '../../emotive-claims/create/emotive-claim-create-schemas.js'

export { formatZodFieldErrors } from '../../emotive-claims/create/emotive-claim-create-schemas.js'
export {
  validateFaultDrafts,
  type EmotiveClaimFaultDraft,
} from '../../emotive-claims/faults/fault-draft.js'

/**
 * ONE set of values for both kinds of claim. The two used to be a wizard and a long form; the
 * prototype puts them through the same four steps, where DOMAĆA only adds the money fields.
 *
 * `kind` is a value on the form rather than a route, because step 1 is where it is chosen — and
 * the CATEGORY comes in from the outside (the menu entry or the list you started from), which is
 * why it is here and not asked for as a field.
 */
export interface ClaimCreateFormValues {
  kind: ClaimKind | ''
  categoryId: string
  categoryFieldValues: ClaimCategoryFieldValues
  mrNumber: string
  claimNumber: string
  /** EMOTIVE: the partner, picked from the customers catalogue. */
  customerId: string
  /** DOMAĆA: the buyer, typed — there is no catalogue of private individuals. */
  customerName: string
  invoiceNumber: string
  manufacturerId: string
  engineTypeId: string
  engineCode: string
  dateOfFinish: string
  dateOfClaim: string
  warrantyReport: string
  employeeId: string
  originalInvoiceAmount: string
  partsAmount: string
  laborAmount: string
  faults: EmotiveClaimFaultDraft[]
}

export const CLAIM_CREATE_FORM_DEFAULTS: ClaimCreateFormValues = {
  kind: '',
  categoryId: '',
  categoryFieldValues: {},
  mrNumber: '',
  claimNumber: '',
  customerId: '',
  customerName: '',
  invoiceNumber: '',
  manufacturerId: '',
  engineTypeId: '',
  engineCode: '',
  dateOfFinish: '',
  dateOfClaim: '',
  warrantyReport: '',
  employeeId: '',
  originalInvoiceAmount: '',
  partsAmount: '',
  laborAmount: '',
  faults: [],
}

/**
 * What step "Osnovni podaci" demands, which is not the same question for the two kinds: an
 * EMOTIVE claim belongs to a partner in the catalogue and needs an engine type and a date, while
 * a DOMAĆA one may be opened with a buyer's name alone. Both rules already existed — this only
 * picks between them instead of the route doing it.
 */
export function validateClaimBasicStep(values: ClaimCreateFormValues): Record<string, string> {
  const schema =
    values.kind === ClaimKind.Domace
      ? domaceClaimBasicFieldsSchema.refine(
          (value) => value.mrNumber.trim() !== '' || value.customerName.trim() !== '',
          { message: m.domace_claims_create_field_at_least_one(), path: ['mrNumber'] },
        )
      : emotiveClaimStepBasicSchema

  const result = schema.safeParse(values)
  return result.success ? {} : formatZodFieldErrors(result.error)
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

export function formValuesToEmotiveInput(values: ClaimCreateFormValues): EmotiveClaimCreateInput {
  return EmotiveClaimCreateInputSchema.parse({
    mrNumber: values.mrNumber,
    claimNumber: emptyToUndefined(values.claimNumber),
    customerId: values.customerId,
    manufacturerId: emptyToUndefined(values.manufacturerId),
    categoryId: values.categoryId,
    categoryFieldValues: values.categoryFieldValues,
    engineTypeId: values.engineTypeId,
    engineCode: emptyToUndefined(values.engineCode),
    dateOfClaim: values.dateOfClaim,
    dateOfFinish: emptyToUndefined(values.dateOfFinish),
    warrantyReport: emptyToUndefined(values.warrantyReport),
    employeeId: emptyToUndefined(values.employeeId),
    faults: faultDraftsToInput(values.faults),
  })
}

export function formValuesToDomaceInput(values: ClaimCreateFormValues): DomaceClaimCreateInput {
  // UKUPNO (total_amount) is not sent — the server computes it = parts + labor.
  return DomaceClaimCreateInputSchema.parse({
    mrNumber: emptyToUndefined(values.mrNumber),
    claimNumber: emptyToUndefined(values.claimNumber),
    invoiceNumber: emptyToUndefined(values.invoiceNumber),
    customerName: emptyToUndefined(values.customerName),
    manufacturerId: emptyToUndefined(values.manufacturerId),
    categoryId: emptyToUndefined(values.categoryId),
    categoryFieldValues: values.categoryFieldValues,
    engineTypeId: emptyToUndefined(values.engineTypeId),
    engineCode: emptyToUndefined(values.engineCode),
    dateOfClaim: emptyToUndefined(values.dateOfClaim),
    dateOfFinish: emptyToUndefined(values.dateOfFinish),
    warrantyReport: emptyToUndefined(values.warrantyReport),
    employeeId: emptyToUndefined(values.employeeId),
    originalInvoiceAmount: emptyToAmount(values.originalInvoiceAmount),
    partsAmount: emptyToAmount(values.partsAmount),
    laborAmount: emptyToAmount(values.laborAmount),
    faults: faultDraftsToInput(values.faults),
  })
}
