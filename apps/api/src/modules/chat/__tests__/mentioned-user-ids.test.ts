import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import { mentionedUserIds } from '../chat.repository.js'

const dialect = new PgDialect()

/**
 * The name lookup behind every mention chip. What is pinned here is not the words of the SQL but
 * the SHAPE: one bind parameter for the whole list.
 */
describe('mentionedUserIds', () => {
  it('binds the whole list as ONE parameter', () => {
    const query = dialect.sqlToQuery(mentionedUserIds(['a', 'b', 'c']))

    expect(query.params).toEqual([['a', 'b', 'c']])
    expect(query.sql).toContain('$1')
    expect(query.sql).not.toContain('$2')
  })

  it('asks Postgres for an array, not a row', () => {
    // ⚠ The trap this exists for: interpolating a bare array into an `sql` template does not bind
    // an array — drizzle walks it and emits `($1, $2, $3)`, a ROW constructor. `ANY(($1, $2, $3))`
    // is a syntax error, and no cast rescues it, because the value never was an array.
    const query = dialect.sqlToQuery(mentionedUserIds(['a', 'b']))

    expect(query.sql).toContain('ANY($1::uuid[])')
    expect(query.sql).not.toContain('ANY(($1')
  })

  it('stays one parameter as the list grows — that is the whole point', () => {
    const many = Array.from({ length: 500 }, (_, index) => `id-${index}`)

    expect(dialect.sqlToQuery(mentionedUserIds(many)).params).toHaveLength(1)
  })

  it('survives an empty list without emitting broken SQL', () => {
    const query = dialect.sqlToQuery(mentionedUserIds([]))

    expect(query.params).toEqual([[]])
    expect(query.sql).toContain('ANY($1::uuid[])')
  })
})
