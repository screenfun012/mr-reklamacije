import {
  CLAIM_CATEGORY_FIELD_SEGMENTED_MAX_OPTIONS,
  type ClaimCategoryFieldListItem,
  type ClaimCategoryFieldValues,
} from '@mr/shared'

/** How one field is drawn. A `select` with few options is a row of buttons, not a dropdown. */
export type CategoryFieldControl = 'segmented' | 'dropdown' | 'text'

export interface CategoryFieldOption {
  code: string
  name: string
  isActive: boolean
}

export interface CategoryFieldView {
  code: string
  name: string
  control: CategoryFieldControl
  isRequired: boolean
  /** Retired, but still shown because THIS claim carries an answer for it. */
  isRetired: boolean
  options: CategoryFieldOption[]
}

/**
 * Which fields a claim shows for its category, and how each is drawn.
 *
 * Two rules that are easy to get wrong and are the whole reason this is one function:
 *
 * 1. A RETIRED field is dropped — unless this claim already carries an answer for it. The office
 *    stops asking a question; it does not erase the answers already given, and a detail that
 *    hid them would quietly lose data in front of the person reading it.
 * 2. A retired OPTION is likewise kept in its field's list only when it is the chosen one, so it
 *    can be named — but it can never be picked afresh (the server refuses it either way).
 */
export function categoryFieldViews(
  fields: readonly ClaimCategoryFieldListItem[],
  values: ClaimCategoryFieldValues,
): CategoryFieldView[] {
  return fields
    .filter((field) => field.isActive || values[field.code] !== undefined)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    .map((field) => {
      const chosen = values[field.code]
      const options = (field.options ?? [])
        .filter((option) => option.isActive || option.code === chosen)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((option) => ({ code: option.code, name: option.name, isActive: option.isActive }))

      return {
        code: field.code,
        name: field.name,
        control: controlFor(field.fieldType, options.length),
        isRequired: field.isRequired,
        isRetired: !field.isActive,
        options,
      }
    })
}

function controlFor(fieldType: 'select' | 'text', optionCount: number): CategoryFieldControl {
  if (fieldType === 'text') {
    return 'text'
  }
  return optionCount <= CLAIM_CATEGORY_FIELD_SEGMENTED_MAX_OPTIONS ? 'segmented' : 'dropdown'
}

/** Keeps only the answers the given fields still ask for — what a category change discards. */
export function prunedCategoryFieldValues(
  values: ClaimCategoryFieldValues,
  fields: readonly CategoryFieldView[],
): ClaimCategoryFieldValues {
  const known = new Set(fields.map((field) => field.code))
  return Object.fromEntries(Object.entries(values).filter(([code]) => known.has(code)))
}

/** Does moving to another category throw away something a person typed? */
export function hasAnswers(values: ClaimCategoryFieldValues): boolean {
  return Object.values(values).some((value) => value.length > 0)
}
