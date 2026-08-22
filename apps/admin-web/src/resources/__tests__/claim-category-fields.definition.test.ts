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

describe('claimCategoryFieldOptionsResourceDefinition — the dependency', () => {
  it('lets the office correct the parent later, unlike the field the option belongs to', () => {
    const editFields = claimCategoryFieldOptionsResourceDefinition.formFields.filter(
      (field) => !field.createOnly,
    )
    // The field an option belongs to is what its stored answers are keyed by, so it is fixed.
    // Which option it hangs off is a judgement about the shop, and judgements get corrected.
    expect(editFields.some((field) => field.key === 'fieldId')).toBe(false)
    expect(editFields.some((field) => field.key === 'parentOptionId')).toBe(true)
  })

  it('omits the parent on create when none was picked, and CLEARS it on update', () => {
    expect(
      claimCategoryFieldOptionsResourceDefinition.buildCreateBody({
        fieldId: 'f1',
        code: ' glava_ventili ',
        name: ' Ventili ne zaptivaju ',
        sortOrder: '10',
        parentOptionId: '',
      }),
    ).toEqual({ fieldId: 'f1', code: 'glava_ventili', name: 'Ventili ne zaptivaju', sortOrder: 10 })

    expect(
      claimCategoryFieldOptionsResourceDefinition.buildCreateBody({
        fieldId: 'f1',
        code: 'glava_ventili',
        name: 'Ventili',
        sortOrder: '10',
        parentOptionId: 'o-glava',
      }),
    ).toEqual({
      fieldId: 'f1',
      code: 'glava_ventili',
      name: 'Ventili',
      sortOrder: 10,
      parentOptionId: 'o-glava',
    })

    // An absent key means "leave it alone", so removing a dependency has to send `null`.
    expect(
      claimCategoryFieldOptionsResourceDefinition.buildUpdateBody({
        name: 'Ventili',
        sortOrder: '10',
        parentOptionId: '',
      }),
    ).toEqual({ name: 'Ventili', sortOrder: 10, parentOptionId: null })
  })
})
