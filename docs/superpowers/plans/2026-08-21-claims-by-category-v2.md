# Claims by Category — V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the claim category a first-class entrance to claims — a menu tree fed by the catalogue, a list in two modes, one create wizard with a kind step — and turn "category fields" (e.g. which part was machined) into a catalogue the admin panel edits, stored on the claim and counted by statistics.

**Architecture:** One migration (`0046`) adds `deactivated_at` to categories, two catalogue tables (`claim_category_fields`, `claim_category_field_options`) and a `category_field_values` jsonb on each claim table. One scope-aware counts endpoint feeds the menu, the list header and the filter. The create wizard is one shell (kind step, stepper, category chip, buttons) over two kind-specific step sets, each with its own form and POST — `docs/04`'s separate-forms rule holds. Nothing anywhere branches on a category or field code.

**Tech Stack:** Drizzle + PostgreSQL (jsonb, CHECK) · Hono · Zod 4 in `@mr/shared` · TanStack Start/Router (`staticData`, `useMatches`)/Query/Form · Radix Popover via `@mr/ui` · Paraglide · Vitest (unit + real-Postgres integration) · Playwright for the final walk.

**Spec:** `docs/superpowers/specs/2026-08-21-claims-by-category-v2-design.md` (approved 21.08.2026). **Visual source of truth:** `design_handoff_claim_categories/kategorije-prototip.dc.html` — serve the folder over HTTP (`python3 -m http.server` inside it; `support.js` is beside it) and READ values, never estimate.

## Global Constraints

- **Merge, don't choose (spec intro):** everything that exists today stays; everything the prototype draws and we lack is added; where they differ only in place or look, the prototype wins. Not covered by either → ask, never improvise.
- **Nothing branches on a code (spec §1, §3):** no `if (category === 'MASINSKA_OBRADA')`, no `if (field === 'obradjeni_deo')` in any layer. `MACHINING_CLAIM_CATEGORY_CODE` / `ENGINE_OVERHAUL_CLAIM_CATEGORY_CODE` stay for the portal's two tabs only; internal-web stops importing them.
- **No dead code (spec §3):** the long DOMAĆE form, the old create routes, yesterday's sidebar machinery (`explicitUndefined`, `paintsAsActive`, `NavItem.search`) are deleted, not left behind.
- **Docs before new usage (spec §3):** a task that uses a stack feature in a new way starts by reading its documentation (Context7). Already verified 21.08.: `staticData.getTitle` + `useMatches()` for breadcrumbs; `retainSearchParams` evaluated and NOT used.
- **Migration procedure (CLAUDE.md §3):** check `packages/db/migrations/meta/_journal.json` ends at `0045` → `pnpm --filter @mr/db run db:generate` (never hand-written DDL) → data statements appended by hand → migrate-from-zero proven by the integration setup → confirm the file holds only the intended DDL.
- **Server is the judge (spec §4.6, §12):** every route `requirePermission`/`requirePermissions`; `categoryFieldValues` validated by Zod then by the service against the live catalogue; portal whitelist gains nothing; every catalogue mutation audited; only parameterized SQL.
- **i18n:** every user string via Paraglide `m.*`, keys in BOTH `packages/i18n/src/messages/sr.json` and `en.json`, alphabetical. No ICU plurals — "Nerešeno: 9", never "9 reklamacija". After editing messages: `pnpm --filter @mr/i18n run compile` for dev, `pnpm --filter @mr/i18n run build` before typecheck (a NEW key typechecks red until built).
- **Prod builds read `dist`:** after editing `@mr/shared`, run `pnpm --filter @mr/shared build` before an app `build`/`typecheck`.
- **Full gate before every commit**, split, under `TZ=UTC`, on this machine:
  ```bash
  pnpm format:check \
    && TZ=UTC pnpm exec turbo run build typecheck lint --force --concurrency=4 \
    && TZ=UTC pnpm exec turbo run test --force --concurrency=2 \
    && pnpm --filter api depcruise && TZ=UTC pnpm test:integration
  ```
