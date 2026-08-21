import type { ClaimCategoryFieldValues } from '@mr/shared'

import { ValidationError } from '../errors/domain-errors.js'
import type { CategoryFieldCatalogField } from '../ports/category-fields-port.js'

export interface CategoryFieldValuesCheck {
  /** What the claim will carry after the write. */
  values: ClaimCategoryFieldValues
  /** What it carried before — `{}` on create, and `{}` when the category itself changes. */
  previousValues: ClaimCategoryFieldValues
  /** The catalogue of the category the claim will have AFTER the write, retired rows included. */
  fields: readonly CategoryFieldCatalogField[]
}

/**
 * The server is the judge of a claim's category-field values (V2 spec §4.6). Every key must be a
 * field of the claim's category and every value one of that field's options; a NEW value must
 * point at a live field and a live option.
 *
 * An UNCHANGED value is always kept. A claim keeps what the office has since retired — otherwise
 * fixing a typo in the MR number would fail because a part stopped being offered last month, and
 * the person editing would have to un-retire it to save an unrelated change.
 */
export function assertCategoryFieldValues({
  values,
  previousValues,
  fields,
}: CategoryFieldValuesCheck): void {
  for (const [code, value] of Object.entries(values)) {
    const field = fields.find((candidate) => candidate.code === code)
    if (field === undefined) {
      throw new ValidationError(`Invalid category field value: unknown field ${code}`)
    }

    const option = field.options.find((candidate) => candidate.code === value)
    if (option === undefined) {
      throw new ValidationError(`Invalid category field value: unknown option ${value} for ${code}`)
    }

    if (previousValues[code] === value) {
      continue
    }

    if (!field.isActive || !option.isActive) {
      throw new ValidationError(`Invalid category field value: ${code} or ${value} is retired`)
    }
  }
}
