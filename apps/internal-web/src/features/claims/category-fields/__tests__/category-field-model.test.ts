import type { ClaimCategoryFieldListItem } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import {
  categoryFieldViews,
  clearOrphanedCategoryFieldAnswers,
  hasAnswers,
  hasUnansweredSelectFields,
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

function option(
  code: string,
  name: string,
  sortOrder: number,
  isActive = true,
  parent: { fieldCode: string; optionCode: string } | null = null,
) {
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
    parentOptionId: parent === null ? null : `o-${parent.optionCode}`,
    parentFieldCode: parent?.fieldCode ?? null,
    parentOptionCode: parent?.optionCode ?? null,
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

/** The pair migration 0052 seeds: a cause hangs off the assembly it belongs to. */
function dependentFields(): ClaimCategoryFieldListItem[] {
  return [
    field({
      id: 'f-part',
      code: 'sklop_u_kvaru',
      name: 'Sklop u kvaru',
      sortOrder: 10,
      options: [option('glava', 'Glava', 10), option('blok', 'Blok', 20)],
    }),
    field({
      id: 'f-cause',
      code: 'uzrok_kvara',
      name: 'Uzrok kvara',
      sortOrder: 15,
      options: [
        option('glava_ventili', 'Ventili ne zaptivaju', 10, true, {
          fieldCode: 'sklop_u_kvaru',
          optionCode: 'glava',
        }),
        option('glava_pukla', 'Pukla', 20, true, {
          fieldCode: 'sklop_u_kvaru',
          optionCode: 'glava',
        }),
        option('blok_pukao', 'Pukao', 30, true, {
          fieldCode: 'sklop_u_kvaru',
          optionCode: 'blok',
        }),
        option('blok_ravan', 'Deformisana ravan', 40, true, {
          fieldCode: 'sklop_u_kvaru',
          optionCode: 'blok',
        }),
      ],
    }),
  ]
}

describe('a field whose options hang off another field', () => {
  it('offers only the causes that belong to the chosen assembly', () => {
    const views = categoryFieldViews(dependentFields(), { sklop_u_kvaru: 'glava' })
    expect(views.find((view) => view.code === 'uzrok_kvara')?.options.map((o) => o.code)).toEqual([
      'glava_ventili',
      'glava_pukla',
    ])
  })

  it('waits for the assembly, names it, and offers nothing until it is chosen', () => {
    const view = categoryFieldViews(dependentFields(), {}).find(
      (candidate) => candidate.code === 'uzrok_kvara',
    )
    expect(view?.awaitingParent).toBe('Sklop u kvaru')
    expect(view?.options).toEqual([])
  })

  it('keeps a chosen cause visible after the assembly was changed under it', () => {
    // The claim has to be able to name what it carries — the server keeps an unchanged value for
    // exactly the same reason.
    const view = categoryFieldViews(dependentFields(), {
      sklop_u_kvaru: 'blok',
      uzrok_kvara: 'glava_ventili',
    }).find((candidate) => candidate.code === 'uzrok_kvara')
    expect(view?.options.map((o) => o.code)).toEqual(['glava_ventili', 'blok_pukao', 'blok_ravan'])
  })

  it('picks the control AFTER narrowing — four causes become two buttons, not a dropdown', () => {
    // Unfiltered the field has four options and would be a dropdown; under Glava it has two.
    const view = categoryFieldViews(dependentFields(), { sklop_u_kvaru: 'glava' }).find(
      (candidate) => candidate.code === 'uzrok_kvara',
    )
    expect(view?.control).toBe('segmented')
  })

  it('leaves an independent field alone', () => {
    const views = categoryFieldViews(dependentFields(), {})
    expect(views.find((view) => view.code === 'sklop_u_kvaru')?.awaitingParent).toBeNull()
  })
})

describe('clearOrphanedCategoryFieldAnswers', () => {
  it('drops an answer whose assembly changed under it', () => {
    expect(
      clearOrphanedCategoryFieldAnswers(
        { sklop_u_kvaru: 'blok', uzrok_kvara: 'glava_ventili' },
        dependentFields(),
      ),
    ).toEqual({ sklop_u_kvaru: 'blok' })
  })

  it('drops it when the assembly was cleared altogether', () => {
    expect(
      clearOrphanedCategoryFieldAnswers({ uzrok_kvara: 'glava_ventili' }, dependentFields()),
    ).toEqual({})
  })

  it('keeps a pair that belongs together, and anything with no parent at all', () => {
    expect(
      clearOrphanedCategoryFieldAnswers(
        { sklop_u_kvaru: 'glava', uzrok_kvara: 'glava_ventili' },
        dependentFields(),
      ),
    ).toEqual({ sklop_u_kvaru: 'glava', uzrok_kvara: 'glava_ventili' })
  })
})

describe('hasUnansweredSelectFields', () => {
  it('is true while a picked question has no answer', () => {
    const fields = dependentFields()
    expect(hasUnansweredSelectFields(categoryFieldViews(fields, {}), {})).toBe(true)
    expect(
      hasUnansweredSelectFields(categoryFieldViews(fields, { sklop_u_kvaru: 'glava' }), {
        sklop_u_kvaru: 'glava',
      }),
    ).toBe(true)
  })

  it('is false once every picked question is answered', () => {
    const values = { sklop_u_kvaru: 'glava', uzrok_kvara: 'glava_ventili' }
    expect(hasUnansweredSelectFields(categoryFieldViews(dependentFields(), values), values)).toBe(
      false,
    )
  })

  it('ignores a typed field and a retired one — neither is a question being asked today', () => {
    const typed = field({ code: 'predjeno_km', name: 'Pređeno km', fieldType: 'text', options: [] })
    const retired = field({ code: 'stari', name: 'Stari', isActive: false })
    expect(hasUnansweredSelectFields(categoryFieldViews([typed], {}), {})).toBe(false)
    expect(
      hasUnansweredSelectFields(categoryFieldViews([retired], { stari: 'glava' }), {
        stari: 'glava',
      }),
    ).toBe(false)
  })
})
