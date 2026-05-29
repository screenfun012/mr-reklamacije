import { and, eq, gt, or, type SQL } from 'drizzle-orm'
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