- **Every rule with an edge ships a test seen red first**, and the rules marked ⚙ below are mutation-checked (break the line, watch the test go red, restore).
- **Branch:** everything lands on `feat/claim-category` (migration `0045` lives only there). Commit after each task; push when the gate is green.
- **Never start or kill the dev servers** (`pnpm dev:all` is Nikola's). Browser verification uses Playwright from `apps/api/node_modules/playwright`.

---

## File structure (locked here so tasks agree on names)

**`packages/db`**
- `src/schema/catalogs.ts` — `claimCategories` + `deactivatedAt`; NEW `claimCategoryFields`, `claimCategoryFieldOptions` + relations.
- `src/schema/claims.ts` — `emotiveClaims.categoryFieldValues`, `domaceClaims.categoryFieldValues`.
- `migrations/0046_*.sql` — generated + appended seed.
- `src/__tests__/integration/claim-category-fields.integration.test.ts` — migration proof.

**`packages/shared`**
- `src/schemas/reference-data.schema.ts` — `ClaimCategoryRefSchema` + `isActive`/`deactivatedAt`; `ClaimCategoryListItemSchema` + `deactivatedAt`.
- `src/schemas/claim-category-field.schema.ts` (NEW) — field/option list items, create/update inputs, list queries, `ClaimCategoryFieldValuesSchema`.
- `src/schemas/claim-category-counts.schema.ts` (NEW) — counts response.
- `src/utils/category-field-states.ts` (NEW) — `resolveCategoryFieldStates` (four states).
- `src/queries/claims.ts` — `claimCategoryCountsOptions`; `src/queries/claim-keys.ts` — `categoryCounts` key.
- `src/queries/claim-category-fields.ts` (NEW) — field/option reference queries + `claimCategoryFieldsForCategoryOptions`.
- `src/queries/invalidate-internal-claim-queries.ts`, `src/constants/resource-query-map.ts` — invalidation of the new keys.
- `src/queries/claim-detail-search.ts` — optional `categoryCode`.
- `src/constants/audit.ts` — three entity types; `src/constants/statistics-rank-colors.ts` — two bucket codes.
- `src/schemas/statistics.schema.ts` — `byCategoryFields`.

**`apps/api`**
- `src/modules/claims/*` — `categoryCounts` (repository/service/controller/route), `resolveViewScope`.
- `src/modules/claim-category-fields/*` and `src/modules/claim-category-field-options/*` (NEW, catalogue template).
- `src/core/claims/validate-category-field-values.ts` (NEW, pure).
- `src/modules/emotive-claims/*`, `src/modules/domace-claims/*` — values in create/update/detail; validation wired; `ClaimCategoryFieldsRepository` injected.
- `src/modules/statistics/*` — `fetchByCategoryFields`.
- `src/core/container.ts`, `src/app.ts`, `src/test-helpers/test-app.ts` — wiring.

**`apps/admin-web`**
- `src/resources/claim-category-fields.definition.ts`, `src/resources/claim-category-field-options.definition.ts` (NEW).
- `src/routes/_shell/settings/claim-category-fields/index.tsx`, `.../claim-category-field-options/index.tsx` (NEW).
- `src/lib/resource/reference-select-registry.ts` — keys `claim-categories`, `claim-category-fields`.
- `src/config/navigation.ts` — two entries.

**`apps/internal-web`**
- `src/config/navigation.ts` — group marker, no `search`, no machining entry.
- `src/components/layout/claims-nav-group.tsx` (NEW), `src/components/layout/active-claims-entry.ts` (NEW), `src/lib/use-stored-flag.ts` (NEW), `src/components/layout/internal-sidebar.tsx`.
- `src/router-static-data.d.ts` (NEW), `src/components/layout/internal-breadcrumbs.tsx` (NEW), `src/components/layout/crumbs-from-matches.ts` (NEW), `src/components/layout/internal-topbar.tsx`; `staticData` on every `_shell` route.
- `src/routes/_shell/reklamacije/kategorija/$categoryCode.tsx` (NEW), `src/routes/_shell/reklamacije/index.tsx`, `src/features/claims/claims-list-header.tsx` (NEW), `src/features/claims/claims-list-empty.tsx` (NEW), `claims-list-content.tsx`, `claims-filters.tsx`, `claims-table.tsx`, `src/features/command-palette/claim-target.ts`.
- `src/routes/_shell/reklamacije/nova.tsx` (NEW; `emotive/nova.tsx` and `domace/nova.tsx` DELETED), `src/features/claims/create/claim-create-wizard.tsx`, `claim-kind-step.tsx`, `category-chip.tsx`, `category-fields-group.tsx`, `create-steps-handle.ts` (NEW), `src/components/wizard-stepper.tsx`, `src/features/emotive-claims/create/emotive-create-steps.tsx` (NEW, replaces `emotive-claim-create-wizard.tsx`), `src/features/domace-claims/create/domace-create-steps.tsx` + `domace-step-review.tsx` (NEW; `domace-claim-create-form.tsx` DELETED).
- `src/components/claim-category-chip.tsx` (NEW), `src/features/claims/detail/category-fields-card.tsx`, `claim-faults-summary-card.tsx`, `claim-attachments-preview-card.tsx` (NEW), `src/features/emotive-claims/detail/emotive-claim-client-visibility-card.tsx` (NEW), both detail headers and detail views.
- `src/features/statistika/analytics/statistics-breakdown-charts.tsx` — category-field cards.

---

### Task 1: Data — migration `0046`, `deactivated_at`, `ClaimCategoryRef`, `category-counts`

**Files:**
- Modify: `packages/db/src/schema/catalogs.ts` (after `claimCategories`, ~line 247)
- Modify: `packages/db/src/schema/claims.ts` (`emotiveClaims` ~line 74, `domaceClaims` ~line 275)
- Create: `packages/db/migrations/0046_<generated>.sql` + journal (drizzle-kit)
- Create: `packages/db/src/__tests__/integration/claim-category-fields.integration.test.ts`
- Modify: `packages/shared/src/schemas/reference-data.schema.ts` (lines 159–202)
- Create: `packages/shared/src/schemas/claim-category-counts.schema.ts`
- Modify: `packages/shared/src/index.ts` (export the new schema file beside `claim-list.schema.js`)
- Modify: `packages/shared/src/queries/claim-keys.ts`, `packages/shared/src/queries/claims.ts`, `packages/shared/src/queries/index.ts`, `packages/shared/src/queries/invalidate-internal-claim-queries.ts`, `packages/shared/src/constants/resource-query-map.ts`
- Modify: `apps/api/src/modules/claim-categories/claim-categories.repository.ts`
- Modify: `apps/api/src/modules/emotive-claims/emotive-claims.repository.ts` (`mapCategoryRef` ~line 150; selects at ~578, ~637, ~688, ~712), `apps/api/src/modules/domace-claims/domace-claims.repository.ts` (~113, ~138, ~380, ~442, ~469)
- Modify: `apps/api/src/modules/claims/claims.repository.ts`, `claims.service.ts`, `claims.controller.ts`, `claims.routes.ts`
- Test: `apps/api/src/modules/claim-categories/__tests__/claim-categories.integration.test.ts`, `apps/api/src/modules/claims/__tests__/claims.integration.test.ts`, `packages/shared/src/queries/__tests__/invalidate-internal-claim-queries.test.ts`, `packages/shared/src/schemas/__tests__/claim-category-counts.schema.test.ts`

**Interfaces:**
- Produces: `schema.claimCategoryFields`, `schema.claimCategoryFieldOptions`, `schema.emotiveClaims.categoryFieldValues`, `schema.domaceClaims.categoryFieldValues` (Task 2, 3).
- Produces: `ClaimCategoryRef = { id, code, name, isActive: boolean, deactivatedAt: string | null }` (Tasks 6, 8).
- Produces: `ClaimCategoryCountsResponse = { items: ClaimCategoryCount[], totals: { total, pending } }`, `claimCategoryCountsOptions()`, `claimKeys.categoryCounts()` (Tasks 4, 5, 6, 7).
- Produces: `GET /api/claims/category-counts`, `ClaimsService.categoryCounts(actor)`, exported `resolveViewScope(actor)` (Task 9 reuses nothing; Task 2 reuses the route style).

- [ ] **Step 1: Stack check (Drizzle)**

Read the Drizzle docs for `check()` in `pgTable` extra config and `jsonb().$type<>()` (Context7 library `/drizzle-team/drizzle-orm-docs`, query "pgTable check constraint and jsonb column typing"). Both are already used in this repo (`packages/db/src/schema/access-control.ts:59` uses `check`; `claims.ts:61` uses `jsonb().$type<Finding[]>()`) — confirm the call shapes match before writing.

- [ ] **Step 2: Write the failing migration-data test**

`packages/db/src/__tests__/integration/claim-category-fields.integration.test.ts` (mirror the header of `claim-categories.integration.test.ts` in the same folder — `beforeAll` migrates, transaction per test):

```ts
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

describe('migration 0046 — category fields catalogue', () => {
  it('seeds "Obrađeni deo" with three options on MASINSKA_OBRADA, and nothing is deactivated', async () => {
    const [field] = await db
      .select()
      .from(schema.claimCategoryFields)
      .where(eq(schema.claimCategoryFields.code, 'obradjeni_deo'))
    expect(field).toBeDefined()
    expect(field?.fieldType).toBe('select')
    expect(field?.deactivatedAt).toBeNull()

    const [category] = await db
      .select({ code: schema.claimCategories.code, deactivatedAt: schema.claimCategories.deactivatedAt })
      .from(schema.claimCategories)
      .where(eq(schema.claimCategories.id, field!.categoryId))
    expect(category?.code).toBe('MASINSKA_OBRADA')
    expect(category?.deactivatedAt).toBeNull()

    const options = await db
      .select({ code: schema.claimCategoryFieldOptions.code })
      .from(schema.claimCategoryFieldOptions)
      .where(eq(schema.claimCategoryFieldOptions.fieldId, field!.id))
      .orderBy(schema.claimCategoryFieldOptions.sortOrder)
    expect(options.map((o) => o.code)).toEqual(['glava', 'blok', 'radilica'])
  })

  it('refuses a second field type until one is added to the CHECK', async () => {
    const [category] = await db
      .select({ id: schema.claimCategories.id })
      .from(schema.claimCategories)
      .where(eq(schema.claimCategories.code, 'MASINSKA_OBRADA'))
    await expect(
      db.insert(schema.claimCategoryFields).values({
        categoryId: category!.id,
        code: 'nope',
        name: 'Nope',
        fieldType: 'text' as 'select',
      }),
    ).rejects.toThrow(/claim_category_fields_field_type_check/)
  })

  it('keeps a category that still owns fields (RESTRICT)', async () => {
    const [category] = await db
      .select({ id: schema.claimCategories.id })
      .from(schema.claimCategories)
      .where(eq(schema.claimCategories.code, 'MASINSKA_OBRADA'))
    await expect(
      db.delete(schema.claimCategories).where(eq(schema.claimCategories.id, category!.id)),
    ).rejects.toThrow(/claim_category_fields_category_id_fkey/)
  })
})
```

(The `!` in a test file is allowed by the repo's rule — tests and `.d.ts` only.)

- [ ] **Step 3: Run it to see it fail**

Run: `TZ=UTC pnpm --filter @mr/db test:integration -- claim-category-fields`
Expected: FAIL — `schema.claimCategoryFields` is not exported / relation does not exist.

- [ ] **Step 4: Add the schema**

`packages/db/src/schema/catalogs.ts` — add `check` to the `drizzle-orm/pg-core` import, add `deactivatedAt` to `claimCategories` (after `isActive`), then append after `claimCategories`:

```ts
    // Gašenje nosi datum (V2 spec §4.2): set when isActive goes true→false, cleared on
    // false→true, written by the service and by nothing else.
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true, mode: 'date' }),
```

```ts
/**
 * A field that exists only for claims of ONE category — "Obrađeni deo" on machining. A
 * catalogue, never a code table (V2 spec §10): the office adds, renames and retires fields from
 * the admin panel. `field_type` is text + CHECK so a second type is a row in the CHECK, not a
 * new enum. Values live on the claim row as jsonb keyed by `code` (see claims.ts).
 */
export const claimCategoryFields = pgTable(
  'claim_category_fields',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    fieldType: text('field_type').$type<'select'>().notNull().default('select'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    uniqueIndex('claim_category_fields_category_code_key').on(t.categoryId, t.code),
    index('idx_claim_category_fields_category_id').on(t.categoryId),
    check('claim_category_fields_field_type_check', sql`${t.fieldType} IN ('select')`),
    foreignKey({
      name: 'claim_category_fields_category_id_fkey',
      columns: [t.categoryId],
      foreignColumns: [claimCategories.id],
    }).onDelete('restrict'),
  ],
)

/** One offered value of a select field. Retiring one keeps it on the claims that carry it. */
export const claimCategoryFieldOptions = pgTable(
  'claim_category_field_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fieldId: uuid('field_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    uniqueIndex('claim_category_field_options_field_code_key').on(t.fieldId, t.code),
    index('idx_claim_category_field_options_field_id').on(t.fieldId),
    foreignKey({
      name: 'claim_category_field_options_field_id_fkey',
      columns: [t.fieldId],
      foreignColumns: [claimCategoryFields.id],
    }).onDelete('restrict'),
  ],
)

export const claimCategoriesRelations = relations(claimCategories, ({ many }) => ({
  fields: many(claimCategoryFields),
}))

export const claimCategoryFieldsRelations = relations(claimCategoryFields, ({ one, many }) => ({
  category: one(claimCategories, {
    fields: [claimCategoryFields.categoryId],
    references: [claimCategories.id],
  }),
  options: many(claimCategoryFieldOptions),
}))

export const claimCategoryFieldOptionsRelations = relations(claimCategoryFieldOptions, ({ one }) => ({
  field: one(claimCategoryFields, {
    fields: [claimCategoryFieldOptions.fieldId],
    references: [claimCategoryFields.id],
  }),
}))
```

(If `claimCategoriesRelations` already exists in the file, add `fields: many(claimCategoryFields)` to it instead of declaring a second one.)

`packages/db/src/schema/claims.ts` — in BOTH `emotiveClaims` and `domaceClaims`, directly after `categoryId`:

```ts
    // `{ "<field code>": "<option code>" }` for the claim's category (V2 spec §4.1). jsonb like
    // `findings`; integrity is the service's job (core/claims/validate-category-field-values.ts)
    // and a retired field or option keeps its value here — the detail names it as retired.
    categoryFieldValues: jsonb('category_field_values').$type<Record<string, string>>(),
```

- [ ] **Step 5: Generate the migration, append the seed, prove from zero**

```bash
tail -8 packages/db/migrations/meta/_journal.json          # must end at idx 45, 0045_mighty_risque
pnpm --filter @mr/db run db:generate                         # → migrations/0046_<name>.sql
cat packages/db/migrations/0046_*.sql                        # ONLY: 2 CREATE TABLE, 1 ALTER claim_categories, 2 ALTER claims, indexes, FKs, CHECK
```

Append to the generated file, after its last statement:

```sql
--> statement-breakpoint
INSERT INTO "claim_category_fields" ("category_id", "code", "name", "field_type", "sort_order")
SELECT "id", 'obradjeni_deo', 'Obrađeni deo', 'select', 10
FROM "claim_categories"
WHERE "code" = 'MASINSKA_OBRADA'
ON CONFLICT ("category_id", "code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "claim_category_field_options" ("field_id", "code", "name", "sort_order")
SELECT f."id", v.code, v.name, v.sort_order
FROM "claim_category_fields" f
JOIN "claim_categories" c ON c."id" = f."category_id"
CROSS JOIN (VALUES ('glava', 'Glava', 10), ('blok', 'Blok', 20), ('radilica', 'Radilica', 30)) AS v(code, name, sort_order)
WHERE c."code" = 'MASINSKA_OBRADA' AND f."code" = 'obradjeni_deo'
ON CONFLICT ("field_id", "code") DO NOTHING;
```

Then: `pnpm --filter @mr/db run db:migrate` (dev DB) and `TZ=UTC pnpm --filter @mr/db test:integration -- claim-category-fields` → PASS (the integration setup migrates from zero on `mr_reklamacije_test`).

- [ ] **Step 6: Shared — the ref, the list item, the counts schema**

`packages/shared/src/schemas/reference-data.schema.ts`:

```ts
export const ClaimCategoryListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  deactivatedAt: z.string().nullable(),
  usageCount: z.number().int().nonnegative(),
})
```

```ts
export const ClaimCategoryRefSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  // A claim keeps a category the office has switched off; the screens need to SAY so (V2 §4.3).
  isActive: z.boolean(),
  deactivatedAt: z.string().nullable(),
})
```

New `packages/shared/src/schemas/claim-category-counts.schema.ts`:

```ts
import { z } from 'zod'

/**
 * Pending/total per category for the reader's OWN scope — what the sidebar badges, the list
 * header and the "Ugašene" filter group read (V2 spec §4.4). A category appears when it is
 * active OR still carries claims the reader may see; a retired, empty one is nobody's business.
 */
export const ClaimCategoryCountSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  total: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
})

export type ClaimCategoryCount = z.infer<typeof ClaimCategoryCountSchema>

export const ClaimCategoryCountsResponseSchema = z.object({
  items: z.array(ClaimCategoryCountSchema),
  totals: z.object({
    total: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
  }),
})

export type ClaimCategoryCountsResponse = z.infer<typeof ClaimCategoryCountsResponseSchema>
```

`packages/shared/src/index.ts`: `export * from './schemas/claim-category-counts.schema.js'` after the `claim-list.schema.js` line.

`packages/shared/src/queries/claim-keys.ts` — add to `claimKeys`:

```ts
  /** The sidebar's per-category pending counts; under `all` so claim invalidation covers it. */
  categoryCounts: () => [...claimKeys.all, 'category-counts'] as const,
```

`packages/shared/src/queries/claims.ts` — after `claimsListOptions`:

```ts
export function claimCategoryCountsOptions() {
  return queryOptions({
    queryKey: claimKeys.categoryCounts(),
    queryFn: () => fetchJson<ClaimCategoryCountsResponse>('/api/claims/category-counts'),
    staleTime: CLAIMS_LIST_STALE_MS,
  })
}
```

(import `ClaimCategoryCountsResponse` from `'../schemas/claim-category-counts.schema.js'`; export `claimCategoryCountsOptions` from `packages/shared/src/queries/index.ts` in the `./claims.js` block.)

`packages/shared/src/queries/invalidate-internal-claim-queries.ts` — after the `claimKeys.lists()` line:

```ts
  // A created, deleted or re-outcomed claim moves a badge in the sidebar.
  void queryClient.invalidateQueries({ queryKey: claimKeys.categoryCounts() })
```

`packages/shared/src/constants/resource-query-map.ts`:

```ts
    // A renamed or retired category must reach the sidebar's counts and every claim list that
    // prints its name, not only the catalogue screens.
    case ResourceChangedKey.ClaimCategories:
      return [['claim-categories'], ['claims', 'category-counts']] as const
```

- [ ] **Step 7: Shared tests**

`packages/shared/src/schemas/__tests__/claim-category-counts.schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { ClaimCategoryCountsResponseSchema } from '../claim-category-counts.schema.js'

describe('ClaimCategoryCountsResponseSchema', () => {
  it('parses a scoped answer with an inactive category that still has claims', () => {
    const parsed = ClaimCategoryCountsResponseSchema.parse({
      items: [
        { id: '11111111-1111-4111-8111-111111111111', code: 'MASINSKA_OBRADA', name: 'Mašinska obrada', sortOrder: 20, isActive: true, total: 14, pending: 9 },
        { id: '22222222-2222-4222-8222-222222222222', code: 'KOMPRESORI', name: 'Kompresori', sortOrder: 90, isActive: false, total: 1, pending: 0 },
      ],
      totals: { total: 120, pending: 39 },
    })
    expect(parsed.items[1]?.isActive).toBe(false)
    expect(parsed.totals.pending).toBe(39)
  })

  it('refuses a negative count', () => {
    expect(() =>
      ClaimCategoryCountsResponseSchema.parse({ items: [], totals: { total: -1, pending: 0 } }),
    ).toThrow()
  })
})
```

In `packages/shared/src/queries/__tests__/invalidate-internal-claim-queries.test.ts`, add beside the existing list-key assertion:

```ts
  it('refreshes the sidebar counts — a created claim moves a badge', () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    invalidateInternalClaimQueries(queryClient, { kind: ClaimKind.Emotive, id: 'abc' })
    expect(spy).toHaveBeenCalledWith({ queryKey: claimKeys.categoryCounts() })
  })
```

Run: `TZ=UTC pnpm --filter @mr/shared test` → PASS; then `pnpm --filter @mr/shared build`.

- [ ] **Step 8: API — the catalogue writes the date, both claim repos map the wider ref**

`apps/api/src/modules/claim-categories/claim-categories.repository.ts` — add `deactivatedAt` to `ClaimCategoryRow`, to every `select(...)`/`returning(...)` block (`deactivatedAt: claimCategories.deactivatedAt`), to `mapClaimCategoryRow` (`deactivatedAt: row.deactivatedAt?.toISOString() ?? null` — add `deactivatedAt: Date | null` to the row interface), and to `create`'s mapped result (`deactivatedAt: null`). In `update`'s `.set({...})`:

```ts
        ...(input.isActive !== undefined
          ? {
              isActive: input.isActive,
              // true→false stamps the moment (kept if already off), false→true clears it.
              deactivatedAt: input.isActive
                ? null
                : sql`COALESCE(${claimCategories.deactivatedAt}, now())`,
            }
          : {}),
```

(replacing the existing `...(input.isActive !== undefined ? { isActive: input.isActive } : {})`).

`apps/api/src/modules/emotive-claims/emotive-claims.repository.ts` and `domace-claims.repository.ts` — `mapCategoryRef` becomes:

```ts
function mapCategoryRef(
  id: string | null,
  code: string | null,
  name: string | null,
  isActive: boolean | null,
  deactivatedAt: Date | null,
): ClaimCategoryRef | null {
  if (id === null || code === null || name === null || isActive === null) {
    return null
  }
  return { id, code, name, isActive, deactivatedAt: deactivatedAt?.toISOString() ?? null }
}
```

Every `select` that reads `categoryCode: claimCategories.code, categoryName: claimCategories.name` also reads `categoryIsActive: claimCategories.isActive, categoryDeactivatedAt: claimCategories.deactivatedAt`; the row interfaces gain `categoryIsActive: boolean | null`, `categoryDeactivatedAt: Date | null`; every `mapCategoryRef(...)` call passes the two new arguments.

`apps/api/src/modules/claims/claims.repository.ts` — `UnifiedListRow` gains `category_is_active: boolean | null` and `category_deactivated_at: Date | string | null`; both branch SELECTs add `cc.is_active AS category_is_active, cc.deactivated_at AS category_deactivated_at`; `mapCategory` returns the wider ref:

```ts
function mapCategory(row: UnifiedListRow): ClaimListItem['category'] {
  if (row.category_id === null || row.category_code === null || row.category_name === null || row.category_is_active === null) {
    return null
  }
  return {
    id: row.category_id,
    code: row.category_code,
    name: row.category_name,
    isActive: row.category_is_active,
    deactivatedAt: row.category_deactivated_at === null ? null : formatTimestamp(row.category_deactivated_at),
  }
}
```

- [ ] **Step 9: Failing tests for the date and the counts**

`apps/api/src/modules/claim-categories/__tests__/claim-categories.integration.test.ts` — new `describe`:

```ts
  describe('deactivation carries a date', () => {
    it('stamps deactivated_at on switch-off and clears it on switch-on', async () => {
      const created = await container.claimCategoriesRepository.create({ code: 'DATED', name: 'Dated' })
      const actor = { actorUserId: testUser(['settings.claim_categories.manage']).id, actorIp: null, actorUserAgent: null }

      const off = await container.claimCategoriesService.update(created.id, { isActive: false }, actor)
      expect(off.deactivatedAt).not.toBeNull()

      const offAgain = await container.claimCategoriesService.update(created.id, { isActive: false }, actor)
      expect(offAgain.deactivatedAt).toBe(off.deactivatedAt)

      const on = await container.claimCategoriesService.update(created.id, { isActive: true }, actor)
      expect(on.deactivatedAt).toBeNull()
    })
  })
```

`apps/api/src/modules/claims/__tests__/claims.integration.test.ts` — new `describe` (uses the file's `createEmotive`/`createDomace` helpers and `createClaimsTestApp`):

```ts
  describe('category counts', () => {
    const DOMACE_ONLY = { id: TEST_USER_ID, permissions: ['domace_claims.view'] as const }

    it('counts pending and total per category, and totals across the scope', async () => {
      await createEmotive('CNT-EM-1/26', { categoryCode: 'MASINSKA_OBRADA' })
      await createDomace('CNT-DO-1/26', 'Brojač', { categoryCode: 'MASINSKA_OBRADA' })
      const acceptedId = await createEmotive('CNT-EM-2/26', { categoryCode: 'MASINSKA_OBRADA' })
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ outcome: ClaimOutcome.Accepted })
        .where(eq(schema.emotiveClaims.id, acceptedId))

      const counts = await container.claimsService.categoryCounts(FULL_OPERATOR)
      const machining = counts.items.find((item) => item.code === 'MASINSKA_OBRADA')

      expect(machining).toMatchObject({ total: 3, pending: 2, isActive: true })
      expect(counts.totals.total).toBeGreaterThanOrEqual(3)
      expect(counts.totals.pending).toBeGreaterThanOrEqual(2)
    })

    it('counts only the kinds the reader may see', async () => {
      // ⚙ mutation: drop the scope from buildCountsBranches → this goes red.
      await createEmotive('CNT-SCOPE-EM/26', { categoryCode: 'NOVI_DELOVI' })
      await createDomace('CNT-SCOPE-DO/26', 'Scope', { categoryCode: 'NOVI_DELOVI' })

      const counts = await container.claimsService.categoryCounts(DOMACE_ONLY)
      const parts = counts.items.find((item) => item.code === 'NOVI_DELOVI')

      expect(parts?.total).toBe(1)
    })

    it('drops a retired category with no claims and keeps one that still has them', async () => {
      const emptyRetired = await container.claimCategoriesRepository.create({ code: 'CNT-EMPTY', name: 'Empty' })
      const usedRetired = await container.claimCategoriesRepository.create({ code: 'CNT-USED', name: 'Used' })
      await createEmotive('CNT-USED/26', { categoryCode: 'CNT-USED' })
      for (const id of [emptyRetired.id, usedRetired.id]) {
        await container.claimCategoriesRepository.update(id, { isActive: false })
      }

      const counts = await container.claimsService.categoryCounts(FULL_OPERATOR)

      expect(counts.items.some((item) => item.code === 'CNT-EMPTY')).toBe(false)
      expect(counts.items.find((item) => item.code === 'CNT-USED')).toMatchObject({ isActive: false, total: 1 })
    })

    it('is served over HTTP to a viewer and refused without a claims permission', async () => {
      const ok = await createClaimsTestApp(container, testUser(['emotive_claims.view'])).request('/api/claims/category-counts')
      expect(ok.status).toBe(200)
      const forbidden = await createClaimsTestApp(container, testUser(['customers.view'])).request('/api/claims/category-counts')
      expect(forbidden.status).toBe(403)
    })
  })
```

Run: `TZ=UTC pnpm --filter api test:integration -- "claims.integration|claim-categories"` → FAIL (`categoryCounts` is not a function; `deactivatedAt` undefined).

- [ ] **Step 10: The counts query, service, controller, route**

`apps/api/src/modules/claims/claims.repository.ts`:

```ts
interface CategoryCountRow extends Record<string, unknown> {
  id: string
  code: string
  name: string
  sort_order: number | string
  is_active: boolean
  total: number | string
  pending: number | string
}

interface CountTotalsRow extends Record<string, unknown> {
  total: number | string
  pending: number | string
}
```

```ts
  /**
   * Pending/total per category for the reader's scope — the same UNION as the list, reduced to
   * two columns. One query for the rows, one for the totals, in parallel (V2 spec §4.4).
   */
  async categoryCounts(scope: ClaimsListScope): Promise<ClaimCategoryCountsResponse> {
    const branches = await this.buildCountsBranches(scope)
    if (branches.length === 0) {
      return { items: [], totals: { total: 0, pending: 0 } }
    }
    const unionSql = sql.join(branches, sql` UNION ALL `)

    const [itemsResult, totalsResult] = await Promise.all([
      this.db.execute<CategoryCountRow>(sql`
        WITH claims AS (${unionSql})
        SELECT cc.id, cc.code, cc.name, cc.sort_order, cc.is_active,
          COUNT(c.category_id)::int AS total,
          COUNT(c.category_id) FILTER (WHERE c.outcome = ${ClaimOutcome.Pending})::int AS pending
        FROM claim_categories cc
        LEFT JOIN claims c ON c.category_id = cc.id
        WHERE cc.deleted_at IS NULL
        GROUP BY cc.id, cc.code, cc.name, cc.sort_order, cc.is_active
        HAVING cc.is_active OR COUNT(c.category_id) > 0
        ORDER BY cc.sort_order ASC, cc.name ASC
      `),
      this.db.execute<CountTotalsRow>(sql`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE outcome = ${ClaimOutcome.Pending})::int AS pending
        FROM (${unionSql}) AS c
      `),
    ])

    const totals = totalsResult.rows[0]
    return {
      items: itemsResult.rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        sortOrder: toInt(row.sort_order),
        isActive: row.is_active,
        total: toInt(row.total),
        pending: toInt(row.pending),
      })),
      totals: { total: toInt(totals?.total ?? 0), pending: toInt(totals?.pending ?? 0) },
    }
  }

  private async buildCountsBranches(scope: ClaimsListScope): Promise<SQL[]> {
    const branches: SQL[] = []

    if (scope.includeEmotive) {
      if (scope.emotiveCustomerScope === 'own_customer') {
        const customerIds = await this.getUserCustomerIds(scope.userId)
        if (customerIds.length > 0) {
          branches.push(sql`
            SELECT ec.category_id, ec.outcome FROM emotive_claims ec
            WHERE ec.deleted_at IS NULL
              AND ec.customer_id IN (${sql.join(customerIds.map((id) => sql`${id}`), sql`, `)})
          `)
        }
      } else {
        branches.push(sql`
          SELECT ec.category_id, ec.outcome FROM emotive_claims ec WHERE ec.deleted_at IS NULL
        `)
      }
    }

    if (scope.includeDomace) {
      branches.push(sql`
        SELECT dc.category_id, dc.outcome FROM domace_claims dc WHERE dc.deleted_at IS NULL
      `)
    }

    return branches
  }
```

(Import `ClaimCategoryCountsResponse` from `@mr/shared`.)

`apps/api/src/modules/claims/claims.service.ts` — split scope resolution so the counts have no `query`:

```ts
/** Which families and which rows the actor may read — the one gate both list and counts use. */
export function resolveViewScope(actor: ClaimsActor): ClaimsListScope {
  const includeEmotive = canViewEmotive(actor)
  const includeDomace = canViewDomace(actor)

  if (!includeEmotive && !includeDomace) {
    throw new ForbiddenError()
  }

  return {
    includeEmotive,
    includeDomace,
    emotiveCustomerScope: actor.permissions.includes('emotive_claims.view') ? 'all' : 'own_customer',
    userId: actor.id,
  }
}

function resolveListScope(actor: ClaimsActor, query: ClaimListQuery): ClaimsListScope {
  const scope = resolveViewScope(actor)

  if (query.kind === ClaimKind.Emotive && !scope.includeEmotive) {
    throw new ForbiddenError()
  }
  if (query.kind === ClaimKind.Domace && !scope.includeDomace) {
    throw new ForbiddenError()
  }

  return scope
}

export class ClaimsService {
  constructor(private readonly repo: ClaimsRepository) {}

  async list(query: ClaimListQuery, actor: ClaimsActor): Promise<ClaimListResponse> {
    return this.repo.list(query, resolveListScope(actor, query))
  }

  async categoryCounts(actor: ClaimsActor): Promise<ClaimCategoryCountsResponse> {
    return this.repo.categoryCounts(resolveViewScope(actor))
  }
}
```

`apps/api/src/modules/claims/claims.controller.ts` — add to the returned object:

```ts
    categoryCounts: async (c: Context) => {
      const user = requireUser(c)
      return c.json(await container.claimsService.categoryCounts(toActor(user)))
    },
```

and give the factory an explicit return type `{ list: (c: Context) => Promise<Response>; categoryCounts: (c: Context) => Promise<Response> }`.

`apps/api/src/modules/claims/claims.routes.ts`:

```ts
  routes.get('/', viewClaimsPermissions, controller.list)
  // The sidebar's per-category badges. Same gate as the list: the counts ARE the list, reduced.
  routes.get('/category-counts', viewClaimsPermissions, controller.categoryCounts)
```

- [ ] **Step 11: Run green, mutate, restore**

Run: `TZ=UTC pnpm --filter api test:integration -- "claims.integration|claim-categories"` → PASS.
⚙ In `buildCountsBranches`, replace the `if (scope.includeEmotive)` guard with `if (true)` → "counts only the kinds the reader may see" goes RED. Restore.
⚙ In `update`, replace the COALESCE branch with `deactivatedAt: null` → the date test goes RED. Restore.

- [ ] **Step 12: Fixtures that now need the wider ref**

`grep -rn "category: {" apps packages --include="*.test.ts" --include="*.test.tsx"` — every fixture building a `ClaimCategoryRef` (at least `packages/shared/src/schemas/__tests__/client-claim.schema.test.ts`, `claim-list.schema.test.ts`, `apps/internal-web/src/features/claims/__tests__/claims-filters.test.tsx`, detail-section tests) gains `isActive: true, deactivatedAt: null`. No assertion changes.

- [ ] **Step 13: Full gate, commit**

```bash
git add packages apps
git commit -m "feat(claims): categories learn when they were switched off, grow their field catalogue, and count themselves"
```

---

### Task 2: The field catalogue — API modules + admin screens

**Files:**
- Create: `packages/shared/src/schemas/claim-category-field.schema.ts`
- Modify: `packages/shared/src/index.ts`, `packages/shared/src/queries/index.ts`, `packages/shared/src/constants/resource-query-map.ts`, `packages/shared/src/constants/audit.ts`
- Create: `packages/shared/src/queries/claim-category-fields.ts`
- Create: `apps/api/src/modules/claim-category-fields/{claim-category-fields.schema.ts,claim-category-fields.validators.ts,claim-category-fields.repository.ts,claim-category-fields.service.ts,claim-category-fields.controller.ts,claim-category-fields.routes.ts,index.ts}`
- Create: `apps/api/src/modules/claim-category-field-options/{…same seven files…}`
- Modify: `apps/api/src/core/container.ts`, `apps/api/src/app.ts`, `apps/api/src/test-helpers/test-app.ts` (`createReferenceTestApp` registers both)
- Create: `apps/api/src/modules/claim-category-fields/__tests__/claim-category-fields.integration.test.ts`, `apps/api/src/modules/claim-category-field-options/__tests__/claim-category-field-options.integration.test.ts`
- Create: `apps/admin-web/src/resources/claim-category-fields.definition.ts`, `apps/admin-web/src/resources/claim-category-field-options.definition.ts`, `apps/admin-web/src/routes/_shell/settings/claim-category-fields/index.tsx`, `apps/admin-web/src/routes/_shell/settings/claim-category-field-options/index.tsx`, `apps/admin-web/src/resources/__tests__/claim-category-fields.definition.test.ts`
- Modify: `apps/admin-web/src/lib/resource/reference-select-registry.ts`, `apps/admin-web/src/config/navigation.ts`
- Modify: `packages/i18n/src/messages/sr.json`, `en.json`

**Interfaces:**
- Consumes: `schema.claimCategoryFields`, `schema.claimCategoryFieldOptions` (Task 1).
- Produces: `ClaimCategoryFieldListItem`, `ClaimCategoryFieldOptionListItem`, `ClaimCategoryFieldValues`, `ClaimCategoryFieldValuesSchema` (Task 3); `claimCategoryFieldsForCategoryOptions(categoryId)` → `ClaimCategoryFieldListItem[]` with `options` filled, active AND retired (Tasks 7, 8, 9); `ClaimCategoryFieldsRepository.listForCategory(categoryId): Promise<CategoryFieldCatalogField[]>` (Task 3); `container.claimCategoryFieldsRepository`.

- [ ] **Step 1: Shared schemas**

`packages/shared/src/schemas/claim-category-field.schema.ts`:

```ts
import { z } from 'zod'

import { ReferenceListQuerySchema } from './reference-data.schema.js'

const boolQueryParam = z
  .string()
  .optional()
  .transform((value: string | undefined) => value === 'true')

export const CLAIM_CATEGORY_FIELD_TYPES = ['select'] as const
export type ClaimCategoryFieldType = (typeof CLAIM_CATEGORY_FIELD_TYPES)[number]

/** A code is what the jsonb on the claim is keyed by — immutable once created, like a category's. */
const CodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9_]+$/, 'Code may contain only a-z, 0-9 and _')

export const ClaimCategoryFieldOptionListItemSchema = z.object({
  id: z.string().uuid(),
  fieldId: z.string().uuid(),
  fieldName: z.string(),
  code: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  deactivatedAt: z.string().nullable(),
  createdAt: z.string(),
  usageCount: z.number().int().nonnegative(),
})
export type ClaimCategoryFieldOptionListItem = z.infer<typeof ClaimCategoryFieldOptionListItemSchema>

export const ClaimCategoryFieldListItemSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  code: z.string(),
  name: z.string(),
  fieldType: z.enum(CLAIM_CATEGORY_FIELD_TYPES),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  deactivatedAt: z.string().nullable(),
  createdAt: z.string(),
  usageCount: z.number().int().nonnegative(),
  /** Present only when the list was asked `includeOptions=true`; then it holds ALL options, retired too. */
  options: z.array(ClaimCategoryFieldOptionListItemSchema).optional(),
})
export type ClaimCategoryFieldListItem = z.infer<typeof ClaimCategoryFieldListItemSchema>

export const ClaimCategoryFieldCreateInputSchema = z.object({
  categoryId: z.string().uuid(),
  code: CodeSchema,
  name: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
})
export type ClaimCategoryFieldCreateInput = z.infer<typeof ClaimCategoryFieldCreateInputSchema>

export const ClaimCategoryFieldUpdateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field must be provided' })
export type ClaimCategoryFieldUpdateInput = z.infer<typeof ClaimCategoryFieldUpdateInputSchema>

export const ClaimCategoryFieldOptionCreateInputSchema = z.object({
  fieldId: z.string().uuid(),
  code: CodeSchema,
  name: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
})
export type ClaimCategoryFieldOptionCreateInput = z.infer<typeof ClaimCategoryFieldOptionCreateInputSchema>

export const ClaimCategoryFieldOptionUpdateInputSchema = ClaimCategoryFieldUpdateInputSchema
export type ClaimCategoryFieldOptionUpdateInput = z.infer<typeof ClaimCategoryFieldOptionUpdateInputSchema>

export const ClaimCategoryFieldsListQuerySchema = ReferenceListQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  includeOptions: boolQueryParam,
})
export type ClaimCategoryFieldsListQuery = z.infer<typeof ClaimCategoryFieldsListQuerySchema>

export const ClaimCategoryFieldOptionsListQuerySchema = ReferenceListQuerySchema.extend({
  fieldId: z.string().uuid().optional(),
})
export type ClaimCategoryFieldOptionsListQuery = z.infer<typeof ClaimCategoryFieldOptionsListQuerySchema>

/**
 * `{ "<field code>": "<option code>" }` on a claim. Zod bounds the shape; WHICH codes are real and
 * alive is the service's check against the catalogue (core/claims/validate-category-field-values).
 */
export const ClaimCategoryFieldValuesSchema = z
  .record(CodeSchema, CodeSchema)
  .refine((values) => Object.keys(values).length <= 50, { message: 'Too many category field values' })
export type ClaimCategoryFieldValues = z.infer<typeof ClaimCategoryFieldValuesSchema>
```

Export from `packages/shared/src/index.ts` (`export * from './schemas/claim-category-field.schema.js'`). In `packages/shared/src/constants/audit.ts` add `'claim_category'`, `'claim_category_field'`, `'claim_category_field_option'` to `AUDIT_ENTITY_TYPES`.

`packages/shared/src/queries/claim-category-fields.ts`:

```ts
import { queryOptions } from '@tanstack/react-query'

import type {
  ClaimCategoryFieldListItem,
  ClaimCategoryFieldOptionListItem,
} from '../schemas/claim-category-field.schema.js'
import { fetchAllReferencePages } from './fetch-all-reference-pages.js'

const REFERENCE_STALE_MS = Number.POSITIVE_INFINITY
const REFERENCE_GC_MS = Number.POSITIVE_INFINITY

export interface ClaimCategoryFieldsReferenceFilters {
  categoryId?: string
  activeOnly?: boolean
  includeOptions?: boolean
}

export function claimCategoryFieldsReferenceQueryKey(filters: ClaimCategoryFieldsReferenceFilters = {}) {
  return ['claim-category-fields', 'reference', filters] as const
}

export function claimCategoryFieldsReferenceOptions(filters: ClaimCategoryFieldsReferenceFilters = {}) {
  return queryOptions({
    queryKey: claimCategoryFieldsReferenceQueryKey(filters),
    queryFn: () =>
      fetchAllReferencePages<ClaimCategoryFieldListItem>('/api/claim-category-fields', {
        categoryId: filters.categoryId,
        activeOnly: filters.activeOnly ?? true,
        includeOptions: filters.includeOptions ?? false,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}

/**
 * Every field of one category WITH its options, retired ones included — the detail of an old
 * claim has to name a field that no longer exists (V2 spec §4.5). The form filters to active.
 */
export function claimCategoryFieldsForCategoryOptions(categoryId: string) {
  return claimCategoryFieldsReferenceOptions({ categoryId, activeOnly: false, includeOptions: true })
}

export interface ClaimCategoryFieldOptionsReferenceFilters {
  fieldId?: string
  activeOnly?: boolean
}

export function claimCategoryFieldOptionsReferenceQueryKey(filters: ClaimCategoryFieldOptionsReferenceFilters = {}) {
  return ['claim-category-field-options', 'reference', filters] as const
}

export function claimCategoryFieldOptionsReferenceOptions(filters: ClaimCategoryFieldOptionsReferenceFilters = {}) {
  return queryOptions({
    queryKey: claimCategoryFieldOptionsReferenceQueryKey(filters),
    queryFn: () =>
      fetchAllReferencePages<ClaimCategoryFieldOptionListItem>('/api/claim-category-field-options', {
        fieldId: filters.fieldId,
        activeOnly: filters.activeOnly ?? true,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}
```

Export all six names from `packages/shared/src/queries/index.ts`. In `resource-query-map.ts`, the `ClaimCategories` case becomes `[['claim-categories'], ['claim-category-fields'], ['claim-category-field-options'], ['claims', 'category-counts']]` — one family, one key.

- [ ] **Step 2: Failing API tests (fields)**

`apps/api/src/modules/claim-category-fields/__tests__/claim-category-fields.integration.test.ts` (same setup block as the categories suite: `createTestDbContext`, `buildTestContainer`, `ensureTestUser`, `RecordingEventBus` where events are asserted):

```ts
const MANAGER = { actorUserId: TEST_USER_ID, actorIp: null, actorUserAgent: null }

async function machiningCategoryId(): Promise<string> {
  return getClaimCategoryIdByCode(ctx.db, 'MASINSKA_OBRADA')
}

describe('listing', () => {
  it('returns the seeded field for the machining category, with its options when asked', async () => {
    const categoryId = await machiningCategoryId()
    const withOptions = await container.claimCategoryFieldsRepository.list({ categoryId, activeOnly: true, includeOptions: true, limit: 50 })
    const field = withOptions.items.find((item) => item.code === 'obradjeni_deo')
    expect(field?.options?.map((o) => o.code)).toEqual(['glava', 'blok', 'radilica'])

    const bare = await container.claimCategoryFieldsRepository.list({ categoryId, activeOnly: true, includeOptions: false, limit: 50 })
    expect(bare.items.find((item) => item.code === 'obradjeni_deo')?.options).toBeUndefined()
  })

  it('lists a retired option too when options are included — an old claim must still name it', async () => {
    const categoryId = await machiningCategoryId()
    const [field] = (await container.claimCategoryFieldsRepository.list({ categoryId, activeOnly: true, includeOptions: true, limit: 50 })).items
    const radilica = field!.options!.find((o) => o.code === 'radilica')!
    await container.claimCategoryFieldOptionsService.update(radilica.id, { isActive: false }, MANAGER)

    const again = await container.claimCategoryFieldsRepository.list({ categoryId, activeOnly: true, includeOptions: true, limit: 50 })
    expect(again.items[0]!.options!.find((o) => o.code === 'radilica')).toMatchObject({ isActive: false })
    expect(again.items[0]!.options!.find((o) => o.code === 'radilica')!.deactivatedAt).not.toBeNull()
  })
})

describe('writing', () => {
  it('refuses a second field with the same code in the same category, 409', async () => {
    const categoryId = await machiningCategoryId()
    await expect(
      container.claimCategoryFieldsService.create({ categoryId, code: 'obradjeni_deo', name: 'Dupli' }, MANAGER),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('stamps deactivated_at on switch-off and clears it on switch-on', async () => {
    const categoryId = await machiningCategoryId()
    const created = await container.claimCategoryFieldsService.create({ categoryId, code: 'tvrdoca', name: 'Tvrdoća' }, MANAGER)
    const off = await container.claimCategoryFieldsService.update(created.id, { isActive: false }, MANAGER)
    expect(off.deactivatedAt).not.toBeNull()
    const on = await container.claimCategoryFieldsService.update(created.id, { isActive: true }, MANAGER)
    expect(on.deactivatedAt).toBeNull()
  })

  it('blocks hard delete while a claim carries a value for the field, 409', async () => {
    const categoryId = await machiningCategoryId()
    const [field] = (await container.claimCategoryFieldsRepository.list({ categoryId, activeOnly: true, includeOptions: false, limit: 50 })).items
    await ctx.db.insert(schema.domaceClaims).values({
      outcome: 'pending', claimYear: 2026, categoryId, createdBy: TEST_USER_ID,
      categoryFieldValues: { obradjeni_deo: 'glava' },
    })
    await expect(container.claimCategoryFieldsService.hardDelete(field!.id, MANAGER)).rejects.toBeInstanceOf(ConflictError)
    expect((await container.claimCategoryFieldsRepository.findById(field!.id))?.usageCount).toBe(1)
  })

  it('audits and signals the ClaimCategories family on create', async () => {
    const bus = new RecordingEventBus()
    const recording = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, bus)
    const categoryId = await machiningCategoryId()
    const created = await recording.claimCategoryFieldsService.create({ categoryId, code: 'audit', name: 'Audit' }, MANAGER)
    const [entry] = await ctx.db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, created.id))
    expect(entry).toMatchObject({ entityType: 'claim_category_field', action: AuditAction.Create })
    expect(bus.resourceChanged).toContain(ResourceChangedKey.ClaimCategories)
  })
})

describe('HTTP', () => {
  it('lists to a claims viewer and a statistics reader, refuses create without the settings permission', async () => {
    for (const perm of ['emotive_claims.view', 'statistics.view_emotive'] as const) {
      const res = await createReferenceTestApp(container, testUser([perm])).request('/api/claim-category-fields')
      expect(res.status).toBe(200)
    }
    const res = await createReferenceTestApp(container, testUser(['emotive_claims.view'])).request('/api/claim-category-fields', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: await machiningCategoryId(), code: 'x', name: 'X' }),
    })
    expect(res.status).toBe(403)
  })
})
```

(`RecordingEventBus` — check its property name for captured resource events in `apps/api/src/test-helpers/recording-event-bus.ts` and use that; `schema.auditLog` is the audit table export in `@mr/db`.)

The options suite mirrors: seeded options listed by `fieldId`; duplicate code in the same field → 409; deactivate stamps/clears; hard delete blocked while a claim carries the value; HTTP 200/403.

Run: `TZ=UTC pnpm --filter api test:integration -- claim-category-field` → FAIL (modules missing).

- [ ] **Step 3: The fields module**

`claim-category-fields.schema.ts`:
```ts
import { schema } from '@mr/db'

export const claimCategoryFields = schema.claimCategoryFields
export const claimCategoryFieldOptions = schema.claimCategoryFieldOptions
export const claimCategories = schema.claimCategories
```

`claim-category-fields.validators.ts`:
```ts
import { z } from 'zod'

export {
  ClaimCategoryFieldCreateInputSchema,
  ClaimCategoryFieldListItemSchema,
  ClaimCategoryFieldUpdateInputSchema,
  ClaimCategoryFieldsListQuerySchema,
  type ClaimCategoryFieldCreateInput,
  type ClaimCategoryFieldListItem,
  type ClaimCategoryFieldOptionListItem,
  type ClaimCategoryFieldUpdateInput,
  type ClaimCategoryFieldsListQuery,
  type ReferenceListResponse,
} from '@mr/shared'

export const ClaimCategoryFieldIdParamSchema = z.object({ id: z.string().uuid() })
```

`claim-category-fields.repository.ts`:

```ts
import { and, asc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { ConflictError, InternalError, NotFoundError } from '../../core/errors/domain-errors.js'
import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import { claimCategories, claimCategoryFieldOptions, claimCategoryFields } from './claim-category-fields.schema.js'
import type {
  ClaimCategoryFieldCreateInput,
  ClaimCategoryFieldListItem,
  ClaimCategoryFieldOptionListItem,
  ClaimCategoryFieldUpdateInput,
  ClaimCategoryFieldsListQuery,
  ReferenceListResponse,
} from './claim-category-fields.validators.js'

/** What the claim services validate values against — both levels, retired included. */
export interface CategoryFieldCatalogField {
  id: string
  categoryId: string
  code: string
  isActive: boolean
  options: { code: string; isActive: boolean }[]
}

interface FieldRow {
  id: string
  categoryId: string
  categoryName: string
  code: string
  name: string
  fieldType: 'select'
  sortOrder: number
  isActive: boolean
  deactivatedAt: Date | null
  createdAt: Date
  usageCount: number
}

// A value is "in use" when a claim OF THIS CATEGORY carries the field's code as a key. The
// category check matters: two categories may both own a field called `obradjeni_deo`.
const fieldUsageCountSql = sql<number>`(
  COALESCE((SELECT COUNT(*)::int FROM emotive_claims ec
    WHERE ec.category_id = claim_category_fields.category_id AND ec.deleted_at IS NULL
      AND ec.category_field_values ? claim_category_fields.code), 0)
  + COALESCE((SELECT COUNT(*)::int FROM domace_claims dc
    WHERE dc.category_id = claim_category_fields.category_id AND dc.deleted_at IS NULL
      AND dc.category_field_values ? claim_category_fields.code), 0)
)`.mapWith(Number)

const optionUsageCountSql = sql<number>`(
  COALESCE((SELECT COUNT(*)::int FROM emotive_claims ec
    WHERE ec.category_id = claim_category_fields.category_id AND ec.deleted_at IS NULL
      AND ec.category_field_values ->> claim_category_fields.code = claim_category_field_options.code), 0)
  + COALESCE((SELECT COUNT(*)::int FROM domace_claims dc
    WHERE dc.category_id = claim_category_fields.category_id AND dc.deleted_at IS NULL
      AND dc.category_field_values ->> claim_category_fields.code = claim_category_field_options.code), 0)
)`.mapWith(Number)

const fieldSelection = {
  id: claimCategoryFields.id,
  categoryId: claimCategoryFields.categoryId,
  categoryName: claimCategories.name,
  code: claimCategoryFields.code,
  name: claimCategoryFields.name,
  fieldType: claimCategoryFields.fieldType,
  sortOrder: claimCategoryFields.sortOrder,
  isActive: claimCategoryFields.isActive,
  deactivatedAt: claimCategoryFields.deactivatedAt,
  createdAt: claimCategoryFields.createdAt,
  usageCount: fieldUsageCountSql,
}

function mapField(row: FieldRow, options?: ClaimCategoryFieldOptionListItem[]): ClaimCategoryFieldListItem {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    code: row.code,
    name: row.name,
    fieldType: row.fieldType,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    usageCount: row.usageCount,
    ...(options === undefined ? {} : { options }),
  }
}

export class ClaimCategoryFieldsRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(query: ClaimCategoryFieldsListQuery): Promise<ReferenceListResponse<ClaimCategoryFieldListItem>> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = [isNull(claimCategoryFields.deletedAt)]
    if (query.activeOnly) conditions.push(eq(claimCategoryFields.isActive, true))
    if (query.categoryId !== undefined) conditions.push(eq(claimCategoryFields.categoryId, query.categoryId))
    if (query.search !== undefined) {
      const pattern = `%${query.search}%`
      const searchCondition = or(ilike(claimCategoryFields.code, pattern), ilike(claimCategoryFields.name, pattern))
      if (searchCondition !== undefined) conditions.push(searchCondition)
    }
    const keysetCondition = keysetAfter(claimCategoryFields.sortOrder, claimCategoryFields.id, cursor)
    if (keysetCondition !== undefined) conditions.push(keysetCondition)

    const rows = await this.db
      .select(fieldSelection)
      .from(claimCategoryFields)
      .innerJoin(claimCategories, eq(claimCategories.id, claimCategoryFields.categoryId))
      .where(and(...conditions))
      .orderBy(asc(claimCategoryFields.sortOrder), asc(claimCategoryFields.id))
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({ primary: row.sortOrder, id: row.id }))
    const optionsByField = query.includeOptions ? await this.optionsFor(page.items.map((row) => row.id)) : undefined

    return {
      items: page.items.map((row) => mapField(row, optionsByField?.get(row.id) ?? (query.includeOptions ? [] : undefined))),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    }
  }

  /** All options of the given fields, retired included, one query — never one per field. */
  private async optionsFor(fieldIds: string[]): Promise<Map<string, ClaimCategoryFieldOptionListItem[]>> {
    const grouped = new Map<string, ClaimCategoryFieldOptionListItem[]>()
    if (fieldIds.length === 0) return grouped
    const rows = await this.db
      .select({
        id: claimCategoryFieldOptions.id,
        fieldId: claimCategoryFieldOptions.fieldId,
        fieldName: claimCategoryFields.name,
        code: claimCategoryFieldOptions.code,
        name: claimCategoryFieldOptions.name,
        sortOrder: claimCategoryFieldOptions.sortOrder,
        isActive: claimCategoryFieldOptions.isActive,
        deactivatedAt: claimCategoryFieldOptions.deactivatedAt,
        createdAt: claimCategoryFieldOptions.createdAt,
        usageCount: optionUsageCountSql,
      })
      .from(claimCategoryFieldOptions)
      .innerJoin(claimCategoryFields, eq(claimCategoryFields.id, claimCategoryFieldOptions.fieldId))
      .where(and(inArray(claimCategoryFieldOptions.fieldId, fieldIds), isNull(claimCategoryFieldOptions.deletedAt)))
      .orderBy(asc(claimCategoryFieldOptions.sortOrder), asc(claimCategoryFieldOptions.id))
    for (const row of rows) {
      const list = grouped.get(row.fieldId) ?? []
      list.push({
        id: row.id, fieldId: row.fieldId, fieldName: row.fieldName, code: row.code, name: row.name,
        sortOrder: row.sortOrder, isActive: row.isActive,
        deactivatedAt: row.deactivatedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(),
        usageCount: row.usageCount,
      })
      grouped.set(row.fieldId, list)
    }
    return grouped
  }

  /** The validation view: every non-deleted field of the category with every non-deleted option. */
  async listForCategory(categoryId: string): Promise<CategoryFieldCatalogField[]> {
    const fields = await this.db
      .select({ id: claimCategoryFields.id, categoryId: claimCategoryFields.categoryId, code: claimCategoryFields.code, isActive: claimCategoryFields.isActive })
      .from(claimCategoryFields)
      .where(and(eq(claimCategoryFields.categoryId, categoryId), isNull(claimCategoryFields.deletedAt)))
    if (fields.length === 0) return []
    const options = await this.db
      .select({ fieldId: claimCategoryFieldOptions.fieldId, code: claimCategoryFieldOptions.code, isActive: claimCategoryFieldOptions.isActive })
      .from(claimCategoryFieldOptions)
      .where(and(inArray(claimCategoryFieldOptions.fieldId, fields.map((f) => f.id)), isNull(claimCategoryFieldOptions.deletedAt)))
    return fields.map((field) => ({
      ...field,
      options: options.filter((o) => o.fieldId === field.id).map((o) => ({ code: o.code, isActive: o.isActive })),
    }))
  }

  async findById(id: string): Promise<ClaimCategoryFieldListItem | null> {
    const [row] = await this.db
      .select(fieldSelection)
      .from(claimCategoryFields)
      .innerJoin(claimCategories, eq(claimCategories.id, claimCategoryFields.categoryId))
      .where(and(eq(claimCategoryFields.id, id), isNull(claimCategoryFields.deletedAt)))
      .limit(1)
    return row === undefined ? null : mapField(row)
  }

  async create(input: ClaimCategoryFieldCreateInput): Promise<ClaimCategoryFieldListItem> {
    const [existing] = await this.db
      .select({ id: claimCategoryFields.id })
      .from(claimCategoryFields)
      .where(and(eq(claimCategoryFields.categoryId, input.categoryId), eq(claimCategoryFields.code, input.code), isNull(claimCategoryFields.deletedAt)))
      .limit(1)
    if (existing !== undefined) throw new ConflictError(`Field with code ${input.code} already exists in this category`)

    const [created] = await this.db
      .insert(claimCategoryFields)
      .values({ categoryId: input.categoryId, code: input.code, name: input.name, sortOrder: input.sortOrder ?? 0, isActive: true })
      .returning({ id: claimCategoryFields.id })
    if (created === undefined) throw new InternalError('Failed to create claim category field')
    const found = await this.findById(created.id)
    if (found === null) throw new InternalError('Created claim category field vanished')
    return found
  }

  async update(id: string, input: ClaimCategoryFieldUpdateInput): Promise<ClaimCategoryFieldListItem> {
    const [updated] = await this.db
      .update(claimCategoryFields)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined
          ? { isActive: input.isActive, deactivatedAt: input.isActive ? null : sql`COALESCE(${claimCategoryFields.deactivatedAt}, now())` }
          : {}),
      })
      .where(and(eq(claimCategoryFields.id, id), isNull(claimCategoryFields.deletedAt)))
      .returning({ id: claimCategoryFields.id })
    if (updated === undefined) throw new NotFoundError('Claim category field', id)
    const found = await this.findById(id)
    if (found === null) throw new NotFoundError('Claim category field', id)
    return found
  }

  async hardDelete(id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(claimCategoryFields)
      .where(and(eq(claimCategoryFields.id, id), isNull(claimCategoryFields.deletedAt)))
      .returning({ id: claimCategoryFields.id })
    if (deleted === undefined) throw new NotFoundError('Claim category field', id)
  }
}
```

`claim-category-fields.service.ts` — identical in shape to `ClaimCategoriesService` (`list`, `create`, `update`, `hardDelete` with the `usageCount > 0` → `ConflictError('Polje se koristi na reklamacijama i ne može se obrisati.')`), `entityType: 'claim_category_field'`, and `this.eventBus.publishResourceChanged(ResourceChangedKey.ClaimCategories)` after every write. `claim-category-fields.controller.ts` — the categories controller with the names substituted and an explicit return type. `claim-category-fields.routes.ts`:

```ts
  routes.get(
    '/',
    // Same readers as the category catalogue: the claim screens and the statistics screen.
    requirePermissions(
      'emotive_claims.view', 'domace_claims.view',
      'emotive_claims.create', 'emotive_claims.update', 'domace_claims.create', 'domace_claims.update',
      'settings.claim_categories.manage',
      'statistics.view_emotive', 'statistics.view_domace', 'statistics.view_overall',
    ),
    controller.list,
  )
  routes.post('/', requirePermission('settings.claim_categories.manage'), controller.create)
  routes.patch('/:id', requirePermission('settings.claim_categories.manage'), controller.update)
  routes.delete('/:id', requirePermission('settings.claim_categories.manage'), controller.delete)

  app.route('/api/claim-category-fields', routes)
```

`index.ts` re-exports the repository, service and `registerClaimCategoryFieldsRoutes`.

- [ ] **Step 4: The options module**

Same seven files under `apps/api/src/modules/claim-category-field-options/` with: schema re-exporting `claimCategoryFieldOptions` + `claimCategoryFields`; validators re-exporting the option schemas + `ClaimCategoryFieldOptionIdParamSchema`; repository `ClaimCategoryFieldOptionsRepository` whose `list(query)` filters `fieldId`/`activeOnly`/`search`, joins `claimCategoryFields` for `fieldName`, uses the `optionUsageCountSql` expression (move it to a shared file `apps/api/src/core/claims/category-field-usage-sql.ts` exporting both expressions, imported by both repositories — one definition), `findById`, `create` (409 on duplicate `(fieldId, code)`), `update` (same `deactivatedAt` rule), `hardDelete`; service with `entityType: 'claim_category_field_option'` and the `ClaimCategories` resource event; controller; routes at `/api/claim-category-field-options` with the same gates; index.

- [ ] **Step 5: Wire the container, the app and the test app**

`apps/api/src/core/container.ts` — after the `claimCategoriesService` block:

```ts
  const claimCategoryFieldsRepository = new ClaimCategoryFieldsRepository(db)
  const claimCategoryFieldsService = new ClaimCategoryFieldsService(claimCategoryFieldsRepository, auditService, eventBus)
  const claimCategoryFieldOptionsRepository = new ClaimCategoryFieldOptionsRepository(db)
  const claimCategoryFieldOptionsService = new ClaimCategoryFieldOptionsService(claimCategoryFieldOptionsRepository, auditService, eventBus)
```

Add the four to the `Container` interface and the returned object. `apps/api/src/app.ts`: `registerClaimCategoryFieldsRoutes(app, container)` and `registerClaimCategoryFieldOptionsRoutes(app, container)` right after `registerClaimCategoriesRoutes`. `apps/api/src/test-helpers/test-app.ts` → `createReferenceTestApp` registers both.

Run: `TZ=UTC pnpm --filter api test:integration -- claim-category-field` → PASS. ⚙ Drop `ec.category_id = claim_category_fields.category_id` from `fieldUsageCountSql` and add a second category with a same-coded field in the usage test → the count doubles → RED; restore.

- [ ] **Step 6: Admin — registry keys, two definitions, two routes, two menu entries**

`apps/admin-web/src/lib/resource/reference-select-registry.ts`:

```ts
export type ResourceReferenceSelectKey =
  | 'engine-manufacturers' | 'customers' | 'departments' | 'claim-categories' | 'claim-category-fields'
```
```ts
  'claim-categories': defineReferenceSelect<ClaimCategoryListItem>({
    queryOptions: () => claimCategoriesReferenceOptions({ activeOnly: true }),
    toOptions: (items) => items.map((item) => ({ value: item.id, label: item.name, keywords: item.code })),
  }),
  'claim-category-fields': defineReferenceSelect<ClaimCategoryFieldListItem>({
    queryOptions: () => claimCategoryFieldsReferenceOptions({ activeOnly: true }),
    // "Mašinska obrada › Obrađeni deo": a field's name alone is ambiguous across categories.
    toOptions: (items) => items.map((item) => ({ value: item.id, label: `${item.categoryName} › ${item.name}`, keywords: item.code })),
  }),
```

`apps/admin-web/src/resources/claim-category-fields.definition.ts` — the `claim-categories.definition.ts` shape with: `resourceKey: ResourceChangedKey.ClaimCategories`, `apiBase: '/api/claim-category-fields'`, `listQueryKeyPrefix: ['claim-category-fields']`, `listQueryOptions: (filters) => claimCategoryFieldsReferenceOptions({ activeOnly: filters?.activeOnly ?? false })`, columns `category` (`item.categoryName`), `code`, `name`, `sortOrder`, `usageCount`, `isActive`; form fields `categoryId` (`type: 'reference-select'`, `referenceKey: 'claim-categories'`, `createOnly`, `required`), `code` (text, createOnly, required, `hint: () => m.admin_claim_category_fields_code_hint()`), `name` (text, required), `sortOrder` (number); `createSchema`/`updateSchema` the shared ones; `getInitialFormValues` → `{ categoryId, code, name, sortOrder }`; `buildCreateBody` → `{ categoryId: values['categoryId'] ?? '', code: (values['code'] ?? '').trim(), name: (values['name'] ?? '').trim(), sortOrder: parseOptionalInt(values['sortOrder'] ?? '') }`; `buildUpdateBody` → `{ name, sortOrder }`; `listConfig.getSearchableText` → `[item.categoryName, item.code, item.name].join(' ')`; `lifecycle` with `getUsageCount: (item) => item.usageCount` and the `admin_claim_category_fields_*` labels. The options definition mirrors it with `fieldId` (`referenceKey: 'claim-category-fields'`), columns `field` (`item.fieldName`), `code`, `name`, `sortOrder`, `usageCount`, `isActive`, `apiBase: '/api/claim-category-field-options'`, `listQueryKeyPrefix: ['claim-category-field-options']`.

Routes `apps/admin-web/src/routes/_shell/settings/claim-category-fields/index.tsx` and `.../claim-category-field-options/index.tsx` — copies of `claim-categories/index.tsx` with the definition and `listQueryOptions` substituted. `apps/admin-web/src/config/navigation.ts` — two entries right after `claim-categories`: `claim-category-fields` (label `m.nav_claim_category_fields`, icon `ListChecks`) and `claim-category-field-options` (label `m.nav_claim_category_field_options`, icon `ListTree`).

`apps/admin-web/src/resources/__tests__/claim-category-fields.definition.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { claimCategoryFieldsResourceDefinition } from '../claim-category-fields.definition.js'

describe('claimCategoryFieldsResourceDefinition', () => {
  it('fixes the category and the code once the field exists — values on claims are keyed by them', () => {
    const editFields = claimCategoryFieldsResourceDefinition.formFields.filter((f) => !f.createOnly)
    expect(editFields.some((f) => f.key === 'categoryId')).toBe(false)
    expect(editFields.some((f) => f.key === 'code')).toBe(false)
  })

  it('sends the category id and a trimmed code on create', () => {
    expect(
      claimCategoryFieldsResourceDefinition.buildCreateBody({ categoryId: 'c1', code: ' tvrdoca ', name: ' Tvrdoća ', sortOrder: '20' }),
    ).toEqual({ categoryId: 'c1', code: 'tvrdoca', name: 'Tvrdoća', sortOrder: 20 })
  })
})
```

- [ ] **Step 7: i18n**

| key | sr | en |
| --- | --- | --- |
| `nav_claim_category_fields` | Polja kategorija | Category fields |
| `nav_claim_category_field_options` | Opcije polja | Field options |
| `admin_claim_category_fields_title` | Polja kategorija | Category fields |
| `admin_claim_category_fields_subtitle` | Polja koja postoje samo za jednu vrstu posla, npr. koji je deo obrađen | Fields that exist for one kind of work only, e.g. which part was machined |
| `admin_claim_category_fields_add` | Dodaj polje | Add field |
| `admin_claim_category_fields_empty` | Nema polja kategorija. | No category fields. |
| `admin_claim_category_fields_create_title` | Novo polje kategorije | New category field |
| `admin_claim_category_fields_edit_title` | Izmena polja kategorije | Edit category field |
| `admin_claim_category_fields_create_success` | Polje je dodato. | Field added. |
| `admin_claim_category_fields_update_success` | Polje je izmenjeno. | Field updated. |
| `admin_claim_category_fields_deactivate_title` | Ugasi polje | Retire field |
| `admin_claim_category_fields_deactivate_description` | Polje {name} više neće biti ponuđeno na novim reklamacijama. Postojeće reklamacije zadržavaju vrednost. | Field {name} will no longer be offered on new claims. Existing claims keep their value. |
| `admin_claim_category_fields_deactivate_confirm` | Ugasi | Retire |
| `admin_claim_category_fields_deactivate_success` | Polje je ugašeno. | Field retired. |
| `admin_claim_category_fields_reactivate_title` | Upali polje | Restore field |
| `admin_claim_category_fields_reactivate_description` | Polje {name} ponovo će biti ponuđeno na novim reklamacijama. | Field {name} will be offered on new claims again. |
| `admin_claim_category_fields_reactivate_confirm` | Upali | Restore |
| `admin_claim_category_fields_reactivate_success` | Polje je upaljeno. | Field restored. |
| `admin_claim_category_fields_hard_delete_title` | Obriši polje | Delete field |
| `admin_claim_category_fields_hard_delete_description` | Polje {name} biće trajno obrisano. Ova radnja se ne može poništiti. | Field {name} will be permanently deleted. This cannot be undone. |
| `admin_claim_category_fields_hard_delete_confirm` | Obriši | Delete |
| `admin_claim_category_fields_hard_delete_success` | Polje je obrisano. | Field deleted. |
| `admin_claim_category_fields_active_yes` | Da | Yes |
| `admin_claim_category_fields_active_no` | Ne | No |
| `admin_claim_category_fields_code_hint` | Mala slova, brojevi i donja crta. Po kodu se vrednost čuva na reklamaciji, pa se posle ne menja. | Lowercase letters, digits and underscore. Values on claims are keyed by it, so it never changes. |
| `field_claim_category_field` | Polje | Field |

…and the same 24 `admin_claim_category_field_options_*` keys with "opcija"/"option" in place of "polje"/"field" (title „Opcije polja" / "Field options", subtitle „Ponuđene vrednosti jednog polja, npr. Glava, Blok, Radilica" / "The values a field offers, e.g. Head, Block, Crankshaft"). Then `pnpm --filter @mr/i18n run build`.

- [ ] **Step 8: Full gate, commit**

```bash
git add packages apps
git commit -m "feat(admin): the fields a kind of work carries become a catalogue the office edits"
```

---

### Task 3: Values on the claim — validated against the live catalogue, in the claim's own transaction

**Files:**
- Modify: `packages/shared/src/schemas/emotive-claim.schema.ts` (create ~line 24, update ~line 49, detail ~line 174), `packages/shared/src/schemas/domace-claim.schema.ts` (create ~line 30, update ~line 77, detail ~line 153)
- Modify: `packages/shared/src/schemas/__tests__/client-claim.schema.test.ts`
- Create: `apps/api/src/core/claims/validate-category-field-values.ts`, `apps/api/src/core/claims/__tests__/validate-category-field-values.test.ts`
- Modify: `apps/api/src/modules/emotive-claims/emotive-claims.service.ts` (constructor, `validateCreateReferences`, `validateUpdateReferences`, `update`), `emotive-claims.repository.ts` (create values ~line 459, detail select ~line 637, `mapDetail`, update patch ~line 801)
- Modify: `apps/api/src/modules/domace-claims/domace-claims.service.ts`, `domace-claims.repository.ts` (same four places)
- Modify: `apps/api/src/core/container.ts` (both service constructions), `apps/internal-web/src/features/emotive-claims/create/serialize-emotive-create-body.ts`, `apps/internal-web/src/features/domace-claims/create/serialize-domace-create-body.ts`
- Test: `apps/api/src/modules/emotive-claims/__tests__/emotive-claims.integration.test.ts`, `apps/api/src/modules/domace-claims/__tests__/domace-claims.integration.test.ts`

**Interfaces:**
- Consumes: `ClaimCategoryFieldValuesSchema`, `ClaimCategoryFieldsRepository.listForCategory`, `CategoryFieldCatalogField` (Task 2).
- Produces: `EmotiveClaimCreateInput.categoryFieldValues` (default `{}`), `EmotiveClaimUpdateInput.categoryFieldValues?`, `EmotiveClaimDetail.categoryFieldValues`; the same three on DOMAĆE; `assertCategoryFieldValues(params)` (Tasks 7, 8).

- [ ] **Step 1: The pure rule, test first**

`apps/api/src/core/claims/__tests__/validate-category-field-values.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { ValidationError } from '../../errors/domain-errors.js'
import { assertCategoryFieldValues } from '../validate-category-field-values.js'

const FIELDS = [
  { id: 'f1', categoryId: 'cat', code: 'obradjeni_deo', isActive: true, options: [{ code: 'glava', isActive: true }, { code: 'karter', isActive: false }] },
  { id: 'f2', categoryId: 'cat', code: 'stari_postupak', isActive: false, options: [{ code: 'p2', isActive: true }] },
]

describe('assertCategoryFieldValues', () => {
  it('accepts an active option of an active field, and an empty object', () => {
    expect(() => assertCategoryFieldValues({ values: { obradjeni_deo: 'glava' }, previousValues: {}, fields: FIELDS })).not.toThrow()
    expect(() => assertCategoryFieldValues({ values: {}, previousValues: {}, fields: FIELDS })).not.toThrow()
  })

  it('refuses a key that is no field of the category', () => {
    // ⚙ the only guard between a typo in a client and a permanent key in jsonb
    expect(() => assertCategoryFieldValues({ values: { tudje_polje: 'x' }, previousValues: {}, fields: FIELDS })).toThrow(ValidationError)
  })

  it('refuses a value that is no option of the field', () => {
    expect(() => assertCategoryFieldValues({ values: { obradjeni_deo: 'deklo' }, previousValues: {}, fields: FIELDS })).toThrow(ValidationError)
  })

  it('refuses a retired option and a retired field when the value is NEW', () => {
    expect(() => assertCategoryFieldValues({ values: { obradjeni_deo: 'karter' }, previousValues: {}, fields: FIELDS })).toThrow(ValidationError)
    expect(() => assertCategoryFieldValues({ values: { stari_postupak: 'p2' }, previousValues: {}, fields: FIELDS })).toThrow(ValidationError)
  })

  it('keeps a retired option or field when the value is UNCHANGED — editing the MR number must not fail', () => {
    expect(() =>
      assertCategoryFieldValues({
        values: { obradjeni_deo: 'karter', stari_postupak: 'p2' },
        previousValues: { obradjeni_deo: 'karter', stari_postupak: 'p2' },
        fields: FIELDS,
      }),
    ).not.toThrow()
  })
})
```

`apps/api/src/core/claims/validate-category-field-values.ts`:

```ts
import type { ClaimCategoryFieldValues } from '@mr/shared'

import { ValidationError } from '../errors/domain-errors.js'
import type { CategoryFieldCatalogField } from '../../modules/claim-category-fields/claim-category-fields.repository.js'

export interface CategoryFieldValuesCheck {
  /** What the claim will carry after the write. */
  values: ClaimCategoryFieldValues
  /** What it carried before — `{}` on create, `{}` when the category changes. */
  previousValues: ClaimCategoryFieldValues
  /** The catalogue of the category the claim will have after the write, retired rows included. */
  fields: readonly CategoryFieldCatalogField[]
}

/**
 * The server is the judge of a claim's category-field values (V2 spec §4.6). Every key must be
 * a field of the claim's category and every value one of that field's options; a NEW value must
 * point at a live field and a live option. An UNCHANGED value is always kept — a claim keeps
 * what the office has since retired, and fixing a typo in the MR number must not fail because
 * a part was retired last month.
 */
export function assertCategoryFieldValues({ values, previousValues, fields }: CategoryFieldValuesCheck): void {
  for (const [code, value] of Object.entries(values)) {
    const field = fields.find((candidate) => candidate.code === code)
    if (field === undefined) {
      throw new ValidationError(`Invalid category field value: unknown field ${code}`)
    }
    const option = field.options.find((candidate) => candidate.code === value)
    if (option === undefined) {
      throw new ValidationError(`Invalid category field value: unknown option ${value} for ${code}`)
    }
    if (previousValues[code] === value) {
      continue
    }
    if (!field.isActive || !option.isActive) {
      throw new ValidationError(`Invalid category field value: ${code} or ${value} is retired`)
    }
  }
}
```

Run: `TZ=UTC pnpm --filter api test -- validate-category-field-values` → PASS (after the file exists; write the test first and watch it fail on the missing module).

- [ ] **Step 2: Shared schemas carry the values**

Both create schemas: `categoryFieldValues: ClaimCategoryFieldValuesSchema.default({}),` after `categoryId`. Both update schemas: `categoryFieldValues: ClaimCategoryFieldValuesSchema.optional(),`. Both detail schemas: `categoryFieldValues: ClaimCategoryFieldValuesSchema,`. The client whitelist test in `client-claim.schema.test.ts` gains, next to the `categoryCode` assertion: `expect('categoryFieldValues' in item).toBe(false)` — the portal learns nothing. `pnpm --filter @mr/shared build`.

- [ ] **Step 3: Failing integration tests (both families)**

In `emotive-claims.integration.test.ts`, a new `describe('category field values')` using `buildCreateInput` and `getClaimCategoryIdByCode(ctx.db, 'MASINSKA_OBRADA')` as `machiningId`:

```ts
    it('stores a valid value in the claim's own transaction and returns it on the detail', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ categoryId: machiningId, categoryFieldValues: { obradjeni_deo: 'glava' } }),
        FULL_OPERATOR, auditContext,
      )
      expect(created.categoryFieldValues).toEqual({ obradjeni_deo: 'glava' })
    })

    it('refuses a value that is no option, a key that is no field, and a retired option on create', async () => {
      // ⚙ remove the assertCategoryFieldValues call from validateCreateReferences → all three pass → RED
      for (const values of [{ obradjeni_deo: 'deklo' }, { tudje: 'glava' }]) {
        await expect(
          container.emotiveClaimsService.create(await buildCreateInput({ categoryId: machiningId, categoryFieldValues: values }), FULL_OPERATOR, auditContext),
        ).rejects.toBeInstanceOf(ValidationError)
      }
    })

    it('keeps an unchanged retired value on edit but refuses moving to it', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ categoryId: machiningId, categoryFieldValues: { obradjeni_deo: 'radilica' } }),
        FULL_OPERATOR, auditContext,
      )
      const [field] = (await container.claimCategoryFieldsRepository.list({ categoryId: machiningId, activeOnly: true, includeOptions: true, limit: 50 })).items
      const radilica = field!.options!.find((o) => o.code === 'radilica')!
      await container.claimCategoryFieldOptionsRepository.update(radilica.id, { isActive: false })

      const kept = await container.emotiveClaimsService.update(created.id, { mrNumber: 'KEPT-1/26' }, FULL_OPERATOR, auditContext)
      expect(kept.categoryFieldValues).toEqual({ obradjeni_deo: 'radilica' })

      const other = await container.emotiveClaimsService.create(await buildCreateInput({ categoryId: machiningId }), FULL_OPERATOR, auditContext)
      await expect(
        container.emotiveClaimsService.update(other.id, { categoryFieldValues: { obradjeni_deo: 'radilica' } }, FULL_OPERATOR, auditContext),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('clears the values when the category changes and refuses keys of the old one', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ categoryId: machiningId, categoryFieldValues: { obradjeni_deo: 'glava' } }),
        FULL_OPERATOR, auditContext,
      )
      const remontId = await getClaimCategoryIdByCode(ctx.db, 'REMONT_MOTORA')
      const moved = await container.emotiveClaimsService.update(created.id, { categoryId: remontId }, FULL_OPERATOR, auditContext)
      expect(moved.categoryFieldValues).toEqual({})
      await expect(
        container.emotiveClaimsService.update(created.id, { categoryId: machiningId, categoryFieldValues: { tudje: 'x' } }, FULL_OPERATOR, auditContext),
      ).rejects.toBeInstanceOf(ValidationError)
    })
```

The DOMAĆE suite gets the same four tests with `baseCreateInput` and `container.domaceClaimsService`. Run → FAIL (unknown property / nothing validated).

- [ ] **Step 4: Services and repositories**

Both services gain a constructor parameter `private readonly categoryFields: ClaimCategoryFieldsRepository` (EMOTIVE: last; DOMAĆE: last) and `apps/api/src/core/container.ts` passes `claimCategoryFieldsRepository` (it must be constructed before both — move its construction above the EMOTIVE service block).

`validateCreateReferences` (both), after the category check:

```ts
    assertCategoryFieldValues({
      values: input.categoryFieldValues,
      previousValues: {},
      fields: await this.categoryFields.listForCategory(input.categoryId),
    })
```

`update` (both) — compute the effective category and values and hand them to the existing `validateUpdateReferences`:

```ts
    const categoryChanged = input.categoryId !== undefined && input.categoryId !== before.category?.id
    const effectiveCategoryId = input.categoryId ?? before.category?.id ?? null
    const previousValues = categoryChanged ? {} : before.categoryFieldValues
    const nextValues = input.categoryFieldValues ?? previousValues
    if (effectiveCategoryId !== null) {
      assertCategoryFieldValues({
        values: nextValues,
        previousValues,
        fields: await this.categoryFields.listForCategory(effectiveCategoryId),
      })
    }
```

Repositories: create `.values({ … categoryFieldValues: input.categoryFieldValues, … })`; detail selects add `categoryFieldValues: emotiveClaims.categoryFieldValues` (DOMAĆE: `domaceClaims.…`) and the detail mapper returns `categoryFieldValues: row.categoryFieldValues ?? {}`; update patch:

```ts
    if (input.categoryFieldValues !== undefined) {
      patch.categoryFieldValues = input.categoryFieldValues
    } else if (input.categoryId !== undefined && input.categoryId !== before.category?.id) {
      // A claim that changes category cannot keep the old category's answers.
      patch.categoryFieldValues = {}
    }
```

Both serializers (`serialize-emotive-create-body.ts`, `serialize-domace-create-body.ts`) add `categoryFieldValues: input.categoryFieldValues`.

Run the two suites → PASS. ⚙ as marked in the tests. Check `buildTestContainer` callers still compile (they call `buildContainer`, which constructs the services itself).

- [ ] **Step 5: Full gate, commit**

```bash
git add packages apps
git commit -m "feat(claims): a claim carries its category's fields, and the server checks every value against the live catalogue"
```

---

### Task 4: The menu — "Reklamacije" becomes a tree fed by the catalogue

**Files:**
- Modify: `apps/internal-web/src/config/navigation.ts`
- Create: `apps/internal-web/src/components/layout/active-claims-entry.ts`, `apps/internal-web/src/components/layout/claims-nav-group.tsx`, `apps/internal-web/src/lib/use-stored-flag.ts`
- Modify: `apps/internal-web/src/components/layout/internal-sidebar.tsx`, `apps/internal-web/src/routes/_shell.tsx`, `apps/internal-web/src/features/command-palette/command-palette.tsx`, `apps/internal-web/src/features/command-palette/command-registry.ts`
- Delete: `apps/internal-web/src/components/layout/__tests__/internal-sidebar-active.test.tsx`
- Create: `apps/internal-web/src/components/layout/__tests__/active-claims-entry.test.ts`, `apps/internal-web/src/components/layout/__tests__/claims-nav-group.test.tsx`
- Modify: `apps/internal-web/src/config/__tests__/navigation.test.ts`, `apps/internal-web/src/features/command-palette/__tests__/command-registry.test.ts`, `apps/internal-web/src/features/command-palette/__tests__/command-palette.test.tsx`
- Modify: `packages/i18n/src/messages/sr.json`, `en.json`

**Interfaces:**
- Consumes: `claimCategoryCountsOptions()`, `ClaimCategoryCountsResponse` (Task 1).
- Produces: `activeClaimsEntry(location): string` returning `'all'` or a category code (Task 6's route names feed it); `NavItem.children?: 'claim-categories'`; i18n `nav_prijem_vozila`, `nav_claims_all`.

- [ ] **Step 1: Stack check (Popover, container queries)**

Read `packages/ui/src/primitives/popover.tsx` and `apps/internal-web/src/features/notifications/notification-bell.tsx` (the one flyout in this app) — the rail flyout reuses exactly that `Popover`/`PopoverTrigger`/`PopoverContent`. Read Tailwind v4 container-query docs (Context7 `/tailwindlabs/tailwindcss.com`, query "container queries @container and @min-[...] variants") — the group's labels and counts must not depend on `lg:`, which does not know the sidebar's width.

- [ ] **Step 2: Failing tests for the pure rule and the config**

`apps/internal-web/src/components/layout/__tests__/active-claims-entry.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { activeClaimsEntry } from '../active-claims-entry'

describe('activeClaimsEntry', () => {
  it('names the category on its list route', () => {
    expect(activeClaimsEntry({ pathname: '/reklamacije/kategorija/MASINSKA_OBRADA', search: {} })).toBe('MASINSKA_OBRADA')
  })
  it('names "all" on the plain list, even with an ordinary category FILTER in the URL', () => {
    // ⚙ the filter select is a filter, not a place — drop this rule and the select moves the menu
    expect(activeClaimsEntry({ pathname: '/reklamacije', search: { categoryCode: 'NOVI_DELOVI' } })).toBe('all')
  })
  it('follows the category a detail or the wizard was opened from', () => {
    expect(activeClaimsEntry({ pathname: '/reklamacije/emotive/abc', search: { categoryCode: 'AUTO_SERVIS' } })).toBe('AUTO_SERVIS')
    expect(activeClaimsEntry({ pathname: '/reklamacije/nova', search: {} })).toBe('all')
  })
  it('names nothing outside claims', () => {
    expect(activeClaimsEntry({ pathname: '/prijem', search: {} })).toBeNull()
  })
})
```

`apps/internal-web/src/config/__tests__/navigation.test.ts` — replace the machining `describe` with:

```ts
describe('the claims entry', () => {
  it('is a group whose children come from the catalogue, and no category has an entry of its own', () => {
    const claims = internalNavItems.find((item) => item.key === 'reklamacije')
    expect(claims?.children).toBe('claim-categories')
    expect(internalNavItems.some((item) => item.key === 'masinska-obrada')).toBe(false)
  })
})
```

`command-registry.test.ts`: the ordered keys become `['pocetna', 'pristiglo', 'reklamacije', 'servis', 'statistika']` (slice 0..5). `command-palette.test.tsx`: delete the "carries a filtered entry's search" test and the `MACHINING_CLAIM_CATEGORY_CODE` import.

Run: `TZ=UTC pnpm --filter internal-web test -- "active-claims-entry|navigation|command"` → FAIL.

- [ ] **Step 3: Config and the pure rule**

`apps/internal-web/src/config/navigation.ts` — `NavItem` loses `search`, gains:

```ts
  /**
   * The entry is a group whose children are read from a query, not written here — today only
   * the claim categories. The sidebar renders the children; the palette lists the group alone.
   */
  children?: 'claim-categories'
```

The `reklamacije` entry: `{ key: 'reklamacije', label: m.nav_reklamacije, to: '/reklamacije', children: 'claim-categories', icon: Briefcase, permissions: [...CLAIMS_LIST_VIEW_PERMISSIONS] }`. The `masinska-obrada` entry and the `MACHINING_CLAIM_CATEGORY_CODE`/`Cog` imports are deleted. The `servis` entry's label becomes `m.nav_prijem_vozila` (rename the key in both message files: `nav_servis` → `nav_prijem_vozila`, values „Prijem vozila" / "Vehicle intake"; update `internal-topbar.tsx`'s use until Task 5 removes it).

`apps/internal-web/src/components/layout/active-claims-entry.ts`:

```ts
export const CLAIMS_ALL_ENTRY = 'all'

const CATEGORY_LIST_PREFIX = '/reklamacije/kategorija/'

export interface ClaimsLocation {
  pathname: string
  search: Record<string, unknown>
}

/**
 * Which child of the "Reklamacije" group is the current place (V2 spec §5): the category on its
 * own list route; "all" on the plain list — an ordinary category FILTER there is a filter, not a
 * place; on a detail or the wizard, the category it was opened from (`categoryCode` in the
 * search), else "all". `null` outside claims.
 */
export function activeClaimsEntry(location: ClaimsLocation): string | null {
  const { pathname, search } = location
  if (pathname.startsWith(CATEGORY_LIST_PREFIX)) {
    const code = pathname.slice(CATEGORY_LIST_PREFIX.length).split('/')[0]
    return code !== undefined && code.length > 0 ? decodeURIComponent(code) : CLAIMS_ALL_ENTRY
  }
  if (pathname === '/reklamacije') {
    return CLAIMS_ALL_ENTRY
  }
  if (pathname.startsWith('/reklamacije/')) {
    const from = search['categoryCode']
    return typeof from === 'string' && from.length > 0 ? from : CLAIMS_ALL_ENTRY
  }
  return null
}
```

`apps/internal-web/src/lib/use-stored-flag.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'

/** A boolean remembered in localStorage, read after mount so SSR and the first paint agree. */
export function useStoredFlag(storageKey: string, defaultValue: boolean): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored !== null) {
      setValue(stored === '1')
    }
  }, [storageKey])

  const update = useCallback(
    (next: boolean) => {
      localStorage.setItem(storageKey, next ? '1' : '0')
      setValue(next)
    },
    [storageKey],
  )

  return [value, update]
}
```

- [ ] **Step 4: The group component**

`apps/internal-web/src/components/layout/claims-nav-group.tsx` — values below are READ from the prototype (`navCats`, the `Reklamacije` row, the flyout block):

```tsx
import { claimCategoryCountsOptions, type ClaimCategoryCountsResponse } from '@mr/shared'
import { m } from '@mr/i18n'
import { cn, Popover, PopoverContent, PopoverTrigger } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import { useState } from 'react'

import type { NavItem } from '~/config/navigation'
import { useStoredFlag } from '~/lib/use-stored-flag'

import { activeClaimsEntry, CLAIMS_ALL_ENTRY } from './active-claims-entry'

const OPEN_STORAGE_KEY = 'mrr:internal:nav:reklamacije-open'

export interface ClaimsNavChild {
  key: string
  label: string
  to: '/reklamacije' | '/reklamacije/kategorija/$categoryCode'
  params?: { categoryCode: string }
  count: number | null
}

/** "Sve reklamacije" first, then every ACTIVE category in catalogue order; counts only once loaded. */
export function buildClaimsNavChildren(counts: ClaimCategoryCountsResponse | undefined): ClaimsNavChild[] {
  const all: ClaimsNavChild = {
    key: CLAIMS_ALL_ENTRY,
    label: m.nav_claims_all(),
    to: '/reklamacije',
    count: counts?.totals.pending ?? null,
  }
  const categories = (counts?.items ?? [])
    .filter((item) => item.isActive)
    .map<ClaimsNavChild>((item) => ({
      key: item.code,
      label: item.name,
      to: '/reklamacije/kategorija/$categoryCode',
      params: { categoryCode: item.code },
      count: item.pending,
    }))
  return [all, ...categories]
}

function CountBadge({ count, active }: { count: number | null; active: boolean }): React.ReactElement | null {
  if (count === null) {
    return null
  }
  return (
    <span
      className={cn(
        'ml-auto font-mono text-[10.5px] tabular-nums',
        active ? 'font-semibold' : 'font-medium',
        count > 0 ? 'text-mri-amb' : 'text-mri-text2 opacity-45',
      )}
    >
      {count}
    </span>
  )
}

function ChildLink({ child, active, flyout, onNavigate }: { child: ClaimsNavChild; active: boolean; flyout: boolean; onNavigate: () => void }): React.ReactElement {
  return (
    <Link
      to={child.to}
      {...(child.params === undefined ? {} : { params: child.params })}
      title={child.label}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center text-[12.5px] transition-colors hover:bg-mri-rowhv',
        flyout ? 'h-[31px] rounded-lg px-[9px]' : 'h-8 rounded-r-lg pl-3 pr-[10px]',
        active
          ? 'bg-[rgba(237,28,36,.11)] font-bold text-mri-text shadow-[inset_2px_0_0_var(--mri-red)]'
          : 'font-semibold text-mri-text2',
      )}
    >
      <span className="truncate">{child.label}</span>
      <CountBadge count={child.count} active={active} />
    </Link>
  )
}

export interface ClaimsNavGroupProps {
  item: NavItem
  collapsed: boolean
  onNavigate: () => void
}

export function ClaimsNavGroup({ item, collapsed, onNavigate }: ClaimsNavGroupProps): React.ReactElement {
  const location = useLocation({ select: (loc) => ({ pathname: loc.pathname, search: loc.search as Record<string, unknown> }) })
  // Not suspense: a slow or failed count must never take the menu down with it (spec §5).
  const { data: counts } = useQuery(claimCategoryCountsOptions())
  const [open, setOpen] = useStoredFlag(OPEN_STORAGE_KEY, true)
  const [flyoutOpen, setFlyoutOpen] = useState(false)

  const children = buildClaimsNavChildren(counts)
  const active = activeClaimsEntry(location)
  const groupActive = active !== null
  const pendingTotal = counts?.totals.pending ?? 0

  if (collapsed) {
    return (
      <Popover open={flyoutOpen} onOpenChange={setFlyoutOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={item.label()}
            aria-label={item.label()}
            className={cn(
              'relative mx-auto grid size-[38px] place-items-center rounded-[9px] transition-colors',
              groupActive ? 'bg-[rgba(237,28,36,.11)] text-mri-text' : 'text-mri-text2 hover:bg-mri-rowhv',
            )}
          >
            <item.icon className="size-[18px]" />
            {pendingTotal > 0 ? <span aria-hidden="true" className="absolute right-[3px] top-[3px] size-[7px] rounded-full bg-mri-amb" /> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={8} className="w-[200px] rounded-xl border-mri-border2 bg-mri-raised p-[7px] shadow-[0_18px_44px_rgba(0,0,0,.55)]">
          <p className="px-[9px] pb-[5px] pt-[6px] font-mono text-[8.5px] font-semibold uppercase tracking-[0.18em] text-mri-text2">{item.label()}</p>
          {children.map((child) => (
            <ChildLink key={child.key} child={child} active={active === child.key} flyout onNavigate={() => { setFlyoutOpen(false); onNavigate() }} />
          ))}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          'flex h-[38px] items-center gap-[10px] rounded-[9px] px-[11px] text-[13.5px] transition-colors hover:bg-mri-rowhv',
          groupActive ? 'font-bold text-mri-text' : 'font-semibold text-mri-text2',
        )}
      >
        <item.icon className={cn('size-[18px] flex-none', groupActive ? 'text-mri-redh' : 'text-mri-text2')} />
        <span className="truncate">{item.label()}</span>
        <span className="ml-auto flex items-center gap-2">
          {pendingTotal > 0 ? (
            <span className="rounded-full bg-[rgba(234,179,8,.13)] px-[7px] py-[2px] font-mono text-[10px] font-semibold text-mri-amb">{pendingTotal}</span>
          ) : null}
          <span aria-hidden="true" className="text-[9px] text-mri-text2">{open ? '▾' : '▸'}</span>
        </span>
      </button>
      {open ? (
        <div className="mb-1 ml-[21px] flex flex-col border-l border-mri-border">
          {children.map((child) => (
            <ChildLink key={child.key} child={child} active={active === child.key} flyout={false} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
```

(`text-mri-amb`/`bg-mri-raised` — confirm both tokens exist as `--color-mri-*` in `apps/internal-web/src/styles/globals.css`; if `amb` is only `--mri-amb`, add `--color-mri-amb: var(--mri-amb)` inside `@theme inline` — CLAUDE.md §5's rule about `var(--mri-*)` not resolving.)

`apps/internal-web/src/components/layout/internal-sidebar.tsx` — in the `items.map`, render `item.children === 'claim-categories' ? <ClaimsNavGroup key={item.key} item={item} collapsed={collapsed} onNavigate={onCloseMobile} /> : <Link …existing… />`; delete `paintsAsActive`, `isFilteredEntry`, `SIDEBAR_LINK_*`, the `useLocation` import, `explicitUndefined` and `search={item.search ?? {}}`. `command-palette.tsx`: `goTo(to: string)` again and `onSelect={() => goTo(item.to)}`; `command-registry.ts` unchanged in shape (the group lists as one row).

`apps/internal-web/src/routes/_shell.tsx`:

```ts
export const Route = createFileRoute('/_shell')({
  // Warm the sidebar's counts for whoever may read claims; a serviser holds no such permission
  // and would get a 403 here, so the query is not even started for them.
  loader: ({ context: { queryClient, authSession } }) => {
    const permissions = authSession?.user?.permissions ?? []
    if (CLAIMS_LIST_VIEW_PERMISSIONS.some((permission) => permissions.includes(permission))) {
      void queryClient.prefetchQuery(claimCategoryCountsOptions())
    }
  },
  component: ShellLayout,
})
```

- [ ] **Step 5: Group render test**

`apps/internal-web/src/components/layout/__tests__/claims-nav-group.test.tsx` — render `ClaimsNavGroup` inside a memory router with routes `/reklamacije` and `/reklamacije/kategorija/$categoryCode`, a `QueryClient` pre-seeded with `claimCategoryCountsOptions().queryKey` → `{ items: [{ …MASINSKA_OBRADA, isActive: true, pending: 9, total: 14 }, { …KOMPRESORI, isActive: false, pending: 0, total: 1 }], totals: { total: 15, pending: 9 } }`, and assert: "Sve reklamacije" is first; "Mašinska obrada" shows `9`; the inactive "Kompresori" is NOT listed; at `/reklamacije/kategorija/MASINSKA_OBRADA` exactly one link has `aria-current="page"`; clicking the header toggles the children and writes `mrr:internal:nav:reklamacije-open` to localStorage. Also `buildClaimsNavChildren(undefined)` → one child, no counts.

Run: `TZ=UTC pnpm --filter internal-web test -- "claims-nav-group|active-claims-entry|navigation|command"` → PASS. ⚙ in `activeClaimsEntry`, return `search.categoryCode` on `/reklamacije` too → the "filter, not a place" test goes RED; restore.

- [ ] **Step 6: i18n**

`nav_claims_all` — „Sve reklamacije" / "All claims"; `nav_prijem_vozila` — „Prijem vozila" / "Vehicle intake" (rename from `nav_servis`); delete `nav_masinska_obrada`. `pnpm --filter @mr/i18n run build`.

- [ ] **Step 7: Full gate, commit**

```bash
git add packages apps
git commit -m "feat(internal): the menu lists the kinds of work the catalogue knows, with what is still open under each"
```

---

### Task 5: Breadcrumbs in the top bar, for the whole app

**Files:**
- Create: `apps/internal-web/src/router-static-data.d.ts`, `apps/internal-web/src/components/layout/crumbs-from-matches.ts`, `apps/internal-web/src/components/layout/internal-breadcrumbs.tsx`, `apps/internal-web/src/components/layout/__tests__/crumbs-from-matches.test.ts`
- Modify: `apps/internal-web/src/components/layout/internal-topbar.tsx`; `staticData` on `apps/internal-web/src/routes/_shell/{index,pristiglo,reklamacije,prijem,statistika}.tsx`, `settings/security.tsx`, `reklamacije/emotive/$id.tsx`, `reklamacije/domace/$id.tsx`
- Modify: `packages/i18n/src/messages/sr.json`, `en.json`

**Interfaces:**
- Produces: `StaticDataRouteOption.crumb?: () => string`, `crumbResetsTrail?: boolean`; `loaderData.crumb: string` convention (Task 6's category route and Task 7's wizard route use them).

- [ ] **Step 1: Stack check** — done 21.08.: TanStack Router `staticData` per route + `useMatches()` in the consumer (docs: "Static Route Data"). Module augmentation of `StaticDataRouteOption` types it.

- [ ] **Step 2: Failing test for the pure builder**

```ts
import { describe, expect, it } from 'vitest'

import { crumbsFromMatches } from '../crumbs-from-matches'

describe('crumbsFromMatches', () => {
  it('collects the static crumb of every matched route, in order, skipping routes without one', () => {
    expect(crumbsFromMatches([
      { staticData: {} },
      { staticData: { crumb: () => 'Reklamacije' } },
      { staticData: { crumb: () => 'Detalj' } },
    ])).toEqual(['Reklamacije', 'Detalj'])
  })
  it('takes a dynamic crumb from loaderData when the route has none of its own', () => {
    expect(crumbsFromMatches([
      { staticData: { crumb: () => 'Reklamacije' } },
      { staticData: {}, loaderData: { crumb: 'Mašinska obrada' } },
    ])).toEqual(['Reklamacije', 'Mašinska obrada'])
  })
  it('restarts the trail where a route asks for it — the wizard is not "under" the list', () => {
    expect(crumbsFromMatches([
      { staticData: { crumb: () => 'Reklamacije' } },
      { staticData: { crumb: () => 'Nova reklamacija', crumbResetsTrail: true } },
    ])).toEqual(['Nova reklamacija'])
  })
  it('drops an empty dynamic crumb (a category not yet loaded) without leaving a hole', () => {
    expect(crumbsFromMatches([{ staticData: { crumb: () => 'Reklamacije' } }, { staticData: {}, loaderData: { crumb: '' } }])).toEqual(['Reklamacije'])
  })
})
```

- [ ] **Step 3: Types, builder, component, routes**

`apps/internal-web/src/router-static-data.d.ts`:

```ts
import '@tanstack/react-router'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** This route's own segment of the top bar's trail (see internal-breadcrumbs.tsx). */
    crumb?: () => string
    /** The trail restarts here: INTERNO / NOVA REKLAMACIJA, not INTERNO / REKLAMACIJE / NOVA … */
    crumbResetsTrail?: boolean
  }
}
```

`apps/internal-web/src/components/layout/crumbs-from-matches.ts`:

```ts
export interface CrumbMatch {
  staticData: { crumb?: () => string; crumbResetsTrail?: boolean }
  loaderData?: unknown
}

function dynamicCrumb(loaderData: unknown): string | null {
  if (typeof loaderData !== 'object' || loaderData === null || !('crumb' in loaderData)) {
    return null
  }
  const crumb = (loaderData as { crumb: unknown }).crumb
  return typeof crumb === 'string' && crumb.length > 0 ? crumb : null
}

/**
 * The trail lives next to the routes, not in a pathname if-chain: a route declares its segment
 * as `staticData.crumb` (or returns `{ crumb }` from its loader when the name is data), and the
 * top bar folds the matches. A screen cannot be added without its name reaching the bar.
 */
export function crumbsFromMatches(matches: readonly CrumbMatch[]): string[] {
  let trail: string[] = []
  for (const match of matches) {
    if (match.staticData.crumbResetsTrail) {
      trail = []
    }
    const label = match.staticData.crumb?.() ?? dynamicCrumb(match.loaderData)
    if (label !== null && label.length > 0) {
      trail.push(label)
    }
  }
  return trail
}
```

`apps/internal-web/src/components/layout/internal-breadcrumbs.tsx`:

```tsx
import { m } from '@mr/i18n'
import { useMatches } from '@tanstack/react-router'

import { crumbsFromMatches } from './crumbs-from-matches'

/** Prototype: `INTERNO / REKLAMACIJE / MAŠINSKA OBRADA` — mono 10.5px, tracking .16em, slashes at half opacity, the last part in the text colour. */
export function InternalBreadcrumbs(): React.ReactElement {
  const matches = useMatches()
  const crumbs = crumbsFromMatches(matches)
  const parts = [m.topbar_app_name(), ...crumbs]

  return (
    <nav aria-label={m.topbar_breadcrumbs_label()} className="hidden min-w-0 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-mri-text2 sm:block">
      <ol className="flex min-w-0 items-center gap-[6px]">
        {parts.map((part, index) => (
          <li key={`${index}-${part}`} className="flex min-w-0 items-center gap-[6px]">
            {index > 0 ? <span aria-hidden="true" className="opacity-50">/</span> : null}
            <span className={index === parts.length - 1 ? 'truncate text-mri-text' : 'truncate'} aria-current={index === parts.length - 1 ? 'page' : undefined}>
              {part}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}
```

`internal-topbar.tsx`: delete `sectionLabel` and its `useRouterState` import; render `<InternalBreadcrumbs />` where the section span was. Routes — `staticData` beside `component`: `_shell/index.tsx` → `{ crumb: m.nav_pocetna }`; `pristiglo.tsx` → `{ crumb: m.nav_pristiglo }`; `reklamacije.tsx` → `{ crumb: m.nav_reklamacije }`; `prijem.tsx` → `{ crumb: m.nav_prijem_vozila }`; `statistika.tsx` → `{ crumb: m.nav_statistika }`; `settings/security.tsx` → `{ crumb: m.nav_security }`; `reklamacije/emotive/$id.tsx` and `domace/$id.tsx` → `{ crumb: m.crumb_detail }`. (Task 6 adds the category route's `loaderData.crumb`; Task 7 adds the wizard's `{ crumb: m.crumb_new_claim, crumbResetsTrail: true }`.)

i18n: `topbar_app_name` — „INTERNO" / "INTERNAL"; `topbar_breadcrumbs_label` — „Putanja" / "Breadcrumbs"; `crumb_detail` — „Detalj" / "Detail"; `crumb_new_claim` — „Nova reklamacija" / "New claim". Build i18n.

Run: `TZ=UTC pnpm --filter internal-web test -- crumbs-from-matches` → PASS.

- [ ] **Step 4: Full gate, commit**

```bash
git add packages apps
git commit -m "feat(internal): the top bar reads where you are off the routes themselves"
```

---

### Task 6: The list — one screen, two modes

**Files:**
- Create: `apps/internal-web/src/routes/_shell/reklamacije/kategorija/$categoryCode.tsx`, `apps/internal-web/src/features/claims/claims-list-header.tsx`, `apps/internal-web/src/features/claims/claims-list-empty.tsx`, `apps/internal-web/src/features/claims/claims-list-mode.ts`
- Modify: `apps/internal-web/src/routes/_shell/reklamacije/index.tsx`, `apps/internal-web/src/features/claims/claims-list-content.tsx`, `claims-filters.tsx`, `claims-table.tsx`, `apps/internal-web/src/features/command-palette/claim-target.ts`
- Modify: `packages/shared/src/queries/claim-detail-search.ts`, `packages/ui/src/primitives/searchable-select.tsx`
- Create: `apps/internal-web/src/features/claims/__tests__/claims-list-mode.test.ts`, `apps/internal-web/src/features/claims/__tests__/claims-list-header.test.tsx`; modify `claims-filters.test.tsx`, `claims-table.test.tsx`; create `packages/ui/src/primitives/__tests__/searchable-select-groups.test.tsx`
- Modify: `packages/i18n/src/messages/sr.json`, `en.json`

**Interfaces:**
- Consumes: `claimCategoryCountsOptions`, `ClaimCategoryCount` (Task 1); `activeClaimsEntry` reads the route shape (Task 4); `loaderData.crumb` (Task 5).
- Produces: `ClaimsListMode = { kind: 'all' } | { kind: 'category'; code: string; category: ClaimCategoryCount | null }`; `claimDetailTarget(claim, categoryCode?)`; `SearchableSelectOption.group?: string`; route `/reklamacije/kategorija/$categoryCode` (Task 7 navigates to it after save).

- [ ] **Step 1: Stack check** — container queries for the header row (`@container` on the header wrapper, `@min-[640px]:flex-row`), not `sm:` — the sidebar's width decides what fits, not the viewport (memory: "Container query, not viewport breakpoint").

- [ ] **Step 2: Failing tests**

`claims-list-mode.test.ts` — `resolveClaimsListMode(params, counts)`; `claimDetailTarget(claim, 'MASINSKA_OBRADA').search.categoryCode === 'MASINSKA_OBRADA'` and `claimDetailTarget(claim).search` has no `categoryCode`; `isCategoryEmpty(search, total)` true only with no filter besides the place and `total === 0`. `claims-filters.test.tsx` — in category mode there is no combobox named „Kategorija", there is a chip reading `KATEGORIJA = MAŠINSKA OBRADA`, and its ✕ calls `onLeaveCategory` with the other filters intact; in all mode the category select lists „Ugašene" as a group heading when an inactive category with claims is present. `claims-table.test.tsx` — `showCategoryColumn={false}` hides the column; an inactive category renders its name with `†` and a dashed class. `searchable-select-groups.test.tsx` — options with `group: 'Ugašene'` render under one heading after the ungrouped ones.

- [ ] **Step 3: Shared + UI primitives**

`claim-detail-search.ts`: `categoryCode: z.string().trim().min(1).optional()` on `ClaimDetailSearchSchema` (the default stays `{ tab: Pregled }`). `claim-target.ts`:

```ts
export function claimDetailTarget(claim: Pick<ClaimListItem, 'kind' | 'id'>, categoryCode?: string): ClaimDetailTarget {
  const search: ClaimDetailSearch = categoryCode === undefined ? CLAIM_DETAIL_DEFAULT_SEARCH : { ...CLAIM_DETAIL_DEFAULT_SEARCH, categoryCode }
  …same two branches, each with `search`…
}
```

`searchable-select.tsx`: `SearchableSelectOption.group?: string`; in the list body render ungrouped options first, then for each distinct `group` (in first-seen order) a heading `<p className="px-2 pb-1 pt-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group}</p>` followed by its options; `filterSearchableSelectOptions` unchanged (groups filter with their options).

- [ ] **Step 4: Mode, header, empty states**

`apps/internal-web/src/features/claims/claims-list-mode.ts`:

```ts
import type { ClaimCategoryCount, ClaimsSearch } from '@mr/shared'

export type ClaimsListMode =
  | { kind: 'all' }
  | { kind: 'category'; code: string; category: ClaimCategoryCount | null }

export function resolveClaimsListMode(categoryCode: string | undefined, counts: readonly ClaimCategoryCount[]): ClaimsListMode {
  if (categoryCode === undefined) {
    return { kind: 'all' }
  }
  return { kind: 'category', code: categoryCode, category: counts.find((item) => item.code === categoryCode) ?? null }
}

/** "Nothing here yet" only when the place itself is empty — any filter makes it "no match". */
export function isCategoryEmpty(search: ClaimsSearch, total: number): boolean {
  const filtered =
    search.kind !== undefined || search.outcome !== undefined || search.manufacturerId !== undefined ||
    search.dateFrom !== undefined || search.dateTo !== undefined ||
    (search.search !== undefined && search.search.length > 0)
  return !filtered && total === 0
}
```

`claims-list-header.tsx` (prototype: eyebrow `700 10px mono .22em var(--red)`, H1 `26px 900 -.02em`, sub `13px text2`, button `40px` high, `0 18px`, uppercase 12px 700 .06em, `--mri-btn` fill):

```tsx
export interface ClaimsListHeaderProps {
  mode: ClaimsListMode
  pendingTotal: number
  canCreate: boolean
}

export function ClaimsListHeader({ mode, pendingTotal, canCreate }: ClaimsListHeaderProps): React.ReactElement {
  const isCategory = mode.kind === 'category'
  const title = isCategory ? (mode.category?.name ?? mode.code) : m.claims_list_all_title()
  const subtitle = isCategory
    ? m.claims_list_category_subtitle({ pending: String(mode.category?.pending ?? 0), total: String(mode.category?.total ?? 0) })
    : m.claims_list_all_subtitle({ pending: String(pendingTotal) })

  return (
    <div className="@container">
      <div className="flex flex-col gap-4 @min-[640px]:flex-row @min-[640px]:items-start">
        <div className="flex flex-col gap-[5px]">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-mri-red">{isCategory ? m.claims_list_eyebrow_category() : m.claims_list_eyebrow_all()}</p>
          <h1 className="text-[26px] font-black tracking-[-0.02em] text-mri-text">{title}</h1>
          <p className="text-[13px] text-mri-text2">{subtitle}</p>
        </div>
        {canCreate ? (
          <Link
            to="/reklamacije/nova"
            search={isCategory ? { categoryCode: mode.code } : {}}
            className={internalButtonClasses('primary', 'ml-auto h-10 w-auto px-[18px] text-xs')}
          >
            <Plus className="size-4" aria-hidden="true" />
            {m.claims_new_claim()}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
```

`claims-list-empty.tsx` — two components from the prototype's `emptyCat`/`emptyFilter` blocks: `ClaimsCategoryEmpty({ categoryCode, canCreate })` (icon in a 44px inbg square, „U ovoj kategoriji još nema reklamacija", italic line, the same `/reklamacije/nova` link) and `ClaimsFilterEmpty({ onClear })` („Nijedna reklamacija ne odgovara filterima", italic line, a red uppercase „Poništi filtere" text button).

- [ ] **Step 5: Content, filters, table take the mode**

`claims-list-content.tsx` — props gain `mode: ClaimsListMode`, `canCreate: boolean`, `onLeaveCategory: (search: ClaimsSearch) => void`; it reads `claimCategoryCountsOptions()` with `useSuspenseQuery`, renders `<ClaimsListHeader>` first, passes `mode` to `ClaimsFilters` and `showCategoryColumn={mode.kind === 'all'}` + `categoryCode` to `ClaimsTable`, and swaps the table for `ClaimsCategoryEmpty` (when `mode.kind === 'category' && isCategoryEmpty(search, data.total)`) or `ClaimsFilterEmpty` (when `data.items.length === 0`). The list query's filters in category mode are `{ ...claimsFiltersFromSearch(search), categoryCode: mode.code }`.

`claims-filters.tsx` — prop `mode`; the category block becomes:

```tsx
      {mode.kind === 'category' ? (
        <div className="flex h-10 items-center gap-2 self-end rounded-[9px] border border-dashed border-[rgba(237,28,36,.45)] bg-[rgba(237,28,36,.09)] px-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mri-text2">
          {m.claims_filter_category_chip_prefix()} <span className="text-mri-text">{mode.category?.name ?? mode.code}</span>
          <button type="button" title={m.claims_filter_category_chip_leave()} aria-label={m.claims_filter_category_chip_leave()} className="text-xs text-mri-redh" onClick={() => onLeaveCategory({ ...search, page: 1 })}>✕</button>
        </div>
      ) : (
        …the existing select, options built from `claimCategoryCountsOptions()`:
          active → { value: code, label: name, keywords: code }
          inactive (all have claims by construction) → { …, label: `${name} †`, group: m.claims_filter_category_retired_group() }
      )}
```

`handleClearFilters` never touches `categoryCode` in category mode (it is not in the search there). The `claimCategoriesReferenceOptions` import leaves this file.

`claims-table.tsx` — props `showCategoryColumn: boolean`, `categoryCode?: string`; build columns with the category column only when shown; the category cell: `row.original.category === null ? '—' : <span className={cn('rounded-md border px-2 py-[3px] font-mono text-[10px]', row.original.category.isActive ? 'border-mri-border2 bg-mri-inbg text-mri-text' : 'border-dashed border-mri-border2 bg-mri-inbg text-mri-text2')}>{row.original.category.name}{row.original.category.isActive ? '' : ' †'}</span>`; every `claimDetailLink(row.original)` becomes `claimDetailTarget(row.original, categoryCode)`.

- [ ] **Step 6: The routes**

`reklamacije/index.tsx` — the header moves into `ClaimsListContent` (mode `{ kind: 'all' }`), `canCreate = has emotive_claims.create OR domace_claims.create`, the two old `Link`s are deleted, the loader also `ensureQueryData(claimCategoryCountsOptions())`. New `reklamacije/kategorija/$categoryCode.tsx`:

```tsx
const CategorySearchSchema = ClaimsSearchSchema.omit({ categoryCode: true })

export const Route = createFileRoute('/_shell/reklamacije/kategorija/$categoryCode')({
  beforeLoad: internalRequireRoles(['operator', 'viewer', 'admin']),
  validateSearch: (search) => CategorySearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, params: { categoryCode }, deps: search }) => {
    const filters = { ...claimsFiltersFromSearch(search), categoryCode }
    const { page, pageSize } = claimsPaginationFromSearch(search)
    const [, counts] = await Promise.all([
      queryClient.ensureQueryData(claimsListOptions(filters, page, pageSize, claimsSortFromSearch(search))),
      queryClient.ensureQueryData(claimCategoryCountsOptions()),
      queryClient.ensureQueryData(engineManufacturersReferenceOptions({ activeOnly: true })),
    ])
    // The top bar's second segment (Task 5): the category's name, as data.
    return { crumb: counts.items.find((item) => item.code === categoryCode)?.name ?? '' }
  },
  component: KategorijaComponent,
  pendingComponent: ReklamacijePending,
  errorComponent: ReklamacijeError,
})

function KategorijaComponent(): React.ReactElement {
  const { categoryCode } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: counts } = useSuspenseQuery(claimCategoryCountsOptions())
  const mode = resolveClaimsListMode(categoryCode, counts.items)
  …canCreate as in index.tsx…
  return (
    <ClaimsListContent
      mode={mode}
      canCreate={canCreate}
      search={search}
      onSearchChange={(next) => void navigate({ search: next, replace: true })}
      onLeaveCategory={(next) => void navigate({ to: '/reklamacije', search: next })}
    />
  )
}
```

(Export `ReklamacijePending`/`ReklamacijeError` from a small `features/claims/claims-route-states.tsx` so both routes share them instead of copying.)

- [ ] **Step 7: i18n**

`claims_list_eyebrow_all` „SVE VRSTE POSLA"/"ALL KINDS OF WORK" · `claims_list_eyebrow_category` „KATEGORIJA"/"CATEGORY" · `claims_list_all_title` „Sve reklamacije"/"All claims" · `claims_list_all_subtitle` „Obe vrste, sve kategorije · Nerešeno: {pending}"/"Both kinds, all categories · Open: {pending}" · `claims_list_category_subtitle` „Nerešeno: {pending} · Ukupno: {total}"/"Open: {pending} · Total: {total}" · `claims_new_claim` „Nova reklamacija"/"New claim" · `claims_filter_category_chip_prefix` „KATEGORIJA ="/"CATEGORY =" · `claims_filter_category_chip_leave` „Ukloni — pređi na sve reklamacije"/"Remove — go to all claims" · `claims_filter_category_retired_group` „Ugašene"/"Retired" · `claims_empty_category_title` „U ovoj kategoriji još nema reklamacija"/"No claims in this category yet" · `claims_empty_category_hint` „Kategorija je aktivna u šifarniku — prva reklamacija je osniva na listi."/"The category is live in the catalogue — the first claim opens this list." · `claims_empty_filter_title` „Nijedna reklamacija ne odgovara filterima"/"No claim matches the filters" · `claims_empty_filter_hint` „Proveri pretragu i filtere, ili ih poništi."/"Check the search and filters, or clear them." · `claims_empty_filter_clear` „Poništi filtere"/"Clear filters". Delete the now-unused `emotive_claims_new_claim`/`domace_claims_new_claim` only if nothing else uses them (grep).

- [ ] **Step 8: Run green, mutate, gate, commit**

`TZ=UTC pnpm --filter internal-web test` → PASS. ⚙ in `isCategoryEmpty` drop the `filtered` check → the "no match vs nothing here" test goes RED; restore.

```bash
git add packages apps
git commit -m "feat(internal): a kind of work has its own list, and the list of everything still knows the difference"
```

---

### Task 7: The create wizard — one shell, two kind-specific step sets

**Files:**
- Create: `apps/internal-web/src/routes/_shell/reklamacije/nova.tsx`; Delete: `apps/internal-web/src/routes/_shell/reklamacije/emotive/nova.tsx`, `apps/internal-web/src/routes/_shell/reklamacije/domace/nova.tsx`
- Create: `apps/internal-web/src/features/claims/create/create-steps-handle.ts`, `claim-create-wizard.tsx`, `claim-kind-step.tsx`, `category-chip.tsx`, `category-fields-group.tsx`
- Create: `apps/internal-web/src/features/emotive-claims/create/emotive-create-steps.tsx` (from `emotive-claim-create-wizard.tsx`, which is DELETED), `apps/internal-web/src/features/domace-claims/create/domace-create-steps.tsx`, `domace-step-review.tsx`; Delete: `domace-claim-create-form.tsx`
- Modify: `apps/internal-web/src/components/wizard-stepper.tsx`, `apps/internal-web/src/features/emotive-claims/create/{step-basic-fields.tsx,step-review.tsx,emotive-claim-create-schemas.ts,use-create-emotive-claim.ts}`, `apps/internal-web/src/features/domace-claims/create/{domace-basic-fields.tsx,domace-claim-create-schemas.ts,use-create-domace-claim.ts}`, `apps/internal-web/src/lib/auth-guard.ts`, `apps/internal-web/src/features/command-palette/{command-registry.ts,command-palette.tsx}`
- Tests: create `apps/internal-web/src/features/claims/create/__tests__/{claim-create-wizard.test.tsx,category-fields-group.test.tsx}`, `apps/internal-web/src/features/domace-claims/create/__tests__/domace-create-steps.test.tsx`, `apps/internal-web/src/components/__tests__/wizard-stepper.test.tsx`; rename `emotive-claim-create-wizard.test.tsx` → `emotive-create-steps.test.tsx`; delete `domace-claim-create-form.test.tsx` (its worker-source twin `domace-create-worker-source.test.tsx` is re-pointed at `DomaceCreateSteps`); update `command-registry.test.ts`, `command-palette.test.tsx`
- Modify: `packages/i18n/src/messages/sr.json`, `en.json`

**Interfaces:**
- Consumes: `claimCategoriesReferenceOptions`, `claimCategoryFieldsForCategoryOptions`, `ClaimCategoryFieldListItem` (Task 2), `categoryFieldValues` on both create inputs (Task 3), `claimCategoryCountsOptions` (Task 1), route `/reklamacije/kategorija/$categoryCode` (Task 6), `crumbResetsTrail` (Task 5).
- Produces: `CreateStepsHandle`, `CreateStep`, `CategoryFieldsGroup` (Task 8 reuses the field-state idea, not the component), route `/reklamacije/nova?kind=&categoryCode=`.

- [ ] **Step 1: Stack check** — TanStack Form: `form.state.isDirty`, `form.setFieldValue`, `form.reset` (Context7 `/tanstack/form`, query "form.state.isDirty and setFieldValue in React"); React `useImperativeHandle` + `forwardRef` for a parent-driven child (the shell presses DALJE, the kind form validates its own step).

- [ ] **Step 2: Failing tests — the shell**

`apps/internal-web/src/features/claims/create/__tests__/claim-create-wizard.test.tsx` — harness like the old wizard test (memory router with `/reklamacije/nova`, `/reklamacije`, `/reklamacije/kategorija/$categoryCode`; `QueryClient` pre-seeded with every reference query the steps read — customers, manufacturers, categories, assigned workers, employees, departments, external parties, engine types, `claimCategoryCountsOptions`, and `claimCategoryFieldsForCategoryOptions(CATEGORY_ID)` → the seeded "Obrađeni deo" field with three options; `vi.stubGlobal('fetch', …)` capturing POSTs and answering `201` with `{ id, mrNumber, category: { id, code, name, isActive: true, deactivatedAt: null } }`):

```ts
describe('ClaimCreateWizard', () => {
  it('starts on the kind step and moves to the data step the moment a kind is clicked', async () => {
    await renderWizard({ canCreateEmotive: true, canCreateDomace: true })
    await user.click(screen.getByRole('button', { name: /EMOTIVE/ }))
    expect(screen.getByRole('heading', { name: 'Osnovni podaci' })).toBeInTheDocument()
    expect(screen.getByText('VRSTA').closest('[data-step-state]')).toHaveAttribute('data-step-state', 'done')
  })

  it('disables the kind the user may not create and says why', async () => {
    await renderWizard({ canCreateEmotive: true, canCreateDomace: false })
    const domace = screen.getByRole('button', { name: /DOMAĆA/ })
    expect(domace).toBeDisabled()
    expect(screen.getByText('Nemaš dozvolu za unos domaćih reklamacija.')).toBeInTheDocument()
  })

  it('skips the kind step when the palette says which kind, and "Nazad" returns to it', async () => {
    await renderWizard({ canCreateEmotive: true, canCreateDomace: true }, { kind: 'domace' })
    expect(screen.getByRole('heading', { name: 'Osnovni podaci' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Nazad' }))
    expect(screen.getByRole('button', { name: /EMOTIVE/ })).toBeInTheDocument()
  })

  it('seeds the category chip from the URL, sends that category in the payload, and lands on its list', async () => {
    // ⚙ drop `categoryId` from the steps' payload → RED
    const { fetchMock } = await renderWizard({ canCreateEmotive: true, canCreateDomace: true }, { kind: 'emotive', categoryCode: 'MASINSKA_OBRADA' })
    expect(screen.getByRole('button', { name: /KATEGORIJA: MAŠINSKA OBRADA/ })).toBeInTheDocument()
    await fillEmotiveBasics()            // MR, partner, manufacturer, engine type, date
    await user.click(screen.getByRole('button', { name: 'Dalje' }))
    await user.click(screen.getByRole('button', { name: 'Dalje' }))
    await user.click(screen.getByRole('button', { name: /Sačuvaj/ }))
    const body = JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]?.body))
    expect(body.categoryId).toBe(CATEGORY_ID)
    await waitFor(() => expect(routerHistory.location.pathname).toBe('/reklamacije/kategorija/MASINSKA_OBRADA'))
  })

  it('refuses to save without a category and names what is missing', async () => {
    await renderWizard({ canCreateEmotive: true, canCreateDomace: true }, { kind: 'emotive' })
    await fillEmotiveBasics()
    await user.click(screen.getByRole('button', { name: 'Dalje' }))
    await user.click(screen.getByRole('button', { name: 'Dalje' }))
    expect(screen.getByRole('button', { name: /Sačuvaj/ })).toBeDisabled()
    expect(screen.getByText('Fali: kategorija. Izaberi je u zaglavlju.')).toBeInTheDocument()
  })

  it('asks before leaving a dirty form', async () => {
    await renderWizard({ canCreateEmotive: true, canCreateDomace: true }, { kind: 'emotive' })
    await user.type(screen.getByLabelText(/MR broj/), '9001/26')
    await user.click(screen.getByRole('link', { name: /Nazad na listu/ }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Izgubićeš uneto')
  })

  it('shows the category\'s fields under the basics and sends the chosen option', async () => {
    const { fetchMock } = await renderWizard({ canCreateEmotive: true, canCreateDomace: true }, { kind: 'emotive', categoryCode: 'MASINSKA_OBRADA' })
    await user.click(screen.getByRole('button', { name: 'Glava' }))
    await fillEmotiveBasics()
    await user.click(screen.getByRole('button', { name: 'Dalje' }))
    await user.click(screen.getByRole('button', { name: 'Dalje' }))
    expect(screen.getByText('Obrađeni deo')).toBeInTheDocument()    // review row
    await user.click(screen.getByRole('button', { name: /Sačuvaj/ }))
    const body = JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]?.body))
    expect(body.categoryFieldValues).toEqual({ obradjeni_deo: 'glava' })
  })
})
```

`domace-create-steps.test.tsx` — the payload contract:

```ts
  it('sends exactly what the serializer says for the same values — the long form is gone, the contract is not', async () => {
    const { fetchMock } = await renderWizard({ canCreateEmotive: false, canCreateDomace: true }, { kind: 'domace', categoryCode: 'REMONT_MOTORA' })
    await user.type(screen.getByLabelText(/MR broj/), 'DOM-1/26')
    await user.type(screen.getByLabelText(/Kupac/), 'Autoservis Đorđević')
    await user.type(screen.getByLabelText(/Iznos delova/), '100')
    await user.click(screen.getByRole('button', { name: 'Dalje' }))
    await user.click(screen.getByRole('button', { name: 'Dalje' }))
    await user.click(screen.getByRole('button', { name: /Sačuvaj/ }))
    const body = JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]?.body))
    const expected = serializeDomaceCreateBody(formValuesToCreateInput({
      ...DOMACE_CLAIM_FORM_DEFAULTS, mrNumber: 'DOM-1/26', customerName: 'Autoservis Đorđević', partsAmount: '100', categoryId: CATEGORY_ID,
    }))
    expect(body).toEqual(JSON.parse(JSON.stringify(expected)))
  })
```

Run → FAIL (modules missing).

- [ ] **Step 3: The handle, the stepper, the chip, the fields group**

`create-steps-handle.ts`:

```ts
export type CreateStep = 'basic' | 'faults' | 'review'
export const CREATE_STEPS: readonly CreateStep[] = ['basic', 'faults', 'review']

/** What a kind-specific step set exposes to the shell that presses its buttons (V2 spec §8.2). */
export interface CreateStepsHandle {
  /** Validates the current step; false (with errors shown) means "do not advance". */
  validateStep(): boolean
  /** Submits the kind's own form to its own endpoint; true when saved. */
  submit(): Promise<boolean>
  isDirty(): boolean
}
```

`apps/internal-web/src/components/wizard-stepper.tsx` — prototype `steps`: circle 26px, labels mono 9.5px `.13em`; states `done | active | upcoming`, connectors green once passed; `data-step-state` on each step wrapper so tests can read it:

```tsx
export type WizardStepState = 'done' | 'active' | 'upcoming'

export function wizardStepState(index: number, currentIndex: number): WizardStepState {
  if (index < currentIndex) return 'done'
  return index === currentIndex ? 'active' : 'upcoming'
}

export function WizardStepper({ steps, currentIndex }: { steps: readonly string[]; currentIndex: number }) {
  return (
    <div className="mb-[34px] flex items-center px-[2px] py-1">
      {steps.map((label, index) => {
        const state = wizardStepState(index, currentIndex)
        return (
          <Fragment key={label}>
            <div className="flex flex-none items-center gap-[9px]" data-step-state={state}>
              <span aria-hidden="true" className={cn('grid size-[26px] place-items-center rounded-full font-mono text-[11px] font-bold',
                state === 'active' && 'bg-mri-red text-white',
                state === 'done' && 'border border-[rgba(31,169,113,0.5)] bg-[rgba(31,169,113,0.15)] text-mri-ok',
                state === 'upcoming' && 'border border-mri-border2 text-mri-text2')}>
                {state === 'done' ? '✓' : index + 1}
              </span>
              <span className={cn('whitespace-nowrap font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em]', state === 'active' ? 'text-mri-text' : 'text-mri-text2')}>{label}</span>
            </div>
            {index < steps.length - 1 ? <span aria-hidden="true" className={cn('mx-3 h-px flex-1', state === 'done' ? 'bg-[rgba(31,169,113,0.5)]' : 'bg-mri-border')} /> : null}
          </Fragment>
        )
      })}
    </div>
  )
}
```

(`wizard-stepper.test.tsx`: `wizardStepState(0, 2) === 'done'`, `(2,2) === 'active'`, `(3,2) === 'upcoming'`; the intake wizard also uses this component — run its tests.)

`category-chip.tsx` (prototype `toggleCatMenu` block: 36px, inbg + border2, mono 10.5px `.08em`, menu 196px raised):

```tsx
export interface CategoryChipProps {
  categories: readonly ClaimCategoryListItem[]
  value: string
  onChange: (categoryId: string) => void
}

export function CategoryChip({ categories, value, onChange }: CategoryChipProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const current = categories.find((category) => category.id === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-haspopup="listbox" className="inline-flex h-9 items-center gap-2 rounded-[9px] border border-mri-border2 bg-mri-inbg px-[13px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mri-text2 transition-colors hover:border-mri-text2">
          {m.claims_create_category_chip_prefix()} <span className={current === undefined ? 'text-mri-redh' : 'text-mri-text'}>{current?.name ?? m.claims_create_category_chip_pick()}</span>
          <span aria-hidden="true" className="text-[9px]">▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-[196px] rounded-xl border-mri-border2 bg-mri-raised p-[6px] shadow-[0_18px_44px_rgba(0,0,0,.55)]">
        <div role="listbox" aria-label={m.field_claim_category()}>
          {categories.map((category) => (
            <button key={category.id} type="button" role="option" aria-selected={category.id === value}
              className={cn('flex h-[31px] w-full items-center rounded-lg px-[9px] text-left text-[12.5px] hover:bg-mri-rowhv', category.id === value ? 'bg-[rgba(237,28,36,.11)] font-bold text-mri-text' : 'font-semibold text-mri-text2')}
              onClick={() => { onChange(category.id); setOpen(false) }}>
              {category.name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

`category-fields-group.tsx` (prototype `w1` dashed block; ONLY active fields and active options are offered; never rendered without fields):

```tsx
export interface CategoryFieldsGroupProps {
  categoryName: string
  fields: readonly ClaimCategoryFieldListItem[]
  values: ClaimCategoryFieldValues
  disabled: boolean
  onChange: (next: ClaimCategoryFieldValues) => void
}

/** Fields that belong to this kind of work only — visibly apart, so nobody takes them for common ones. */
export function CategoryFieldsGroup({ categoryName, fields, values, disabled, onChange }: CategoryFieldsGroupProps): React.ReactElement | null {
  const live = fields.filter((field) => field.isActive)
  if (live.length === 0) return null
  return (
    <section className="flex flex-col gap-[11px] rounded-xl border border-dashed border-mri-border2 p-[15px]" aria-label={m.claims_create_category_fields_title()}>
      <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-mri-text2">
        {m.claims_create_category_fields_title()} · <span className="text-mri-text">{categoryName}</span>
      </p>
      {live.map((field) => (
        <div key={field.id} className="flex flex-col gap-[6px]" role="group" aria-label={field.name}>
          <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">{field.name}</span>
          <div className="flex flex-wrap gap-[7px]">
            {(field.options ?? []).filter((option) => option.isActive).map((option) => {
              const selected = values[field.code] === option.code
              return (
                <button key={option.id} type="button" disabled={disabled} aria-pressed={selected}
                  className={cn('h-[34px] rounded-lg border px-[14px] text-[12.5px] transition-colors', selected ? 'border-[rgba(237,28,36,.5)] bg-[rgba(237,28,36,.13)] font-bold text-mri-text' : 'border-mri-border2 font-semibold text-mri-text2 hover:border-mri-text2')}
                  onClick={() => {
                    const next = { ...values }
                    if (selected) delete next[field.code]   // a second tap clears — fields are optional
                    else next[field.code] = option.code
                    onChange(next)
                  }}>
                  {option.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <p className="text-[11.5px] italic text-mri-text2">{m.claims_create_category_fields_hint()}</p>
    </section>
  )
}
```

- [ ] **Step 4: The EMOTIVE steps (from the old wizard)**

Rename `emotive-claim-create-wizard.tsx` → `emotive-create-steps.tsx`. Keep the queries, the form, `validateCurrentStep`, the error note; drop the stepper and the buttons; take the step from props; expose the handle:

```tsx
export interface EmotiveCreateStepsProps {
  step: CreateStep
  categoryId: string
  categoryName: string
  categoryFields: readonly ClaimCategoryFieldListItem[]
  onSaved: (claim: EmotiveClaimDetail) => void
}

export const EmotiveCreateSteps = forwardRef<CreateStepsHandle, EmotiveCreateStepsProps>(function EmotiveCreateSteps(
  { step, categoryId, categoryName, categoryFields, onSaved }, ref,
) {
  …queries as before…
  const createMutation = useCreateEmotiveClaim()
  const form = useForm({
    defaultValues: EMOTIVE_CLAIM_FORM_DEFAULTS,
    onSubmit: async ({ value }) => {
      setSubmitError(null); setSubmitConflict(null)
      try {
        const created = await createMutation.mutateAsync(formValuesToCreateInput(value))
        onSaved(created)
        return true
      } catch (error) {
        setSubmitError(createEmotiveClaimErrorMessage(error)); setSubmitConflict(mrConflictFromError(error))
        return false
      }
    },
  })

  // The chip in the shell owns the category; the form mirrors it and drops the old
  // category's answers when it changes — they belong to fields the new one does not have.
  useEffect(() => {
    form.setFieldValue('categoryId', categoryId)
    form.setFieldValue('categoryFieldValues', {})
  }, [categoryId, form])

  useImperativeHandle(ref, () => ({
    validateStep: () => validateStep(step, form.state.values),
    submit: async () => { await form.handleSubmit(); return lastSubmitSucceeded.current },
    isDirty: () => form.state.isDirty,
  }))
  …
  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-6" noValidate>
      {step === 'basic' ? (
        <>
          <StepBasicFields form={form} … showCategoryField={false} />
          <form.Field name="categoryFieldValues" children={(field) => (
            <CategoryFieldsGroup categoryName={categoryName} fields={categoryFields} values={field.state.value} disabled={isPending} onChange={field.handleChange} />
          )} />
        </>
      ) : null}
      {step === 'faults' ? <StepFaultsFields … /> : null}
      {step === 'review' ? <StepReview … categoryName={categoryName} categoryFieldRows={reviewRowsFor(categoryFields, form.state.values.categoryFieldValues)} /> : null}
      {submitError ? <InternalNote tone="error" role="alert">…</InternalNote> : null}
    </form>
  )
})
```

(`lastSubmitSucceeded` is a ref set inside `onSubmit` — TanStack Form's `handleSubmit` resolves void. `reviewRowsFor(fields, values)` maps each `[code, optionCode]` to `{ label: field.name, value: option.name }` — put it in `category-fields-group.tsx` and export it; Task 8's detail uses the resolver instead.)

`emotive-claim-create-schemas.ts`: `EmotiveClaimFormValues.categoryFieldValues: ClaimCategoryFieldValues`, default `{}`, passed through in `formValuesToCreateInput`. `step-basic-fields.tsx`: new prop `showCategoryField?: boolean` (default `true`); the category `form.Field` renders only when true. `step-review.tsx`: new props `categoryName: string`, `categoryFieldRows: readonly { label: string; value: string }[]`; a `ReviewItem` „Kategorija" right after „Broj reklamacije" and one per row after „Tip motora". `use-create-emotive-claim.ts`: `onSuccess` keeps only `invalidateInternalClaimQueries` — the toast and the navigation move to the shell. The same edits for DOMAĆE (`domace-basic-fields.tsx` `showCategoryField`, `domace-claim-create-schemas.ts` values + default, `use-create-domace-claim.ts` without the toast).

- [ ] **Step 5: The DOMAĆE steps and their review**

`domace-create-steps.tsx` — the same shape as the EMOTIVE one over `DomaceBasicFields` → `StepFaultsFields` → `DomaceStepReview`, `domaceClaimBasicFieldsSchema` for step validation (`validateStep('basic')` = `domaceClaimFormSchema.safeParse` minus faults; `'faults'` = `validateFaultDrafts`), `useCreateDomaceClaim`, `formValuesToCreateInput` from `domace-claim-create-schemas.ts`. `domace-step-review.tsx` — the EMOTIVE review's `ReviewItem`/`faultLabel`/`resolveFaultTarget` (export them from `step-review.tsx` instead of copying) over: MR broj, Broj reklamacije, Kategorija, Kupac, Proizvođač, Tip motora, Broj motora, Datum prijema, Datum završetka, Broj računa, Iznos originalne fakture, Iznos delova, Iznos rada, then the category-field rows, the faults table, and `InternalNote tone="info"` with `m.claims_create_review_note_domace()`.

- [ ] **Step 6: The shell and its route**

`claim-kind-step.tsx` (prototype `w0`): two `<button type="button">` cards (`rounded-[14px] border border-mri-border2 bg-mri-surface p-[22px]`, hover lift), pill `EMOTIVE` (`bg-mri-info-bg text-mri-info`) / `DOMAĆA` (`bg-mri-domace-bg text-mri-domace`), title 16px 800, description 12.5px text2; `disabled` + the reason line when the kind is not permitted; the sentence above the cards (`claims_create_kind_lead_with_category` / `claims_create_kind_lead_without_category`).

`claim-create-wizard.tsx`:

```tsx
export interface ClaimCreateWizardProps {
  initialKind: ClaimKind | undefined
  initialCategoryCode: string | undefined
  canCreateEmotive: boolean
  canCreateDomace: boolean
}

const STEP_TITLES: Record<CreateStep, () => string> = {
  basic: () => m.claims_create_step_basic_title(),
  faults: () => m.claims_create_step_faults_title(),
  review: () => m.claims_create_step_review_title(),
}

export function ClaimCreateWizard({ initialKind, initialCategoryCode, canCreateEmotive, canCreateDomace }: ClaimCreateWizardProps): React.ReactElement {
  const navigate = useNavigate()
  const { data: categories } = useSuspenseQuery(claimCategoriesReferenceOptions({ activeOnly: true }))
  const [kind, setKind] = useState<ClaimKind | null>(initialKind ?? null)
  const [stepIndex, setStepIndex] = useState(initialKind === undefined ? 0 : 1)
  const [categoryId, setCategoryId] = useState(() => categories.find((c) => c.code === initialCategoryCode)?.id ?? '')
  const [confirming, setConfirming] = useState<'exit' | 'kind' | null>(null)
  const stepsRef = useRef<CreateStepsHandle | null>(null)

  const category = categories.find((c) => c.id === categoryId)
  const { data: fieldDefinitions } = useQuery({ ...claimCategoryFieldsForCategoryOptions(categoryId), enabled: categoryId !== '' })
  const categoryFields = categoryId === '' ? [] : (fieldDefinitions ?? [])
  const step: CreateStep | null = stepIndex === 0 ? null : CREATE_STEPS[stepIndex - 1] ?? null

  const listTarget = initialCategoryCode === undefined
    ? { to: '/reklamacije' as const }
    : { to: '/reklamacije/kategorija/$categoryCode' as const, params: { categoryCode: initialCategoryCode } }

  const leaveIfClean = (intent: 'exit' | 'kind'): void => {
    if (stepsRef.current?.isDirty()) { setConfirming(intent); return }
    intent === 'exit' ? void navigate(listTarget) : setStepIndex(0)
  }

  const handleSaved = (claim: { mrNumber: string | null; category: ClaimCategoryRef | null }): void => {
    showInternalToast(m.internal_toast_claim_saved_in_category({ mrNumber: claim.mrNumber ?? '—', category: claim.category?.name ?? '—' }))
    void (claim.category === null
      ? navigate({ to: '/reklamacije' })
      : navigate({ to: '/reklamacije/kategorija/$categoryCode', params: { categoryCode: claim.category.code } }))
  }

  const stepLabels = [m.claims_create_step_kind(), m.claims_create_step_basic(), m.claims_create_step_faults(), m.claims_create_step_review()]

  return (
    <div className="mri-fade-up mx-auto flex w-full max-w-[820px] flex-col gap-4">
      <header className="flex items-center gap-[14px]">
        <button type="button" onClick={() => leaveIfClean('exit')} className="text-xs font-bold uppercase tracking-[0.06em] text-mri-text2 hover:text-mri-text">← {m.emotive_claims_create_back_to_list()}</button>
        <div className="flex flex-col gap-[3px]">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-mri-red">{m.crumb_new_claim()}</p>
          <h1 className="text-[22px] font-black tracking-[-0.02em] text-mri-text">{step === null ? m.claims_create_step_kind_title() : STEP_TITLES[step]()}</h1>
        </div>
        <div className="ml-auto"><CategoryChip categories={categories} value={categoryId} onChange={setCategoryId} /></div>
      </header>

      <WizardStepper steps={stepLabels} currentIndex={stepIndex} />

      {step === null ? (
        <ClaimKindStep hasCategory={category !== undefined} canCreateEmotive={canCreateEmotive} canCreateDomace={canCreateDomace}
          onPick={(picked) => { setKind(picked); setStepIndex(1) }} />
      ) : kind === ClaimKind.Emotive ? (
        <EmotiveCreateSteps ref={stepsRef} step={step} categoryId={categoryId} categoryName={category?.name ?? ''} categoryFields={categoryFields} onSaved={handleSaved} />
      ) : (
        <DomaceCreateSteps ref={stepsRef} step={step} categoryId={categoryId} categoryName={category?.name ?? ''} categoryFields={categoryFields} onSaved={handleSaved} />
      )}

      {step === 'review' && category === undefined ? (
        <InternalNote tone="error" role="alert">{m.claims_create_category_missing()}</InternalNote>
      ) : null}

      {step !== null ? (
        <div className="flex gap-[10px]">
          <InternalButton type="button" variant="outline" className="h-[42px] w-auto px-[18px] text-xs" onClick={() => (stepIndex === 1 ? leaveIfClean('kind') : setStepIndex(stepIndex - 1))}>{m.emotive_claims_create_back()}</InternalButton>
          {step === 'review' ? (
            <InternalButton type="button" variant="green" className="ml-auto h-[42px] w-auto px-[22px] text-xs" disabled={category === undefined}
              onClick={() => void stepsRef.current?.submit()}>✓ {m.action_save()}</InternalButton>
          ) : (
            <InternalButton type="button" variant="primary" className="ml-auto h-[42px] w-auto px-[22px] text-xs"
              onClick={() => { if (stepsRef.current?.validateStep()) setStepIndex(stepIndex + 1) }}>{m.emotive_claims_create_next()}</InternalButton>
          )}
        </div>
      ) : null}

      <ConfirmDialog open={confirming !== null} onOpenChange={(open) => { if (!open) setConfirming(null) }}
        title={m.claims_create_leave_title()} description={m.claims_create_leave_description()} confirmLabel={m.claims_create_leave_confirm()}
        onConfirm={() => { const intent = confirming; setConfirming(null); intent === 'exit' ? void navigate(listTarget) : setStepIndex(0) }} />
    </div>
  )
}
```

(The buttons are NOT `type="submit"` — the old wizard's comment about the faults→review transition firing a submit still applies and now covers both kinds in one place.)

`apps/internal-web/src/routes/_shell/reklamacije/nova.tsx`:

```tsx
const NovaSearchSchema = z.object({
  kind: z.enum([ClaimKind.Emotive, ClaimKind.Domace]).optional(),
  categoryCode: z.string().trim().min(1).optional(),
})

export const Route = createFileRoute('/_shell/reklamacije/nova')({
  beforeLoad: internalRequireClaimsCreateAny(),
  validateSearch: (search) => NovaSearchSchema.parse(search),
  staticData: { crumb: m.crumb_new_claim, crumbResetsTrail: true },
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([prefetchClaimEditReferences(queryClient), queryClient.ensureQueryData(claimCategoryCountsOptions())])
  },
  component: NovaPage,
  pendingComponent: NovaPending,
})

function NovaPage(): React.ReactElement {
  const { kind, categoryCode } = Route.useSearch()
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []
  return (
    <Suspense fallback={<NovaPending />}>
      <ClaimCreateWizard initialKind={kind} initialCategoryCode={categoryCode}
        canCreateEmotive={permissions.includes('emotive_claims.create')} canCreateDomace={permissions.includes('domace_claims.create')} />
    </Suspense>
  )
}
```

`auth-guard.ts`: `export function internalRequireClaimsCreateAny() { return requirePermissions(authClient, ['emotive_claims.create', 'domace_claims.create'], loadServerSession) }`. Delete `emotive/nova.tsx`, `domace/nova.tsx` (and `internalRequireEmotiveClaimsCreate`/`internalRequireDomaceClaimsCreate` if nothing else uses them — grep). `command-registry.ts`: `PaletteActionItem.search: { kind: ClaimKind }`, both actions `to: '/reklamacije/nova'` with `search: { kind: ClaimKind.Emotive }` / `Domace`; `command-palette.tsx`: `goTo(to, search?)` and actions call `goTo(item.to, item.search)`. Delete `domace-claim-create-form.tsx` + its test only after Step 7 is green.

- [ ] **Step 7: i18n, run green, mutate**

Keys: `claims_create_step_kind` „VRSTA"/"KIND" · `claims_create_step_basic` „PODACI"/"DATA" · `claims_create_step_faults` „KVAROVI"/"FAULTS" · `claims_create_step_review` „PREGLED"/"REVIEW" · `claims_create_step_kind_title` „Izbor vrste"/"Choose the kind" · `claims_create_step_basic_title` „Osnovni podaci"/"Basic data" · `claims_create_step_faults_title` „Kvarovi"/"Faults" · `claims_create_step_review_title` „Pregled"/"Review" · `claims_create_kind_lead_with_category` „Kategorija je već izabrana — ostaje samo vrsta. Ona određuje koja se polja traže i da li klijent vidi reklamaciju."/"The category is chosen — only the kind remains. It decides which fields are asked and whether the client sees the claim." · `claims_create_kind_lead_without_category` „Izaberi vrstu, a kategoriju u zaglavlju."/"Choose the kind here and the category in the header." · `claims_create_kind_emotive_title` „Reklamacija stranog partnera"/"A foreign partner's claim" · `claims_create_kind_emotive_description` „Partner iz sistema · klijent prati status na portalu (Primljeno → U obradi → Ishod) · nalaz se piše na engleskom."/"Partner from the system · the client follows it on the portal (Received → In progress → Outcome) · the report is written in English." · `claims_create_kind_domace_title` „Domaća firma ili privatno lice"/"A domestic firm or a private person" · `claims_create_kind_domace_description` „Kupac se upisuje kao tekst · bez portala i objave · dodatno nosi brojeve računa i iznose (faktura, delovi, rad)."/"The customer is typed as text · no portal, no publishing · carries invoice numbers and amounts (invoice, parts, labour)." · `claims_create_kind_emotive_forbidden` „Nemaš dozvolu za unos EMOTIVE reklamacija."/"You may not enter EMOTIVE claims." · `claims_create_kind_domace_forbidden` „Nemaš dozvolu za unos domaćih reklamacija."/"You may not enter domestic claims." · `claims_create_category_chip_prefix` „KATEGORIJA:"/"CATEGORY:" · `claims_create_category_chip_pick` „IZABERI"/"PICK ONE" · `claims_create_category_missing` „Fali: kategorija. Izaberi je u zaglavlju."/"Missing: the category. Pick it in the header." · `claims_create_category_fields_title` „POLJA KATEGORIJE"/"CATEGORY FIELDS" · `claims_create_category_fields_hint` „Grupa polja koja pripada samo ovoj vrsti posla — vidljivo odvojena, da se zna da nije zajednička svima."/"Fields that belong to this kind of work only — set apart so nobody takes them for common ones." · `claims_create_leave_title` „Napustiti unos?"/"Leave the entry?" · `claims_create_leave_description` „Izgubićeš uneto."/"You will lose what you entered." · `claims_create_leave_confirm` „Napusti"/"Leave" · `claims_create_review_note_domace` „Reklamacija se otvara sa ishodom Na čekanju; domaća reklamacija se ne prikazuje na portalu."/"The claim opens with the outcome Pending; a domestic claim is not shown on the portal." · `internal_toast_claim_saved_in_category` „Reklamacija MR {mrNumber} sačuvana — {category}"/"Claim MR {mrNumber} saved — {category}". Build i18n.

`TZ=UTC pnpm --filter internal-web test` → PASS (after deleting the old form and its test). ⚙ as marked. Also run the intake wizard tests (they share `WizardStepper`).

- [ ] **Step 8: Full gate, commit**

```bash
git add packages apps
git commit -m "feat(internal): one way in for every claim — pick the kind, the category rides along, each kind keeps its own form"
```

---

### Task 8: The detail — merged with the prototype, both kinds

**Files:**
- Create: `packages/shared/src/utils/category-field-states.ts`, `packages/shared/src/utils/__tests__/category-field-states.test.ts`
- Create: `apps/internal-web/src/components/claim-category-chip.tsx`, `apps/internal-web/src/features/claims/detail/category-fields-card.tsx`, `claim-faults-summary-card.tsx`, `claim-attachments-preview-card.tsx`, `apps/internal-web/src/features/emotive-claims/detail/emotive-claim-client-visibility-card.tsx`
- Modify: `apps/internal-web/src/features/emotive-claims/detail/{emotive-claim-detail-header.tsx,emotive-claim-detail.tsx}`, `apps/internal-web/src/features/domace-claims/detail/{domace-claim-detail-header.tsx,domace-claim-detail.tsx}`, `apps/internal-web/src/routes/_shell/reklamacije/emotive/$id.tsx`, `domace/$id.tsx` (the `BackLink` reads `categoryCode`)
- Tests: create `apps/internal-web/src/components/__tests__/claim-category-chip.test.tsx`, `apps/internal-web/src/features/claims/detail/__tests__/category-fields-card.test.tsx`; extend the existing detail header/view tests under `apps/internal-web/src/features/emotive-claims/detail/__tests__/` and `domace-claims/detail/__tests__/`
- Modify: `packages/i18n/src/messages/sr.json`, `en.json`

**Interfaces:**
- Consumes: `ClaimCategoryRef.isActive/deactivatedAt` (Task 1), `claimCategoryFieldsForCategoryOptions`, `ClaimCategoryFieldListItem` (Task 2), `EmotiveClaimDetail.categoryFieldValues` (Task 3), `attachmentsListOptions`, `buildAttachmentThumbnailUrl` (existing).
- Produces: `resolveCategoryFieldStates(definitions, values, claimCreatedAt): CategoryFieldState[]` with `state: 'filled' | 'empty' | 'predates' | 'retired'` (Task 9 mirrors the bucket names).

- [ ] **Step 1: The resolver, test first**

`packages/shared/src/utils/__tests__/category-field-states.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { resolveCategoryFieldStates } from '../category-field-states.js'

const option = (code: string, name: string, isActive = true, deactivatedAt: string | null = null) =>
  ({ id: `o-${code}`, fieldId: 'f1', fieldName: 'Obrađeni deo', code, name, sortOrder: 0, isActive, deactivatedAt, createdAt: '2026-08-01T00:00:00.000Z', usageCount: 0 })
const field = (over: Partial<Parameters<typeof resolveCategoryFieldStates>[0][number]> = {}) => ({
  id: 'f1', categoryId: 'c', categoryName: 'Mašinska obrada', code: 'obradjeni_deo', name: 'Obrađeni deo', fieldType: 'select' as const,
  sortOrder: 0, isActive: true, deactivatedAt: null, createdAt: '2026-08-01T00:00:00.000Z', usageCount: 0,
  options: [option('glava', 'Glava'), option('karter', 'Karter', false, '2026-08-15T00:00:00.000Z')],
  ...over,
})

describe('resolveCategoryFieldStates', () => {
  it('filled: a live value of a live field', () => {
    expect(resolveCategoryFieldStates([field()], { obradjeni_deo: 'glava' }, '2026-08-10T00:00:00.000Z')).toEqual([
      expect.objectContaining({ code: 'obradjeni_deo', state: 'filled', value: 'Glava', retiredAt: null }),
    ])
  })
  it('empty: the claim came after the field and nobody filled it', () => {
    expect(resolveCategoryFieldStates([field()], {}, '2026-08-10T00:00:00.000Z')[0]).toMatchObject({ state: 'empty', value: null })
  })
  it('predates: the claim was entered before the field existed — not forgotten, never asked', () => {
    // ⚙ swap the comparison → RED
    expect(resolveCategoryFieldStates([field()], {}, '2026-07-10T00:00:00.000Z')[0]).toMatchObject({ state: 'predates', introducedAt: '2026-08-01T00:00:00.000Z' })
  })
  it('retired: a value whose option was switched off stays, labelled with the date', () => {
    expect(resolveCategoryFieldStates([field()], { obradjeni_deo: 'karter' }, '2026-08-10T00:00:00.000Z')[0]).toMatchObject({ state: 'retired', value: 'Karter', retiredAt: '2026-08-15T00:00:00.000Z' })
  })
  it('retired: a value whose FIELD was switched off stays too', () => {
    const retiredField = field({ isActive: false, deactivatedAt: '2026-08-20T00:00:00.000Z' })
    expect(resolveCategoryFieldStates([retiredField], { obradjeni_deo: 'glava' }, '2026-08-10T00:00:00.000Z')[0]).toMatchObject({ state: 'retired', retiredAt: '2026-08-20T00:00:00.000Z' })
  })
  it('says nothing about a retired field with no value', () => {
    expect(resolveCategoryFieldStates([field({ isActive: false })], {}, '2026-08-10T00:00:00.000Z')).toEqual([])
  })
  it('names a value the catalogue no longer knows by its code rather than hiding it', () => {
    expect(resolveCategoryFieldStates([field()], { obradjeni_deo: 'deklo' }, '2026-08-10T00:00:00.000Z')[0]).toMatchObject({ state: 'filled', value: 'deklo' })
  })
})
```

`packages/shared/src/utils/category-field-states.ts`:

```ts
import type { ClaimCategoryFieldListItem, ClaimCategoryFieldValues } from '../schemas/claim-category-field.schema.js'

export type CategoryFieldStateKind = 'filled' | 'empty' | 'predates' | 'retired'

export interface CategoryFieldState {
  fieldId: string
  code: string
  label: string
  state: CategoryFieldStateKind
  /** The option's NAME when known, else the raw code — a value is never hidden. */
  value: string | null
  /** When the field or the option was switched off — the "UKINUTO MM/YY" badge. */
  retiredAt: string | null
  /** When the field came to be — the "uvedeno posle unosa" note. */
  introducedAt: string
}

/**
 * The four honest things a detail can say about a category field (V2 spec §10). The fourth,
 * `predates`, is the one the owner asked for by name: a claim entered before its field existed
 * must not read as forgotten, and statistics must count it apart from "not filled".
 */
export function resolveCategoryFieldStates(
  definitions: readonly ClaimCategoryFieldListItem[],
  values: ClaimCategoryFieldValues,
  claimCreatedAt: string,
): CategoryFieldState[] {
  const states: CategoryFieldState[] = []
  const createdAt = Date.parse(claimCreatedAt)

  for (const field of definitions) {
    const raw = values[field.code]
    const option = raw === undefined ? undefined : (field.options ?? []).find((candidate) => candidate.code === raw)
    const base = { fieldId: field.id, code: field.code, label: field.name, introducedAt: field.createdAt }

    if (raw === undefined) {
      if (!field.isActive) {
        continue
      }
      const predates = createdAt < Date.parse(field.createdAt)
      states.push({ ...base, state: predates ? 'predates' : 'empty', value: null, retiredAt: null })
      continue
    }

    const retiredAt = !field.isActive ? field.deactivatedAt : (option !== undefined && !option.isActive ? option.deactivatedAt : null)
    states.push({
      ...base,
      state: retiredAt !== null || !field.isActive || (option !== undefined && !option.isActive) ? 'retired' : 'filled',
      value: option?.name ?? raw,
      retiredAt,
    })
  }

  return states
}
```

Export from `packages/shared/src/index.ts`. Run → PASS; ⚙ as marked.

- [ ] **Step 2: The chip and the cards**

`apps/internal-web/src/components/claim-category-chip.tsx` (prototype `dCatSt` + `KATEGORIJA UGAŠENA` badge):

```tsx
export function ClaimCategoryChip({ category, locale }: { category: ClaimCategoryRef | null; locale: string }): React.ReactElement | null {
  if (category === null) return null
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('rounded-[7px] border bg-mri-inbg px-[11px] py-[5px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-mri-text', category.isActive ? 'border-mri-border2' : 'border-dashed border-mri-border2')}>
        {category.name}
      </span>
      {category.isActive ? null : (
        <span className="rounded-md border border-dashed border-mri-border2 bg-mri-inbg px-[9px] py-1 font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-mri-text2">
          {m.claim_detail_category_retired({ date: formatMonthYear(category.deactivatedAt, locale) })}
        </span>
      )}
    </span>
  )
}
```

with `formatMonthYear(iso: string | null, locale: string): string` in `@mr/shared/utils/format-month-year.ts` → `new Intl.DateTimeFormat(locale, { month: '2-digit', year: '2-digit', timeZone: 'UTC' }).format(new Date(iso))` → `08/26` (tested; `''` when `null`).

`category-fields-card.tsx` — reads `useQuery(claimCategoryFieldsForCategoryOptions(claim.category.id))` (only when the claim has a category), resolves the states, renders NOTHING when the list is empty (never an empty dashed card), else the prototype's dashed card (`border-dashed border-mri-border2`, header „Polja kategorije" + mono category name, 3-column grid): `filled` → value; `empty` → italic „Nije popunjeno"; `predates` → muted „Uvedeno {date}, posle unosa"; `retired` → label with the dashed badge `UKINUTO {date}` and the value muted. Footer line (prototype): the three/four states sentence, `claim_detail_category_fields_footnote`.

`claim-faults-summary-card.tsx` — read-only, from `claim.faults` (the rows the Kvarovi tab edits): number · description · a pill with the blame target (`RADNIK · name`, `ODELJENJE · name`, `SPOLJNA FIRMA · name`; tones warn / domace / info), header „Kvarovi" with a small „Izmeni →" link that switches the tab (prop `onOpenFaults`). Rendered on Pregled for BOTH kinds; the tab stays.

`claim-attachments-preview-card.tsx` — `useQuery(attachmentsListOptions(kind, claimId))`, the first five image attachments as `<img src={buildAttachmentThumbnailUrl(id)}>` in a 3-column grid (aspect 4/3, rounded-lg, border), then a dashed `+` tile that switches to the Prilozi tab (prop `onOpenAttachments`); header „Prilozi"; nothing when the list is empty AND the user cannot upload (the `+` alone is enough otherwise).

`emotive-claim-client-visibility-card.tsx` — EMOTIVE only: three rows from `claim.createdAt` (Primljeno, green dot + date), `claim.clientVisibleAt` (U obradi, blue dot + date, muted when null), `claim.publishedAt` (Ishod — objavljen / nije objavljen, muted when null); below them the existing publish action (`EmotiveClaimStatusActions` already owns the publish mutation and its `ConfirmDialog` — render it here with `layout="inline"` and `canChangeOutcome={false}` so only the publish button appears; if that component cannot split the two, add a `showOutcomeActions` prop rather than a second mutation hook).

- [ ] **Step 3: Headers and the two-column Pregled**

Both headers (prototype top row): `← Nazad na listu` (route-level `BackLink` now builds its target from `Route.useSearch().categoryCode` — `/reklamacije/kategorija/$categoryCode` when present, `/reklamacije` otherwise — and reads `m.claims_detail_back_to_list()`), then the title row `MR 7167/25` (`font-mono text-[25px] font-bold tracking-[-0.01em]`) · `KindPill` · **`ClaimCategoryChip`** · `OutcomePill`; under it the mono sub line (`{claimNumber} · {customer} · primljeno {date} · zadužen {worker}` via `formatClaimDetailMetaLine`); the actions (`✓ Prihvati` / `Odbij`, the existing `EmotiveClaimStatusActions`/`DomaceClaimStatusActions` with `layout="inline"`) right-aligned in the same row — `h-[38px] px-4 text-[11.5px]` per the prototype. The edit pencil stays.

`emotive-claim-detail.tsx` Pregled tab:

```tsx
        <TabsContent value={ClaimDetailTab.Pregled}>
          <div className="grid grid-cols-1 items-start gap-4 @min-[900px]:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex flex-col gap-4">
              <EmotiveClaimBasicSection … />
              <CategoryFieldsCard claim={claim} />
              <EmotiveClaimFindingsSection … />
              <EmotiveClaimInspectionReportSection … />
              <ClaimFaultsSummaryCard faults={claim.faults} onOpenFaults={() => onTabChange(ClaimDetailTab.Kvarovi)} />
              <p className="font-mono text-[11px] tracking-[0.04em] text-mri-text2">{m.emotive_claims_detail_field_updated_at()}: {formatListDateTime(claim.updatedAt)}</p>
            </div>
            <div className="flex flex-col gap-4">
              <EmotiveClaimClientVisibilityCard claim={claim} canPublish={canPublish} />
              <ClaimAttachmentsPreviewCard kind={ClaimKind.Emotive} claimId={claim.id} onOpenAttachments={() => onTabChange(ClaimDetailTab.Prilozi)} />
            </div>
          </div>
        </TabsContent>
```

(the tab's wrapper gets `@container`; DOMAĆE: the same without the visibility card, `DomaceClaimAmountSection` stays where it is). Widen the detail routes' wrapper from `max-w-4xl` to `max-w-[1280px]` (`InternalPage` width `wide` if that component is in use there) so the two columns have room.

- [ ] **Step 4: Tests**

`claim-category-chip.test.tsx`: active → solid chip, no badge; inactive with `deactivatedAt: '2026-03-05T00:00:00.000Z'` → dashed chip + „KATEGORIJA UGAŠENA 03/26". `category-fields-card.test.tsx`: no definitions → renders nothing; the four states render their texts; the badge date. Header tests (both kinds): the chip sits in the title row; the back link targets the category list when the search carries `categoryCode`. Detail-view tests: the visibility card only for EMOTIVE; the faults summary lists the same rows as `claim.faults`; the attachments preview shows ≤5 thumbnails.

- [ ] **Step 5: i18n**

`claims_detail_back_to_list` „Nazad na listu"/"Back to the list" · `claim_detail_category_retired` „KATEGORIJA UGAŠENA {date}"/"CATEGORY RETIRED {date}" · `claim_detail_category_fields_title` „Polja kategorije"/"Category fields" · `claim_detail_category_field_empty` „Nije popunjeno"/"Not filled" · `claim_detail_category_field_predates` „Uvedeno {date}, posle unosa"/"Introduced {date}, after this claim" · `claim_detail_category_field_retired` „UKINUTO {date}"/"RETIRED {date}" · `claim_detail_category_fields_footnote` „Četiri stanja: popunjeno · nije popunjeno · uvedeno posle unosa · ukinuto (vrednost se čuva, statistika kaže nad čime broji)."/"Four states: filled · not filled · introduced after entry · retired (the value is kept; statistics say what they count)." · `claim_detail_faults_card_title` „Kvarovi"/"Faults" · `claim_detail_faults_card_edit` „Izmeni →"/"Edit →" · `claim_detail_faults_card_empty` „Nema pripisanih kvarova."/"No faults attributed." · `claim_detail_attachments_card_title` „Prilozi"/"Attachments" · `claim_detail_visibility_title` „Klijent vidi"/"Client sees" · `claim_detail_visibility_received` „Primljeno"/"Received" · `claim_detail_visibility_in_progress` „U obradi"/"In progress" · `claim_detail_visibility_published` „Ishod — objavljen"/"Outcome — published" · `claim_detail_visibility_unpublished` „Ishod — nije objavljen"/"Outcome — not published". Build i18n.

- [ ] **Step 6: Full gate, commit**

```bash
git add packages apps
git commit -m "feat(internal): the detail says what kind of work a claim is, and what its category's fields say — even when they were retired"
```

---

### Task 9: Statistics — by the fields of the chosen category

**Files:**
- Modify: `packages/shared/src/constants/statistics-rank-colors.ts`, `packages/shared/src/schemas/statistics.schema.ts`, `packages/shared/src/schemas/__tests__/statistics.schema.test.ts`
- Modify: `apps/api/src/modules/statistics/statistics.repository.ts`, `statistics.service.ts`, `apps/api/src/modules/statistics/__tests__/statistics.integration.test.ts`
- Modify: `apps/internal-web/src/features/statistika/analytics/{statistics-breakdown-charts.tsx,statistics-analytics-charts.tsx,chart-theme.ts}`, `apps/internal-web/src/features/statistika/analytics/__tests__/statistics-breakdown-charts.test.tsx`
- Modify: `packages/i18n/src/messages/sr.json`, `en.json`

**Interfaces:**
- Consumes: `buildActiveClaimWhere` (category filter already inside it), `StatisticsQueryContext.categoryCode`, `BreakdownRankCard` (internal to the charts file), `STATISTICS_MONO_GRADIENTS.teal`.
- Produces: `StatisticsSummary.byCategoryFields: StatisticsCategoryField[] | null`, `STATISTICS_FIELD_UNFILLED_CODE`, `STATISTICS_FIELD_PREDATES_CODE`.

- [ ] **Step 1: Shared**

`statistics-rank-colors.ts`: `export const STATISTICS_FIELD_UNFILLED_CODE = '__UNFILLED__'`, `export const STATISTICS_FIELD_PREDATES_CODE = '__PREDATES__'` (UI roll-up buckets, like `OTHERS`). `statistics.schema.ts`:

```ts
export const StatisticsCategoryFieldBucketSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  total: z.coerce.number().int().nonnegative(),
  /** false for a retired option that still has claims — named with † on the chart. */
  isActive: z.boolean(),
})
export const StatisticsCategoryFieldSchema = z.object({
  fieldId: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  isActive: z.boolean(),
  items: z.array(StatisticsCategoryFieldBucketSchema),
})
export type StatisticsCategoryField = z.infer<typeof StatisticsCategoryFieldSchema>
```

and on `StatisticsSummarySchema`: `/** null unless a category is filtered — fields of different categories must not be mixed. */ byCategoryFields: z.array(StatisticsCategoryFieldSchema).nullable(),`. Fixtures in the schema test gain `byCategoryFields: null` (and one case with a populated array).

- [ ] **Step 2: Failing integration tests**

In `statistics.integration.test.ts`, beside the category suite (`setClaimCategory` helper exists there; add `setClaimCategoryFieldValues(claimId, values)` that updates `categoryFieldValues` on `emotiveClaims`):

```ts
    it('is null without a category filter, and counts options, unfilled and pre-field claims with one', async () => {
      const manufacturerId = await createEngineManufacturer(`STAT-FLD-${Date.now()}`, 'Field Stats')
      const a = await createEmotiveClaim('STAT-FLD-1/26', ClaimOutcome.Accepted, daysAgo(10), manufacturerId)
      const b = await createEmotiveClaim('STAT-FLD-2/26', ClaimOutcome.Pending, daysAgo(9), manufacturerId)
      const c = await createEmotiveClaim('STAT-FLD-3/26', ClaimOutcome.Pending, daysAgo(8), manufacturerId)
      for (const id of [a, b, c]) await setClaimCategory(id, 'MASINSKA_OBRADA')
      await setClaimCategoryFieldValues(a, { obradjeni_deo: 'glava' })
      // c was "entered" before the field existed
      await ctx.db.update(schema.emotiveClaims).set({ createdAt: new Date('2020-01-01') }).where(eq(schema.emotiveClaims.id, c))

      const without = await container.statisticsService.getSummary(FULL_STATISTICS, { manufacturerId })
      expect(without.byCategoryFields).toBeNull()

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS, { manufacturerId, categoryCode: 'MASINSKA_OBRADA' })
      const field = summary.byCategoryFields?.find((f) => f.code === 'obradjeni_deo')
      expect(field?.items).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'glava', total: 1 }),
        expect.objectContaining({ code: STATISTICS_FIELD_UNFILLED_CODE, total: 1 }),
        expect.objectContaining({ code: STATISTICS_FIELD_PREDATES_CODE, total: 1 }),
      ]))
    })

    it('respects the period like every other section — ⚙ the filter lives in buildActiveClaimWhere', async () => {
      const manufacturerId = await createEngineManufacturer(`STAT-FLD-YR-${Date.now()}`, 'Field Year')
      const old = await createEmotiveClaim('STAT-FLD-OLD/26', ClaimOutcome.Accepted, dateInYear(2019, 3, 3), manufacturerId)
      await setClaimCategory(old, 'MASINSKA_OBRADA')
      await setClaimCategoryFieldValues(old, { obradjeni_deo: 'blok' })
      const summary = await container.statisticsService.getSummary(FULL_STATISTICS, { manufacturerId, categoryCode: 'MASINSKA_OBRADA', year: 2026 })
      expect(summary.byCategoryFields?.[0]?.items.some((i) => i.code === 'blok')).toBe(false)
    })

    it('names a retired option that still has claims, and marks it inactive', async () => {
      … switch off 'radilica' via container.claimCategoryFieldOptionsRepository.update, set it on a claim (direct SQL, not the service), expect { code: 'radilica', isActive: false, total: 1 } …
    })
