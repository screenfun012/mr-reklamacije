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

describe('migrations 0046 + 0048 — category fields catalogue', () => {
  it('seeds "Obrađeni deo" with the parts the shop machines, and nothing is deactivated', async () => {
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
    // 0046 opened it with the three big ones; 0048 added what the shop's own departments say it
    // also machines. Order is the office's `sort_order`, not insertion order.
    expect(options.map((option) => option.code)).toEqual([
      'glava',
      'blok',
      'radilica',
      'klipnjaca',
      'zamajac',
      'ostalo',
    ])
  })

  it('takes a chosen answer or a typed one, and nothing else', async () => {
    const categoryId = await machiningCategoryId()

    // `text` is for fields that are written rather than picked — "Mera obrade" is the seeded one,
    // so this proves the type on a code the catalogue does not already hold.
    await expect(
      db.insert(schema.claimCategoryFields).values({
        categoryId,
        code: 'mera_zazora',
        name: 'Mera zazora (mm)',
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

  it('gives every kind of work its own starting fields, and asks nothing of them (0048)', async () => {
    const fields = await db
      .select({
        categoryCode: schema.claimCategories.code,
        id: schema.claimCategoryFields.id,
        code: schema.claimCategoryFields.code,
        fieldType: schema.claimCategoryFields.fieldType,
        isRequired: schema.claimCategoryFields.isRequired,
      })
      .from(schema.claimCategoryFields)
      .innerJoin(
        schema.claimCategories,
        eq(schema.claimCategories.id, schema.claimCategoryFields.categoryId),
      )
      .orderBy(schema.claimCategories.sortOrder, schema.claimCategoryFields.sortOrder)

    // Only the seeded codes are compared, in their `sort_order`: the office adds fields of its own
    // from the admin panel, and another suite's leftovers must not decide whether this one passes.
    function seededOrder(categoryCode: string, expected: string[]): string[] {
      return fields
        .filter((field) => field.categoryCode === categoryCode && expected.includes(field.code))
        .map((field) => field.code)
    }

    const catalogue: [string, string[]][] = [
      ['REMONT_MOTORA', ['sklop_u_kvaru', 'pojava_kvara', 'predjeno_km', 'ko_je_ugradio']],
      ['MASINSKA_OBRADA', ['obradjeni_deo', 'vrsta_obrade', 'mera_obrade', 'prijavljena_pojava']],
      ['NOVI_DELOVI', ['vrsta_dela', 'kataloski_broj', 'razlog_reklamacije']],
      ['AUTO_SERVIS', ['vrsta_usluge', 'pojava_kvara', 'predjeno_km']],
    ]
    for (const [categoryCode, expected] of catalogue) {
      expect(seededOrder(categoryCode, expected)).toEqual(expected)
    }

    const seeded = fields.filter((field) =>
      catalogue.some(
        ([categoryCode, codes]) =>
          field.categoryCode === categoryCode && codes.includes(field.code),
      ),
    )

    // A required field refuses the whole create, and the wizard reports that as one banner at the
    // end. The office turns one on when it wants that — the migration never does it for them.
    expect(seeded.filter((field) => field.isRequired)).toEqual([])

    const options = await db
      .select({
        fieldId: schema.claimCategoryFieldOptions.fieldId,
        code: schema.claimCategoryFieldOptions.code,
      })
      .from(schema.claimCategoryFieldOptions)

    // Every picked field has something to pick; every written one has nothing hanging off it.
    for (const field of seeded) {
      const count = options.filter((option) => option.fieldId === field.id).length
      expect({ code: field.code, hasOptions: count > 1 }).toEqual({
        code: field.code,
        hasOptions: field.fieldType === 'select',
      })
    }
  })

  it('lets an option hang off an option of another field of the same category', async () => {
    const categoryId = await machiningCategoryId()
    const [partField] = await db
      .select({ id: schema.claimCategoryFields.id })
      .from(schema.claimCategoryFields)
      .where(eq(schema.claimCategoryFields.code, 'obradjeni_deo'))
    const [parent] = await db
      .select({ id: schema.claimCategoryFieldOptions.id })
      .from(schema.claimCategoryFieldOptions)
      .where(eq(schema.claimCategoryFieldOptions.fieldId, partField?.id ?? ''))
      .limit(1)

    const [childField] = await db
      .insert(schema.claimCategoryFields)
      .values({ categoryId, code: 'kvar_na_delu', name: 'Kvar na delu' })
      .returning({ id: schema.claimCategoryFields.id })
    const [child] = await db
      .insert(schema.claimCategoryFieldOptions)
      .values({
        fieldId: childField?.id ?? '',
        code: 'pukla',
        name: 'Pukla',
        parentOptionId: parent?.id ?? null,
      })
      .returning({ parentOptionId: schema.claimCategoryFieldOptions.parentOptionId })

    // The dependency lives on the option: this answer is offered only under that part.
    expect(child?.parentOptionId).toBe(parent?.id)
  })

  it('keeps an option that something still hangs off (RESTRICT)', async () => {
    const categoryId = await machiningCategoryId()
    const [partField] = await db
      .select({ id: schema.claimCategoryFields.id })
      .from(schema.claimCategoryFields)
      .where(eq(schema.claimCategoryFields.code, 'obradjeni_deo'))
    const [parent] = await db
      .select({ id: schema.claimCategoryFieldOptions.id })
      .from(schema.claimCategoryFieldOptions)
      .where(eq(schema.claimCategoryFieldOptions.fieldId, partField?.id ?? ''))
      .limit(1)
    const [childField] = await db
      .insert(schema.claimCategoryFields)
      .values({ categoryId, code: 'kvar_na_delu_2', name: 'Kvar na delu' })
      .returning({ id: schema.claimCategoryFields.id })
    await db.insert(schema.claimCategoryFieldOptions).values({
      fieldId: childField?.id ?? '',
      code: 'pukla',
      name: 'Pukla',
      parentOptionId: parent?.id ?? null,
    })

    // Removing the part would leave a cause hanging off nothing — the database refuses first.
    await expectConstraint(
      db
        .delete(schema.claimCategoryFieldOptions)
        .where(eq(schema.claimCategoryFieldOptions.id, parent?.id ?? '')),
      'claim_category_field_options_parent_option_id_fkey',
    )
  })

  it('offers a cause for every assembly, and every cause hangs off its assembly (0052)', async () => {
    const [overhaul] = await db
      .select({ id: schema.claimCategories.id })
      .from(schema.claimCategories)
      .where(eq(schema.claimCategories.code, 'REMONT_MOTORA'))
    const fields = await db
      .select({
        id: schema.claimCategoryFields.id,
        code: schema.claimCategoryFields.code,
        isRequired: schema.claimCategoryFields.isRequired,
      })
      .from(schema.claimCategoryFields)
      .where(eq(schema.claimCategoryFields.categoryId, overhaul?.id ?? ''))

    const cause = fields.find((field) => field.code === 'uzrok_kvara')
    const part = fields.find((field) => field.code === 'sklop_u_kvaru')
    expect(cause).toBeDefined()
    // Like everything 0048 seeded: a required field refuses the whole create, and the office
    // turns that on from the admin panel when it wants it.
    expect(cause?.isRequired).toBe(false)

    const parts = await db
      .select({
        id: schema.claimCategoryFieldOptions.id,
        code: schema.claimCategoryFieldOptions.code,
      })
      .from(schema.claimCategoryFieldOptions)
      .where(eq(schema.claimCategoryFieldOptions.fieldId, part?.id ?? ''))
    const causes = await db
      .select({
        code: schema.claimCategoryFieldOptions.code,
        parentOptionId: schema.claimCategoryFieldOptions.parentOptionId,
      })
      .from(schema.claimCategoryFieldOptions)
      .where(eq(schema.claimCategoryFieldOptions.fieldId, cause?.id ?? ''))

    // Not one cause is offered on its own: a cause with no assembly would be a question the
    // screen could never narrow, and the server would have nothing to check it against.
    expect(causes.filter((option) => option.parentOptionId === null)).toEqual([])

    const partById = new Map(parts.map((option) => [option.id, option.code]))
    const covered = new Set(causes.map((option) => partById.get(option.parentOptionId ?? '')))
    expect(covered).toEqual(new Set(parts.map((option) => option.code)))
  })
})
