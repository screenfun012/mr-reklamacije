import { describe, expect, it } from 'vitest'

import { claimCategoriesResourceDefinition } from '../claim-categories.definition.js'

describe('claimCategoriesResourceDefinition', () => {
  it('keeps the code fixed once the category exists', () => {
    const createFields = claimCategoriesResourceDefinition.formFields.filter((f) => !f.editOnly)
    const editFields = claimCategoriesResourceDefinition.formFields.filter((f) => !f.createOnly)

    expect(createFields.find((f) => f.key === 'code')?.type).toBe('text')
    expect(editFields.find((f) => f.key === 'code')?.type).toBe('readonly')
  })

  it('blocks hard delete while claims still use the category', () => {
    expect(
      claimCategoriesResourceDefinition.lifecycle?.getUsageCount({ usageCount: 3 } as never),
    ).toBe(3)
  })
})
