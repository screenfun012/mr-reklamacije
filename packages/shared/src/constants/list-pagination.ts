export const LIST_PAGE_SIZE_OPTIONS = [10, 25, 50] as const

export type ListPageSize = (typeof LIST_PAGE_SIZE_OPTIONS)[number]

export function isListPageSize(value: number): value is ListPageSize {
  return value === 10 || value === 25 || value === 50
}