```

- [ ] **Step 3: The query**

`statistics.repository.ts`:

```ts
interface CategoryFieldBucketRow extends Record<string, unknown> {
  field_id: string
  field_code: string
  field_name: string
  field_is_active: boolean
  field_sort_order: number | string
  bucket: string
  option_name: string | null
  option_is_active: boolean | null
  total: number | string
}

  /**
   * Only with a category filter: the fields of THAT category, each bucketed by option, plus
   * "unfilled" and "predates" (claim created before the field). The UNION below is the same
   * scope and period filter every other section uses, so the category is already in it.
   */
  async fetchByCategoryFields(ctx: StatisticsQueryContext): Promise<StatisticsCategoryField[] | null> {
    if (ctx.categoryCode === undefined) {
      return null
    }
    const branches: SQL[] = []
    if (ctx.effectiveScope.includeEmotive) {
      branches.push(sql`SELECT ec.created_at, ec.category_field_values FROM emotive_claims ec WHERE ${buildActiveClaimWhere('ec', ctx)}`)
    }
    if (ctx.effectiveScope.includeDomace) {
      branches.push(sql`SELECT dc.created_at, dc.category_field_values FROM domace_claims dc WHERE ${buildActiveClaimWhere('dc', ctx)}`)
    }
    if (branches.length === 0) {
      return []
    }
    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<CategoryFieldBucketRow>(sql`
      WITH c AS (${unionSql}),
      buckets AS (
        SELECT f.id AS field_id, f.code AS field_code, f.name AS field_name, f.is_active AS field_is_active, f.sort_order AS field_sort_order,
          CASE
            WHEN c.category_field_values ? f.code THEN c.category_field_values ->> f.code
            WHEN c.created_at < f.created_at THEN ${STATISTICS_FIELD_PREDATES_CODE}
            ELSE ${STATISTICS_FIELD_UNFILLED_CODE}
          END AS bucket
        FROM claim_category_fields f
        CROSS JOIN c
        WHERE f.deleted_at IS NULL
          AND f.category_id = (SELECT id FROM claim_categories WHERE code = ${ctx.categoryCode} AND deleted_at IS NULL)
      )
      SELECT b.field_id, b.field_code, b.field_name, b.field_is_active, b.field_sort_order, b.bucket,
        MAX(o.name) AS option_name, BOOL_OR(o.is_active) AS option_is_active,
        COUNT(*)::int AS total
      FROM buckets b
      LEFT JOIN claim_category_field_options o ON o.field_id = b.field_id AND o.code = b.bucket AND o.deleted_at IS NULL
      GROUP BY b.field_id, b.field_code, b.field_name, b.field_is_active, b.field_sort_order, b.bucket
      ORDER BY b.field_sort_order ASC, total DESC
    `)

    const fields = new Map<string, StatisticsCategoryField>()
    for (const row of result.rows) {
      const field = fields.get(row.field_id) ?? { fieldId: row.field_id, code: row.field_code, name: row.field_name, isActive: row.field_is_active, items: [] }
      field.items.push({
        code: row.bucket,
        // A bucket the catalogue no longer names is shown by its code — never hidden.
        name: row.option_name ?? row.bucket,
        total: toInt(row.total),
        isActive: row.option_is_active ?? true,
      })
      fields.set(row.field_id, field)
    }
    return [...fields.values()]
  }
