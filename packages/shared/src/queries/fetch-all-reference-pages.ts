import { fetchJson } from '../api/fetch-json.js'
import type { ReferenceListResponse } from '../schemas/reference-data.schema.js'
import { serializeReferenceListParams } from './serialize-search-params.js'

export async function fetchAllReferencePages<T>(
  path: string,
  baseFilters: Record<string, string | number | boolean | undefined>,
): Promise<T[]> {
  const items: T[] = []
  let cursor: string | undefined

  do {
    const query = serializeReferenceListParams({ ...baseFilters, limit: 50 }, cursor)
    const page = await fetchJson<ReferenceListResponse<T>>(`${path}?${query}`)
    items.push(...page.items)
    cursor = page.nextCursor ?? undefined
  } while (cursor !== undefined)

  return items
}
