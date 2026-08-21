import { describe, expect, it } from 'vitest'

import { claimCategoryFieldOptionsResourceDefinition } from '../claim-category-field-options.definition.js'
import { claimCategoryFieldsResourceDefinition } from '../claim-category-fields.definition.js'

describe('claimCategoryFieldsResourceDefinition', () => {
  it('fixes the category, the code and the type once the field exists', () => {
    // The first two are what a claim's stored answers are keyed by: moving a field to another
    // category, or renaming its code, would orphan every value already written on a claim. The
    // TYPE is fixed for the same reason — switching a list field to free text would leave option
    // codes standing in for typed words.
    const editFields = claimCategoryFieldsResourceDefinition.formFields.filter(
      (field) => !field.createOnly,
    )

    expect(editFields.some((field) => field.key === 'categoryId')).toBe(false)
    expect(editFields.some((field) => field.key === 'code')).toBe(false)
    expect(editFields.some((field) => field.key === 'fieldType')).toBe(false)
    // "Required" is NOT fixed: the office learns what it wants to track, and turning it on marks
    // the claims that predate it rather than refusing anything.
    expect(editFields.map((field) => field.key)).toEqual(['name', 'isRequired', 'sortOrder'])
  })

  it('sends the category and a trimmed code on create, and neither on update', () => {
    expect(
      claimCategoryFieldsResourceDefinition.buildCreateBody({
        categoryId: 'c1',
        code: ' tvrdoca ',
        name: ' Tvrdoća ',
        fieldType: 'text',
        isRequired: 'true',
        sortOrder: '20',
      }),
    ).toEqual({
      categoryId: 'c1',
      code: 'tvrdoca',
      name: 'Tvrdoća',
      fieldType: 'text',
      isRequired: true,
      sortOrder: 20,
    })

    expect(
      claimCategoryFieldsResourceDefinition.buildUpdateBody({
        categoryId: 'c1',
        code: 'tvrdoca',
        name: 'Tvrdoća 2',
        isRequired: 'false',
        sortOrder: '',
      }),
    ).toEqual({ name: 'Tvrdoća 2', isRequired: false, sortOrder: undefined })
  })
})

describe('claimCategoryFieldOptionsResourceDefinition', () => {
  it('hangs an option off its field, fixed once created', () => {
    const editFields = claimCategoryFieldOptionsResourceDefinition.formFields.filter(
      (field) => !field.createOnly,
    )

    expect(editFields.some((field) => field.key === 'fieldId')).toBe(false)
    expect(
      claimCategoryFieldOptionsResourceDefinition.buildCreateBody({
        fieldId: 'f1',
        code: ' deklo ',
        name: ' Deklo ',
        sortOrder: '40',
      }),
    ).toEqual({ fieldId: 'f1', code: 'deklo', name: 'Deklo', sortOrder: 40 })
  })

  it('shares one resource key with the categories, so one signal refreshes the family', () => {
    expect(claimCategoryFieldOptionsResourceDefinition.resourceKey).toBe(
      claimCategoryFieldsResourceDefinition.resourceKey,
    )
  })
})
