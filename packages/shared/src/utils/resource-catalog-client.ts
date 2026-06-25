import type { ResourceCatalogStatusFilter } from '../schemas/resource-catalog-search.schema.js'
import { ResourceCatalogStatusFilter as StatusFilter } from '../schemas/resource-catalog-search.schema.js'

export function filterResourceCatalogItems<TItem extends { isActive: boolean }>(
  items: readonly TItem[],
  options: {
    query?: string | undefined
    status: ResourceCatalogStatusFilter
    getSearchableText: (item: TItem) => string
  },
): TItem[] {
  let result = [...items]

  if (options.status === StatusFilter.Active) {
    result = result.filter((item) => item.isActive)
  } else if (options.status === StatusFilter.Inactive) {
    result = result.filter((item) => !item.isActive)
  }

  const normalizedQuery = options.query?.trim().toLowerCase()
  if (normalizedQuery) {
    result = result.filter((item) =>
      options.getSearchableText(item).toLowerCase().includes(normalizedQuery),
    )
  }

  return result
}

export interface ClientListPage<TItem> {
  items: TItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function paginateClientList<TItem>(
  items: readonly TItem[],
  page: number,
  pageSize: number,
): ClientListPage<TItem> {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = total === 0 ? 1 : Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * pageSize

  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  }
}
