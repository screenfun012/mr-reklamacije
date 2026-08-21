import { describe, expect, it } from 'vitest'

import { ValidationError } from '../../errors/domain-errors.js'
import { assertCategoryFieldValues } from '../validate-category-field-values.js'

const FIELDS = [
  {
    id: 'f1',
    categoryId: 'cat',
    code: 'obradjeni_deo',
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
    isActive: false,
    options: [{ code: 'p2', isActive: true }],
  },
]

describe('assertCategoryFieldValues', () => {
  it('accepts a live option of a live field, and accepts nothing at all', () => {
    expect(() =>
      assertCategoryFieldValues({
        values: { obradjeni_deo: 'glava' },
        previousValues: {},
        fields: FIELDS,
      }),
    ).not.toThrow()

    // Fields are optional — "not filled" is a legitimate answer.
    expect(() =>
      assertCategoryFieldValues({ values: {}, previousValues: {}, fields: FIELDS }),
    ).not.toThrow()
  })

  it('refuses a key that is no field of the category', () => {
    // The only guard between a typo in a caller and a permanent key sitting in the jsonb.
    expect(() =>
      assertCategoryFieldValues({
        values: { tudje_polje: 'glava' },
        previousValues: {},
        fields: FIELDS,
      }),
    ).toThrow(ValidationError)
  })

  it('refuses a value that is no option of that field', () => {
    expect(() =>
      assertCategoryFieldValues({
        values: { obradjeni_deo: 'deklo' },
        previousValues: {},
        fields: FIELDS,
      }),
    ).toThrow(ValidationError)
  })

  it('refuses a retired option, and a retired field, when the value is NEW', () => {
    expect(() =>
      assertCategoryFieldValues({
        values: { obradjeni_deo: 'karter' },
        previousValues: {},
        fields: FIELDS,
      }),
    ).toThrow(ValidationError)

    expect(() =>
      assertCategoryFieldValues({
        values: { stari_postupak: 'p2' },
        previousValues: {},
        fields: FIELDS,
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
      }),
    ).not.toThrow()
  })

  it('refuses moving from one retired value to another', () => {
    expect(() =>
      assertCategoryFieldValues({
        values: { obradjeni_deo: 'karter' },
        previousValues: { obradjeni_deo: 'glava' },
        fields: FIELDS,
      }),
    ).toThrow(ValidationError)
  })
})
