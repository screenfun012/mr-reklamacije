import { and, eq, gt, lt, or, type SQL } from 'drizzle-orm'
import type { AnyColumn } from 'drizzle-orm'

import type { KeysetCursor } from './pagination.js'

export function keysetAfter(
  primaryColumn: AnyColumn,
  idColumn: AnyColumn,
  cursor: KeysetCursor | null,
): SQL | undefined {
  if (cursor === null) {
    return undefined
  }

  return or(
    gt(primaryColumn, cursor.primary),
    and(eq(primaryColumn, cursor.primary), gt(idColumn, cursor.id)),
  )
}

/** Keyset condition for ORDER BY primary DESC, id DESC (next page = older rows). */
export function keysetBefore(
  primaryColumn: AnyColumn,
  idColumn: AnyColumn,
  cursor: KeysetCursor | null,
): SQL | undefined {
  if (cursor === null) {
    return undefined
  }

  return or(
    lt(primaryColumn, cursor.primary),
    and(eq(primaryColumn, cursor.primary), lt(idColumn, cursor.id)),
  )
}
