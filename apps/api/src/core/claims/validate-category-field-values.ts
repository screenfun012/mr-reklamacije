import { CLAIM_CATEGORY_FIELD_TEXT_MAX_LENGTH, type ClaimCategoryFieldValues } from '@mr/shared'

import { ValidationError } from '../errors/domain-errors.js'
import type { CategoryFieldCatalogField } from '../ports/category-fields-port.js'

export interface CategoryFieldValuesCheck {
  /** What the claim will carry after the write, for the category it will have. */
  values: ClaimCategoryFieldValues
  /** What it carried before UNDER THAT SAME category — `{}` on create and on a move to a new one. */
  previousValues: ClaimCategoryFieldValues
  /** The catalogue of the category the claim will have AFTER the write, retired rows included. */
  fields: readonly CategoryFieldCatalogField[]
  /**
   * Whether an unanswered required field is a refusal. True on create — the red star has to mean
   * something. False on update, because moving a claim to another kind of work is exactly the
   * moment it legitimately lacks the new fields; it is marked instead (`missingRequiredFields`).
   */
  requireComplete: boolean
}

function assertValue(field: CategoryFieldCatalogField, value: string, isUnchanged: boolean): void {
  if (field.fieldType === 'text') {
    if (value.length > CLAIM_CATEGORY_FIELD_TEXT_MAX_LENGTH) {
      throw new ValidationError(`Invalid category field value: ${field.code} is too long`)
    }
    return
  }

  const option = field.options.find((candidate) => candidate.code === value)
  if (option === undefined) {
    throw new ValidationError(
      `Invalid category field value: unknown option ${value} for ${field.code}`,
    )
  }

  if (isUnchanged) {
    return
  }

  if (!option.isActive) {
    throw new ValidationError(`Invalid category field value: ${value} is retired`)
  }
}

/**
 * The server is the judge of a claim's category-field values (V2 spec §4.6). Every key must be a
 * field of the claim's category; a chosen answer must be one of that field's options, and a NEW
 * answer must point at a live field and a live option.
 *
 * An UNCHANGED value is always kept. A claim keeps what the office has since retired — otherwise
 * fixing a typo in the MR number would fail because a part stopped being offered last month, and
 * the person editing would have to un-retire it to save an unrelated change.
 */
export function assertCategoryFieldValues({
  values,
  previousValues,
  fields,
  requireComplete,
}: CategoryFieldValuesCheck): void {
  for (const [code, value] of Object.entries(values)) {
    const field = fields.find((candidate) => candidate.code === code)
    if (field === undefined) {
      throw new ValidationError(`Invalid category field value: unknown field ${code}`)
    }

    const isUnchanged = previousValues[code] === value
    if (!isUnchanged && !field.isActive) {
      throw new ValidationError(`Invalid category field value: ${code} is retired`)
    }

    assertValue(field, value, isUnchanged)
  }

  if (requireComplete) {
    const missing = missingRequiredFields(values, fields)
    if (missing.length > 0) {
      throw new ValidationError(`Missing required category field values: ${missing.join(', ')}`)
    }
  }
}

/**
 * Which live required fields of the claim's category have no answer. This is the whole of the
 * "⚠ DOPUNI PODATKE" mark — computed from the catalogue every time, never a stored flag that
 * could drift from it.
 */
export function missingRequiredFields(
  values: ClaimCategoryFieldValues,
  fields: readonly CategoryFieldCatalogField[],
): string[] {
  return fields
    .filter((field) => field.isActive && field.isRequired)
    .filter((field) => {
      const value = values[field.code]
      return value === undefined || value.length === 0
    })
    .map((field) => field.code)
}
