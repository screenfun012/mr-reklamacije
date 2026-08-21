import { describe, expect, it } from 'vitest'

import { ClaimCategoryCountsResponseSchema } from '../claim-category-counts.schema.js'

describe('ClaimCategoryCountsResponseSchema', () => {
  it('parses a scoped answer that still names a retired category carrying claims', () => {
    const parsed = ClaimCategoryCountsResponseSchema.parse({
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          code: 'MASINSKA_OBRADA',
          name: 'Mašinska obrada',
          sortOrder: 20,
          isActive: true,
          total: 14,
          pending: 9,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          code: 'KOMPRESORI',
          name: 'Kompresori',
          sortOrder: 90,
          isActive: false,
          total: 1,
          pending: 0,
        },
      ],
      totals: { total: 120, pending: 39 },
    })

    expect(parsed.items[1]?.isActive).toBe(false)
    expect(parsed.totals.pending).toBe(39)
  })

  it('refuses a negative count — a badge can be zero, never less', () => {
    expect(() =>
      ClaimCategoryCountsResponseSchema.parse({ items: [], totals: { total: -1, pending: 0 } }),
    ).toThrow()
  })
})
