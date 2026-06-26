import { describe, expect, it } from 'vitest'

import { ResourceCatalogSearchSchema } from '../resource-catalog-search.schema.js'

describe('ResourceCatalogSearchSchema', () => {
  it('applies defaults for empty search params', () => {
    expect(ResourceCatalogSearchSchema.parse({})).toEqual({
      page: 1,
      pageSize: 25,
      status: 'all',
    })
  })

  it('parses query, status, and pagination from URL search', () => {
    expect(
      ResourceCatalogSearchSchema.parse({
        page: '2',
        pageSize: '50',
        q: 'ZZZ',
        status: 'inactive',
      }),
    ).toEqual({
      page: 2,
      pageSize: 50,
      q: 'ZZZ',
      status: 'inactive',
    })
  })

  it('parses manufacturer filter from URL search', () => {
    expect(
      ResourceCatalogSearchSchema.parse({
        manufacturerId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).toEqual({
      page: 1,
      pageSize: 25,
      status: 'all',
      manufacturerId: '550e8400-e29b-41d4-a716-446655440000',
    })
  })
})
