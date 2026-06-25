import { describe, expect, it } from 'vitest'

import { ResourceCatalogStatusFilter } from '../../schemas/resource-catalog-search.schema.js'
import { filterResourceCatalogItems, paginateClientList } from '../resource-catalog-client.js'

interface SampleItem {
  id: string
  code: string
  isActive: boolean
}

const items: SampleItem[] = [
  { id: '1', code: 'ZZZ-ACTIVE', isActive: true },
  { id: '2', code: 'ZZZ-INACTIVE', isActive: false },
  { id: '3', code: 'AAA', isActive: true },
]

describe('filterResourceCatalogItems', () => {
  it('filters by inactive status and search query', () => {
    const filtered = filterResourceCatalogItems(items, {
      status: ResourceCatalogStatusFilter.Inactive,
      query: 'zzz',
      getSearchableText: (item) => item.code,
    })

    expect(filtered).toEqual([{ id: '2', code: 'ZZZ-INACTIVE', isActive: false }])
  })

  it('returns all items when status is all and query is empty', () => {
    expect(
      filterResourceCatalogItems(items, {
        status: ResourceCatalogStatusFilter.All,
        getSearchableText: (item) => item.code,
      }),
    ).toEqual(items)
  })
})

describe('paginateClientList', () => {
  it('returns a page slice and clamps page to available range', () => {
    const page = paginateClientList(items, 99, 2)

    expect(page).toEqual({
      items: [items[2]],
      total: 3,
      page: 2,
      pageSize: 2,
      totalPages: 2,
    })
  })
})
