import { sql, type SQL } from 'drizzle-orm'

/**
 * PostgreSQL expression mirroring @mr/shared normalizeMrKey:
 * trim, collapse internal whitespace, lowercase. Does not strip MR prefix.
 */
export function sqlNormalizeMrKey(column: SQL | string): SQL<string> {
  if (typeof column === 'string') {
    return sql<string>`lower(regexp_replace(trim(${column}), '\\s+', ' ', 'g'))`
  }
  return sql<string>`lower(regexp_replace(trim(${column}), '\\s+', ' ', 'g'))`
}

/** Literal input for tests and migration pre-checks. */
export function sqlNormalizeMrKeyLiteral(value: string): SQL<string> {
  return sql<string>`lower(regexp_replace(trim(${value}), '\\s+', ' ', 'g'))`
}