```

`statistics.service.ts`: add `this.repo.fetchByCategoryFields(queryContext)` to the `Promise.all` and `byCategoryFields` to the result. ⚙ as marked in the tests: move the period condition out of `buildActiveClaimWhere` for this section only (e.g. call a where without the period) → the period test goes RED; restore.

- [ ] **Step 4: The chart**

`chart-theme.ts` — reuse `STATISTICS_MONO_GRADIENTS.teal`. `statistics-breakdown-charts.tsx` — prop `byCategoryFields: StatisticsCategoryField[] | null`; when non-null and any field has items, a section „Po poljima kategorije" with one `BreakdownRankCard` per field (`prefix={`field-${field.code}`}`, `rollupOthers={false}`), items mapped to `StatisticsRankRow`: option buckets → `{ code, name: isActive ? name : `${name} †`, total }`; `STATISTICS_FIELD_UNFILLED_CODE` → `m.statistika_analytics_field_unfilled()`; `STATISTICS_FIELD_PREDATES_CODE` → `m.statistika_analytics_field_predates()`. `statistics-analytics-charts.tsx` passes `summary.byCategoryFields`. Test: the section is absent for `null`, present with two cards for two fields, the † suffix for an inactive bucket.

i18n: `statistika_analytics_fields_section_title` „Po poljima kategorije"/"By category fields" · `statistika_analytics_fields_section_description` „Vrednosti polja izabrane kategorije (bez arhiviranih). Ukinute vrednosti nose †."/"Values of the chosen category's fields (archived excluded). Retired values carry †." · `statistika_analytics_field_unfilled` „Nije popunjeno"/"Not filled" · `statistika_analytics_field_predates` „Pre uvođenja polja"/"Before the field existed". Build i18n.

- [ ] **Step 5: Full gate, commit**

```bash
git add packages apps
git commit -m "feat(statistics): a chosen kind of work is counted by its own fields, honestly about what was never asked"
```

---

### Task 10: The walk, the docs, the review

**Files:**
- Modify: `docs/04-*.md` (the "Separate detail routes per claim kind" section), `CLAUDE.md` (§2, §5, §9), memory.
- Create (scratchpad only): screenshots under `/private/tmp/claude-501/-Users-nikola-Developer/<session>/scratchpad/v2-screens/`.

- [ ] **Step 1: Browser walk (Playwright, `TZ=UTC`, throwaway admin via `pnpm create-admin`, then delete it)**

Against the running dev servers (Nikola's — never start or stop them), drive `http://localhost:3002` at 1440×900 and 1024×768, SR and EN, dark and light, and capture: the sidebar open with the group, the rail with its flyout, `/reklamacije`, `/reklamacije/kategorija/MASINSKA_OBRADA`, the category empty state (a freshly added category), the filter-empty state, the wizard's four steps for both kinds (with „Obrađeni deo" on machining), the detail of a machining claim with a filled field, the detail of a claim whose category was retired (retire one from admin `:3001`, then restore it), the statistics screen filtered to machining. Compare every screen against the served prototype side by side — measure, don't eyeball (memory: values are read from the prototype). Fix what differs before going on.

