import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type pg from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb, createPool } from '../../client.js'
import * as schema from '../../schema/index.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let pool: pg.Pool
let client: pg.PoolClient
let db: NodePgDatabase<typeof schema>

beforeAll(async () => {
  pool = createPool(getIntegrationDatabaseUrl())
  await migrate(createDb(pool), { migrationsFolder: resolve(__dirname, '../../../migrations') })
})

// Transaction-per-test, like the claim-categories suite beside it: real isolation without
// TRUNCATE and without depending on another suite's seed surviving.
beforeEach(async () => {
  client = await pool.connect()
  await client.query('BEGIN')
  db = drizzle(client, { schema }) as NodePgDatabase<typeof schema>
})

afterEach(async () => {
  await client.query('ROLLBACK')
  client.release()
})

afterAll(async () => {
  await pool.end()
})

/**
 * Drizzle wraps a failed query in its own Error ("Failed query: …") and keeps the driver's error
 * as the cause — the constraint's NAME is only in there. Asserting on it beats a message match:
 * it pins which rule refused, not which sentence Drizzle happened to print.
 */
async function expectConstraint(run: Promise<unknown>, constraint: string): Promise<void> {
  await expect(run).rejects.toSatisfy((error: unknown) => {
    const cause = (error as { cause?: { constraint?: string } }).cause
    return cause?.constraint === constraint
  })
}

async function machiningCategoryId(): Promise<string> {
  const [category] = await db
    .select({ id: schema.claimCategories.id })
    .from(schema.claimCategories)
    .where(eq(schema.claimCategories.code, 'MASINSKA_OBRADA'))
  if (category === undefined) {
    throw new Error('MASINSKA_OBRADA missing — migration 0045 did not run')
  }
  return category.id
}

describe('migration 0046 — category fields catalogue', () => {
  it('seeds "Obrađeni deo" with three options on MASINSKA_OBRADA, and nothing is deactivated', async () => {
    const [field] = await db
      .select()
      .from(schema.claimCategoryFields)
      .where(eq(schema.claimCategoryFields.code, 'obradjeni_deo'))
    expect(field).toBeDefined()
    expect(field?.fieldType).toBe('select')
    expect(field?.deactivatedAt).toBeNull()
    expect(field?.categoryId).toBe(await machiningCategoryId())

    const [category] = await db
      .select({ deactivatedAt: schema.claimCategories.deactivatedAt })
      .from(schema.claimCategories)
      .where(eq(schema.claimCategories.code, 'MASINSKA_OBRADA'))
    expect(category?.deactivatedAt).toBeNull()

    const options = await db
      .select({ code: schema.claimCategoryFieldOptions.code })
      .from(schema.claimCategoryFieldOptions)
      .where(eq(schema.claimCategoryFieldOptions.fieldId, field?.id ?? ''))
      .orderBy(schema.claimCategoryFieldOptions.sortOrder)
    expect(options.map((option) => option.code)).toEqual(['glava', 'blok', 'radilica'])
  })

  it('takes a chosen answer or a typed one, and nothing else', async () => {
    const categoryId = await machiningCategoryId()

    // `text` was added in 0047 for fields like "Mera obrade (mm)" that are written, not picked.
    await expect(
      db.insert(schema.claimCategoryFields).values({
        categoryId,
        code: 'mera_obrade',
        name: 'Mera obrade (mm)',
        fieldType: 'text',
        isRequired: true,
      }),
    ).resolves.toBeDefined()

    // A third type is a row in the CHECK, not a schema migration — but until it is added, the
    // database says no rather than storing something no screen can render.
    await expectConstraint(
      db.insert(schema.claimCategoryFields).values({
        categoryId,
        code: 'nope',
        name: 'Nope',
        fieldType: 'number' as 'text',
      }),
      'claim_category_fields_field_type_check',
    )
  })

  it('asks for nothing by default — a field becomes required only when the office says so', async () => {
    const [field] = await db
      .select({ isRequired: schema.claimCategoryFields.isRequired })
      .from(schema.claimCategoryFields)
      .where(eq(schema.claimCategoryFields.code, 'obradjeni_deo'))
      .limit(1)

    // The seeded field predates `is_required`; a backfill that defaulted it to true would have
    // marked every machining claim in the shop as incomplete overnight.
    expect(field?.isRequired).toBe(false)
  })

  it('keeps the same code from being used twice inside one category', async () => {
    await expectConstraint(
      db.insert(schema.claimCategoryFields).values({
        categoryId: await machiningCategoryId(),
        code: 'obradjeni_deo',
        name: 'Duplikat',
      }),
      'claim_category_fields_category_code_key',
    )
  })

  // One deliberate failure per test: a refused statement aborts the whole transaction, so a
  // second query in the same test would fail for the wrong reason (CLAUDE.md, integration notes).
  it('keeps a category that still owns fields (RESTRICT)', async () => {
    const categoryId = await machiningCategoryId()
    await expectConstraint(
      db.delete(schema.claimCategories).where(eq(schema.claimCategories.id, categoryId)),
      'claim_category_fields_category_id_fkey',
    )
  })

  it('keeps a field that still owns options (RESTRICT)', async () => {
    const [field] = await db
      .select({ id: schema.claimCategoryFields.id })
      .from(schema.claimCategoryFields)
      .where(eq(schema.claimCategoryFields.code, 'obradjeni_deo'))
    await expectConstraint(
      db
        .delete(schema.claimCategoryFields)
        .where(eq(schema.claimCategoryFields.id, field?.id ?? '')),
      'claim_category_field_options_field_id_fkey',
    )
  })

  it("keys a claim's answers by the category they were entered under", async () => {
    const categoryId = await machiningCategoryId()
    const [user] = await db.select({ id: schema.users.id }).from(schema.users).limit(1)
    if (user === undefined) {
      throw new Error('no user to own a claim')
    }

    const [domace] = await db
      .insert(schema.domaceClaims)
      .values({
        outcome: 'pending',
        claimYear: 2026,
        categoryId,
        categoryFieldValues: { [categoryId]: { obradjeni_deo: 'glava' } },
        createdBy: user.id,
      })
      .returning({ values: schema.domaceClaims.categoryFieldValues })
    // Nested, not flat: this is what lets a claim keep what it answered under a kind of work it
    // has since been moved away from.
    expect(domace?.values).toEqual({ [categoryId]: { obradjeni_deo: 'glava' } })

    const [emotiveDefault] = await db
      .select({ values: schema.emotiveClaims.categoryFieldValues })
      .from(schema.emotiveClaims)
      .limit(1)
    // Existing rows are untouched by the migration: no value is not an empty object.
    expect(emotiveDefault?.values ?? null).toBeNull()
  })
})
