import { ValidationError } from '../errors/domain-errors.js'

export interface KeysetCursor {
  primary: string | number
  id: string
}

export interface PaginatedSlice<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

export function encodeKeysetCursor(cursor: KeysetCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodeKeysetCursor(encoded: string): KeysetCursor {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Invalid cursor')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid cursor')
  }

  const record = parsed as Record<string, unknown>
  const primary = record['primary']
  const id = record['id']

  if (
    (typeof primary !== 'string' && typeof primary !== 'number') ||
    typeof id !== 'string' ||
    id.length === 0
  ) {
    throw new Error('Invalid cursor')
  }

  return { primary, id }
}

export function parseOptionalKeysetCursor(cursor: string | undefined): KeysetCursor | null {
  if (cursor === undefined) {
    return null
  }

  try {
    return decodeKeysetCursor(cursor)
  } catch {
    throw new ValidationError('Invalid cursor')
  }
}

export function buildPaginatedSlice<T>(
  rows: T[],
  limit: number,
  getCursor: (item: T) => KeysetCursor,
): PaginatedSlice<T> {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const lastItem = items.at(-1)
  const nextCursor =
    hasMore && lastItem !== undefined ? encodeKeysetCursor(getCursor(lastItem)) : null

  return { items, nextCursor, hasMore }
}