- [ ] **Step 2: `docs/04` sentence**

Under "### 1. Separate detail routes per claim kind", after "**Never** build a shared `ClaimDetail` component that branches on `kind`.":

> The create wizard (`features/claims/create/claim-create-wizard.tsx`) is a **shell** — kind step, stepper, category chip, buttons — over two kind-specific step sets with their own forms, schemas and endpoints (`emotive-create-steps.tsx`, `domace-create-steps.tsx`). That is the "layout shell" this rule allows to be shared; the forms themselves stay separate.

- [ ] **Step 3: CLAUDE.md**

§2: extend the category invariant with the V2 facts — fields are a catalogue (`claim_category_fields`/`_options`), values are jsonb keyed by code on the claim row, the server validates them (`assertCategoryFieldValues`, keep-vs-move), four detail states including `predates`, the counts endpoint and its scope, the category route carries the code, the wizard is a shell over two forms. §5: delete the "two menu entries on one route" paragraph (the situation no longer exists) and add one line: category routes are path-based precisely so two entries never share a route. §9: a dated entry summarising V2 (what shipped, the filter-fix found on the way, the breadcrumb mechanism, what is deliberately not done: nested option editing, field types beyond select, required fields, Excel/portal values).

- [ ] **Step 4: Final review of the branch against spec §3**

Walk `git diff main...HEAD` with the quality bar as the checklist: grep for `MASINSKA_OBRADA`/`obradjeni_deo` outside the portal constants, migration SQL and tests (there must be none in internal-web); `any`, `!`, `console.log`, TODO; files over 500 lines; a `useEffect` that derives state it could compute; a query issued per row. Fix in the branch; record each finding and its ruling in `.superpowers/sdd/<date>-claims-by-category-v2/progress.md`.

- [ ] **Step 5: Gate, commit, push**

```bash
git add docs CLAUDE.md
git commit -m "docs: V2 of claims by category is on the branch — what changed, what the walk showed, and the rule the wizard keeps"
git push
```

Then tell Nikola: merge `feat/claim-category` → `main` deploys it (migrations `0045` + `0046` run in `db:migrate:deploy`), and one `pnpm --filter @mr/db run db:seed` in the api Console follows for `settings.claim_categories.manage` (from Faza 1; V2 adds no permission).
