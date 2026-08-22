import { describe, expect, it } from 'vitest'

import {
  ClaimCategoryFieldOptionListItemSchema,
  ClaimCategoryFieldOptionUpdateInputSchema,
} from '../claim-category-field.schema.js'

const baseOption = {
  id: '22222222-2222-4222-8222-222222222222',
  fieldId: '33333333-3333-4333-8333-333333333333',
  fieldName: 'Uzrok kvara',
  code: 'ventili',
  name: 'Ventili ne zaptivaju',
  sortOrder: 10,
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-08-22T00:00:00.000Z',
  usageCount: 0,
}

describe('ClaimCategoryFieldOption schemas', () => {
  it('carries the parent of a dependent option, and lets an update clear it', () => {
    const item = ClaimCategoryFieldOptionListItemSchema.parse({
      ...baseOption,
      parentOptionId: '11111111-1111-4111-8111-111111111111',
      parentFieldCode: 'sklop_u_kvaru',
      parentOptionCode: 'glava',
    })
    expect(item.parentOptionCode).toBe('glava')
    expect(item.parentFieldCode).toBe('sklop_u_kvaru')
    expect(
      ClaimCategoryFieldOptionListItemSchema.parse({
        ...baseOption,
        parentOptionId: null,
        parentFieldCode: null,
        parentOptionCode: null,
      }).parentOptionId,
    ).toBeNull()
    expect(
      ClaimCategoryFieldOptionUpdateInputSchema.parse({ parentOptionId: null }).parentOptionId,
    ).toBeNull()
  })
})
