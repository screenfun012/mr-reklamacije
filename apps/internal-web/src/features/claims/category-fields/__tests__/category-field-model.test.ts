import type { ClaimCategoryFieldListItem } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import {
  categoryFieldViews,
  hasAnswers,
  prunedCategoryFieldValues,
} from '../category-field-model.js'

function field(over: Partial<ClaimCategoryFieldListItem> = {}): ClaimCategoryFieldListItem {
  return {
    id: 'f1',
    categoryId: 'cat',
    categoryName: 'Mašinska obrada',
    code: 'obradjeni_deo',
    name: 'Obrađeni deo',
    fieldType: 'select',
    isRequired: false,
    sortOrder: 10,
    isActive: true,
    deactivatedAt: null,
    createdAt: '2026-08-21T00:00:00.000Z',
    usageCount: 0,
    options: [
      option('glava', 'Glava', 10),
      option('blok', 'Blok', 20),
      option('radilica', 'Radilica', 30),
    ],
    ...over,
  }
}

function option(code: string, name: string, sortOrder: number, isActive = true) {
  return {
    id: `o-${code}`,
    fieldId: 'f1',
    fieldName: 'Obrađeni deo',
    code,
    name,
    sortOrder,
    isActive,
    deactivatedAt: null,
    createdAt: '2026-08-21T00:00:00.000Z',
    usageCount: 0,
  }
}

describe('categoryFieldViews', () => {
  it('draws a short list as buttons and a long one as a dropdown', () => {
    const short = categoryFieldViews([field()], {})
    expect(short[0]?.control).toBe('segmented')

    const long = categoryFieldViews(
      [field({ options: [...(field().options ?? []), option('karter', 'Karter', 40)] })],
      {},
    )
    // How a list is drawn follows from how long it is — one less thing for the office to choose.
    expect(long[0]?.control).toBe('dropdown')
  })

  it('draws a typed field as an input', () => {
    const views = categoryFieldViews(
      [field({ code: 'mera', name: 'Mera obrade', fieldType: 'text', options: [] })],
      {},
    )
    expect(views[0]?.control).toBe('text')
  })

  it('hides a retired field — unless this claim answered it', () => {
    const retired = field({ isActive: false })

    expect(categoryFieldViews([retired], {})).toEqual([])
    // The office stops asking a question; it does not erase the answers already given.
    const kept = categoryFieldViews([retired], { obradjeni_deo: 'glava' })
    expect(kept).toHaveLength(1)
    expect(kept[0]?.isRetired).toBe(true)
  })

  it('keeps a retired option only when it is the chosen one', () => {
    const withRetired = field({
      options: [option('glava', 'Glava', 10), option('karter', 'Karter', 20, false)],
    })

    expect(categoryFieldViews([withRetired], {})[0]?.options.map((o) => o.code)).toEqual(['glava'])
    expect(
      categoryFieldViews([withRetired], { obradjeni_deo: 'karter' })[0]?.options.map((o) => o.code),
    ).toEqual(['glava', 'karter'])
  })

  it('orders fields the way the office ordered them', () => {
    const views = categoryFieldViews(
      [field({ code: 'b', sortOrder: 20 }), field({ code: 'a', sortOrder: 10 })],
      {},
    )
    expect(views.map((view) => view.code)).toEqual(['a', 'b'])
  })
})

describe('prunedCategoryFieldValues', () => {
  it('drops answers the new category does not ask for', () => {
    const views = categoryFieldViews([field()], {})
    expect(prunedCategoryFieldValues({ obradjeni_deo: 'glava', tudje: 'x' }, views)).toEqual({
      obradjeni_deo: 'glava',
    })
  })
})

describe('hasAnswers', () => {
  it('is what decides whether changing category needs a confirmation', () => {
    expect(hasAnswers({})).toBe(false)
    expect(hasAnswers({ obradjeni_deo: '' })).toBe(false)
    expect(hasAnswers({ obradjeni_deo: 'glava' })).toBe(true)
  })
})
