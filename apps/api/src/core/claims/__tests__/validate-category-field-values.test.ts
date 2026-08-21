import { describe, expect, it } from 'vitest'

import { ValidationError } from '../../errors/domain-errors.js'
import type { CategoryFieldCatalogField } from '../../ports/category-fields-port.js'
import {
  assertCategoryFieldValues,
  missingRequiredFields,
} from '../validate-category-field-values.js'

const FIELDS: CategoryFieldCatalogField[] = [
  {
    id: 'f1',
    categoryId: 'cat',
    code: 'obradjeni_deo',
    fieldType: 'select',
    isRequired: false,
    isActive: true,
    options: [
      { code: 'glava', isActive: true },
      { code: 'karter', isActive: false },
    ],
  },
  {
    id: 'f2',
    categoryId: 'cat',
    code: 'stari_postupak',
    fieldType: 'select',
    isRequired: false,
    isActive: false,
    options: [{ code: 'p2', isActive: true }],
  },
]

const TEXT_FIELD: CategoryFieldCatalogField = {
  id: 'f3',
  categoryId: 'cat',
  code: 'mera_obrade',
  fieldType: 'text',
  isRequired: true,
  isActive: true,
  options: [],
}

describe('assertCategoryFieldValues', () => {
  it('accepts a live option of a live field, and accepts nothing at all', () => {
    expect(() =>
      assertCategoryFieldValues({
        values: { obradjeni_deo: 'glava' },
        previousValues: {},
        fields: FIELDS,
        requireComplete: false,
      }),
    ).not.toThrow()

    // Fields are optional — "not filled" is a legitimate answer.
    expect(() =>
      assertCategoryFieldValues({
        values: {},
        previousValues: {},
        fields: FIELDS,
        requireComplete: false,
      }),
    ).not.toThrow()
  })

  it('refuses a key that is no field of the category', () => {
    // The only guard between a typo in a caller and a permanent key sitting in the jsonb.
    expect(() =>
      assertCategoryFieldValues({
        values: { tudje_polje: 'glava' },
        previousValues: {},
        fields: FIELDS,
        requireComplete: false,
      }),
    ).toThrow(ValidationError)
  })

  it('refuses a value that is no option of that field', () => {
    expect(() =>
      assertCategoryFieldValues({
        values: { obradjeni_deo: 'deklo' },
        previousValues: {},
        fields: FIELDS,
        requireComplete: false,
      }),
    ).toThrow(ValidationError)
  })

  it('refuses a retired option, and a retired field, when the value is NEW', () => {
    expect(() =>
      assertCategoryFieldValues({
        values: { obradjeni_deo: 'karter' },
        previousValues: {},
        fields: FIELDS,
        requireComplete: false,
      }),
    ).toThrow(ValidationError)

    expect(() =>
      assertCategoryFieldValues({
        values: { stari_postupak: 'p2' },
        previousValues: {},
        fields: FIELDS,
        requireComplete: false,
      }),
    ).toThrow(ValidationError)
  })

  it('keeps an unchanged value even after its option or field was retired', () => {
    // A claim keeps what it was given. Fixing a typo in the MR number must not fail because a
    // part stopped being offered last month.
    expect(() =>
      assertCategoryFieldValues({
        values: { obradjeni_deo: 'karter', stari_postupak: 'p2' },
        previousValues: { obradjeni_deo: 'karter', stari_postupak: 'p2' },
        fields: FIELDS,
        requireComplete: false,
      }),
    ).not.toThrow()
  })

  it('refuses moving from one retired value to another', () => {
    expect(() =>
      assertCategoryFieldValues({
        values: { obradjeni_deo: 'karter' },
        previousValues: { obradjeni_deo: 'glava' },
        fields: FIELDS,
        requireComplete: false,
      }),
    ).toThrow(ValidationError)
  })
})

describe('typed fields and required fields', () => {
  it('takes words for a text field without looking for an option', () => {
    expect(() =>
      assertCategoryFieldValues({
        values: { mera_obrade: '0.25 mm' },
        previousValues: {},
        fields: [TEXT_FIELD],
        requireComplete: true,
      }),
    ).not.toThrow()
  })

  it('refuses words longer than the column was meant to hold', () => {
    expect(() =>
      assertCategoryFieldValues({
        values: { mera_obrade: 'x'.repeat(201) },
        previousValues: {},
        fields: [TEXT_FIELD],
        requireComplete: false,
      }),
    ).toThrow(ValidationError)
  })

  it('refuses an unanswered required field on CREATE — the red star has to mean something', () => {
    expect(() =>
      assertCategoryFieldValues({
        values: {},
        previousValues: {},
        fields: [TEXT_FIELD],
        requireComplete: true,
      }),
    ).toThrow(ValidationError)
  })

  it('lets a claim be incomplete on UPDATE, because that is what a category change causes', () => {
    // Refusing here would make correcting a wrong category impossible: the new kind of work asks
    // for fields the claim cannot have yet. It is marked instead, and stays editable.
    expect(() =>
      assertCategoryFieldValues({
        values: {},
        previousValues: {},
        fields: [TEXT_FIELD],
        requireComplete: false,
      }),
    ).not.toThrow()
  })
})

describe('missingRequiredFields', () => {
  it('names the live required fields with no answer', () => {
    expect(missingRequiredFields({}, [TEXT_FIELD])).toEqual(['mera_obrade'])
    expect(missingRequiredFields({ mera_obrade: '0.25' }, [TEXT_FIELD])).toEqual([])
  })

  it('ignores a required field the office has switched off', () => {
    // Otherwise retiring a field would mark every claim in that category as incomplete.
    expect(missingRequiredFields({}, [{ ...TEXT_FIELD, isActive: false }])).toEqual([])
  })

  it('ignores fields nobody has to answer', () => {
    expect(missingRequiredFields({}, FIELDS)).toEqual([])
  })
})
