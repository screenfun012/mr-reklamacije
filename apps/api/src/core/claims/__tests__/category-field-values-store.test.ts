import { describe, expect, it } from 'vitest'

import {
  categoryFieldValuesFor,
  previousCategoryIdsOf,
  withCategoryFieldValues,
} from '../category-field-values-store.js'

const MACHINING = 'cat-machining'
const OVERHAUL = 'cat-overhaul'

describe('categoryFieldValuesFor', () => {
  it('reads only the answers of the category asked for', () => {
    const stored = {
      [MACHINING]: { obradjeni_deo: 'glava' },
      [OVERHAUL]: { obim: 'veliki' },
    }

    expect(categoryFieldValuesFor(stored, MACHINING)).toEqual({ obradjeni_deo: 'glava' })
    expect(categoryFieldValuesFor(stored, OVERHAUL)).toEqual({ obim: 'veliki' })
  })

  it('is empty for a claim that answered nothing, or has no category at all', () => {
    expect(categoryFieldValuesFor(null, MACHINING)).toEqual({})
    expect(categoryFieldValuesFor({ [OVERHAUL]: { obim: 'veliki' } }, null)).toEqual({})
  })
})

describe('withCategoryFieldValues', () => {
  it('leaves every other category exactly as it was — that is the whole point', () => {
    // The worker entered it as an overhaul, the office corrects it to machining. What was typed
    // under the overhaul must survive the correction, and come back if the correction is undone.
    const stored = { [OVERHAUL]: { obim: 'veliki' } }

    expect(withCategoryFieldValues(stored, MACHINING, { obradjeni_deo: 'glava' })).toEqual({
      [OVERHAUL]: { obim: 'veliki' },
      [MACHINING]: { obradjeni_deo: 'glava' },
    })
  })

  it('overwrites the answers of the category being written, not merges them', () => {
    const stored = { [MACHINING]: { obradjeni_deo: 'glava', mera: '0.25' } }

    expect(withCategoryFieldValues(stored, MACHINING, { obradjeni_deo: 'blok' })).toEqual({
      [MACHINING]: { obradjeni_deo: 'blok' },
    })
  })

  it('has one representation for "carries nothing"', () => {
    // An empty answer set drops its key rather than storing `{}`, and a store with no keys left
    // becomes NULL — otherwise "nothing" would read three different ways in the column.
    expect(withCategoryFieldValues({ [MACHINING]: { a: 'b' } }, MACHINING, {})).toBeNull()
    expect(withCategoryFieldValues(null, MACHINING, {})).toBeNull()
    expect(withCategoryFieldValues({ [OVERHAUL]: { c: 'd' } }, MACHINING, {})).toEqual({
      [OVERHAUL]: { c: 'd' },
    })
  })
})

describe('previousCategoryIdsOf', () => {
  it('names the kinds of work a claim was moved away from, and nothing else', () => {
    expect(
      previousCategoryIdsOf({ [MACHINING]: { a: 'b' }, [OVERHAUL]: { c: 'd' } }, MACHINING),
    ).toEqual([OVERHAUL])
    expect(previousCategoryIdsOf({ [MACHINING]: { a: 'b' } }, MACHINING)).toEqual([])
    expect(previousCategoryIdsOf(null, MACHINING)).toEqual([])
  })
})
