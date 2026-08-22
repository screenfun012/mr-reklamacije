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
  /**
   * The NAME of the field this one hangs off, while that field has no answer — the moment when
   * this field can offer nothing and has to say why instead of looking broken.
   */
  awaitingParent: string | null
  options: CategoryFieldOption[]
}

/** The answer an option hangs off, or `null` when it is always offered. */
function parentOf(option: {
  parentFieldCode: string | null
  parentOptionCode: string | null
}): { fieldCode: string; optionCode: string } | null {
  if (option.parentFieldCode === null || option.parentOptionCode === null) {
    return null
  }
  return { fieldCode: option.parentFieldCode, optionCode: option.parentOptionCode }
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
        // A dependent option is offered only under the answer it hangs off. The chosen one stays
        // visible whatever the parent now says, so the claim can still name what it carries.
        .filter((option) => {
          const parent = parentOf(option)
          return (
            parent === null ||
            values[parent.fieldCode] === parent.optionCode ||
            option.code === chosen
          )
        })
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((option) => ({ code: option.code, name: option.name, isActive: option.isActive }))

      return {
        code: field.code,
        name: field.name,
        // AFTER narrowing: four causes that become two under the chosen assembly are two buttons.
        control: controlFor(field.fieldType, options.length),
        isRequired: field.isRequired,
        isRetired: !field.isActive,
        awaitingParent: awaitingParentName(field, fields, values),
        options,
      }
    })
}

/**
 * The name of the field this one waits for — set only when EVERY option hangs off one field that
 * has no answer yet. A field with some independent options can still be answered, so it does not
 * wait for anything.
 */
function awaitingParentName(
  field: ClaimCategoryFieldListItem,
  fields: readonly ClaimCategoryFieldListItem[],
  values: ClaimCategoryFieldValues,
): string | null {
  const options = field.options ?? []
  if (options.length === 0) {
    return null
  }

  const parents = options.map((option) => parentOf(option))
  const first = parents[0]
  if (first === undefined || first === null || parents.some((parent) => parent === null)) {
    return null
  }

  if (values[first.fieldCode] !== undefined) {
    return null
  }

  return fields.find((candidate) => candidate.code === first.fieldCode)?.name ?? null
}

/**
 * Answers whose option no longer hangs off the current parent answer — what changing the assembly
 * throws away. Without this the form would keep a pair the server refuses with a 400 the person
 * cannot read, at the moment they changed something else entirely.
 */
export function clearOrphanedCategoryFieldAnswers(
  values: ClaimCategoryFieldValues,
  fields: readonly ClaimCategoryFieldListItem[],
): ClaimCategoryFieldValues {
  return Object.fromEntries(
    Object.entries(values).filter(([code, value]) => {
      const option = fields
        .find((field) => field.code === code)
        ?.options?.find((candidate) => candidate.code === value)
      const parent = option === undefined ? null : parentOf(option)
      return parent === null || values[parent.fieldCode] === parent.optionCode
    }),
  )
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
