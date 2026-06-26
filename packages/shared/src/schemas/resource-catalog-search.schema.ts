import { z } from 'zod'

import { LIST_PAGE_SIZE_OPTIONS } from '../constants/list-pagination.js'

export const ResourceCatalogStatusFilter = {
  All: 'all',
  Active: 'active',
  Inactive: 'inactive',
} as const

export type ResourceCatalogStatusFilter =
  (typeof ResourceCatalogStatusFilter)[keyof typeof ResourceCatalogStatusFilter]

const resourceCatalogStatusValues = [
  ResourceCatalogStatusFilter.All,
  ResourceCatalogStatusFilter.Active,
  ResourceCatalogStatusFilter.Inactive,
] as const

export const ResourceCatalogSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(10), z.literal(25), z.literal(50)]))
    .default(25),
  q: z.string().trim().min(1).optional(),
  status: z.enum(resourceCatalogStatusValues).default(ResourceCatalogStatusFilter.All),
  manufacturerId: z.string().uuid().optional(),
})

export type ResourceCatalogSearch = z.infer<typeof ResourceCatalogSearchSchema>

export function resourceCatalogPaginationFromSearch(search: ResourceCatalogSearch): {
  page: number
  pageSize: (typeof LIST_PAGE_SIZE_OPTIONS)[number]
} {
  return {
    page: search.page,
    pageSize: search.pageSize,
  }
}
