# Claim category (Faza 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every claim — EMOTIVE and DOMAĆE — one category chosen from an admin-editable catalog, so the firm can finally filter and count claims by the kind of work they are about, and so "Mašinska obrada" stops being a screen that says it is coming.

**Architecture:** One new catalog table shaped exactly like `engine_manufacturers`, one nullable FK column on each of the two claim tables, and nothing else. The category is data, never control flow: no screen branches on it, the filter is one condition per UNION branch in the claims list and one condition in `buildActiveClaimWhere` for the whole statistics module. The new API module is the existing catalog template with the names substituted.

**Tech Stack:** Drizzle + PostgreSQL · Hono · Zod in `@mr/shared` · TanStack Start/Query/Router · Paraglide · Vitest (unit + real-Postgres integration).

**Spec:** `docs/superpowers/specs/2026-08-17-claim-category-faza-1-design.md` (approved 2026-08-20, §10)

## Global Constraints

- **Changeability is a requirement of this phase (spec §10.3).** The category is a catalog row and never a TypeScript `enum`. **No screen, service or repository may branch on a category value** — `if (category === 'MASINSKA_OBRADA')` is a review-blocking defect. No machinery for hypothetical future categories (no per-category form config, no dynamic columns).
- **The column is NULL-able in the database and required by Zod on input** (spec §3.2). The database must accept the rows that already exist; the server is the judge for new input.
- **Filter by `code`, never by `id`** in URLs and query params (spec §4.2). The repository resolves the code with a semi-join; an unknown code returns an empty list, never an error.
- Every user string through Paraglide `m.*`, keys in BOTH `sr.json` and `en.json`. **No ICU plurals.** After editing messages: `pnpm --filter @mr/i18n run compile` for dev and `pnpm --filter @mr/i18n run build` before typecheck — a NEW key typechecks red until the package is built.
- **Migrations:** generated with `drizzle-kit`, never hand-written DDL. Data statements (the four rows + the backfill) are appended to the generated file by hand — precedent: `0034_bouncy_ben_parker` seeds `SKLAPANJE` itself. Forward-only: a correction is a new migration.
- Soft deletes only (`deleted_at`); repositories filter `deleted_at IS NULL` by default.
- Every state change writes audit in the **service** layer.
- Full gate green before every commit, split, under `TZ=UTC`:
  ```bash
  pnpm format:check \
    && TZ=UTC pnpm exec turbo run build typecheck lint --force --concurrency=4 \
    && TZ=UTC pnpm exec turbo run test --force --concurrency=2 \
    && pnpm --filter api depcruise && TZ=UTC pnpm test:integration
  ```
- Every bug fix and every rule with an edge ships a regression test, and **the test is seen red first** (break the line it covers, watch it fail, restore).

---

### Task 1: Migration `0045` — catalog table, two columns, four rows, backfill

**Files:**

- Modify: `packages/db/src/schema/catalogs.ts` (add `claimCategories` beside `engineManufacturers`)
- Modify: `packages/db/src/schema/claims.ts` (add `categoryId` to `emotiveClaims` ~line 29-120 and `domaceClaims` ~line 215-300)
- Create: `packages/db/migrations/0045_<generated_name>.sql`
- Modify: `packages/db/migrations/meta/_journal.json` (written by drizzle-kit)
- Test: `packages/db/src/__tests__/integration/claim-categories.integration.test.ts`

**Interfaces:**

- Produces: `schema.claimCategories` (`id, code, name, sortOrder, isActive, createdAt, updatedAt, deletedAt`), `schema.emotiveClaims.categoryId`, `schema.domaceClaims.categoryId` — all consumed from Task 2 onward.

- [ ] **Step 1: Add the catalog table to the schema**

In `packages/db/src/schema/catalogs.ts`, beside the other catalogs:

```ts
/**
 * What kind of work the claim is about: general overhaul, machining, new parts, car service.
 *
 * A catalog rather than an enum on purpose (spec §10.3): a fifth category is a row Nikola adds
 * from the admin panel, with no deploy and no migration. Nothing in the code may branch on a
 * value in this table.
 */
export const claimCategories = pgTable(
  'claim_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [uniqueIndex('claim_categories_code_key').on(t.code)],
)
```

- [ ] **Step 2: Add the column to both claim tables**

In `packages/db/src/schema/claims.ts`, in the column block of **both** `emotiveClaims` and `domaceClaims`:

```ts
    // NULL-able in the database so the rows that predate this column survive; required by Zod on
    // input. The migration backfills every existing row to REMONT_MOTORA (spec §10.1).
    categoryId: uuid('category_id'),
```

and in the table's second argument, for each table (substitute `emotive`/`domace`):

```ts
    foreignKey({
      name: 'emotive_claims_category_id_fkey',
      columns: [t.categoryId],
      foreignColumns: [claimCategories.id],
    }).onDelete('restrict'),
    index('idx_emotive_claims_category_id').on(t.categoryId),
```

`ON DELETE RESTRICT` is what makes "a category in use cannot be hard-deleted" true in the database and not only in a service check. The index is not optional: Drizzle creates no index for a foreign key, and this column becomes a `WHERE` and a `GROUP BY` in both the list and every statistics section.

Import `claimCategories` in `claims.ts` and export the table from `packages/db/src/schema/index.ts` if that file lists tables explicitly.

- [ ] **Step 3: Generate the migration**

Run: `pnpm --filter @mr/db run db:generate`
Expected: a new `0045_*.sql` containing `CREATE TABLE "claim_categories"`, two `ALTER TABLE … ADD COLUMN "category_id"`, two `ADD CONSTRAINT … FOREIGN KEY`, one unique index and two indexes. **Read the file before doing anything else** — if it contains a statement you did not intend (a drop, a rename, an unrelated table), stop and report; it means the schema and the migration ledger disagree.

- [ ] **Step 4: Append the four rows and the backfill to the generated file**

At the end of `0045_*.sql`, by hand (this is data, `drizzle-kit` cannot generate it):

```sql
--> statement-breakpoint
INSERT INTO "claim_categories" ("code", "name", "sort_order") VALUES
  ('REMONT_MOTORA', 'Generalni remont motora', 10),
  ('MASINSKA_OBRADA', 'Mašinska obrada', 20),
  ('NOVI_DELOVI', 'Novi delovi', 30),
  ('AUTO_SERVIS', 'Auto-servis', 40)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
UPDATE "emotive_claims"
SET "category_id" = (SELECT "id" FROM "claim_categories" WHERE "code" = 'REMONT_MOTORA')
WHERE "category_id" IS NULL;
--> statement-breakpoint
UPDATE "domace_claims"
SET "category_id" = (SELECT "id" FROM "claim_categories" WHERE "code" = 'REMONT_MOTORA')
WHERE "category_id" IS NULL;
```

The backfill is written `WHERE "category_id" IS NULL` — never against a counted set of rows. Production holds more claims than the 134 the spec measured in August (spec §10.1).

- [ ] **Step 5: Write the failing test**

`packages/db/src/__tests__/integration/claim-categories.integration.test.ts`:

```ts
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { getIntegrationDb } from '../../test-helpers/integration-db.js'

describe('migration 0045 — claim categories', () => {
  it('ships the four categories the meeting agreed on, in order', async () => {
    const db = getIntegrationDb()

    const result = await db.execute<{ code: string; name: string; sort_order: number }>(
      sql`SELECT code, name, sort_order FROM claim_categories ORDER BY sort_order`,
    )

    expect(result.rows.map((row) => row.code)).toEqual([
      'REMONT_MOTORA',
      'MASINSKA_OBRADA',
      'NOVI_DELOVI',
      'AUTO_SERVIS',
    ])
  })

  it('refuses to delete a category a claim still points at', async () => {
    const db = getIntegrationDb()

    const category = await db.execute<{ id: string }>(
      sql`SELECT id FROM claim_categories WHERE code = 'REMONT_MOTORA'`,
    )
    const categoryId = category.rows[0]?.id

    await expect(
      db.execute(sql`DELETE FROM claim_categories WHERE id = ${categoryId}`),
    ).rejects.toThrow()
  })
})
```

The second test needs at least one claim pointing at that category; seed one with the suite's existing claim helper (see `packages/db/src/test-helpers/`) or reuse a demo-seeded claim — the integration global setup runs both system and demo seeds.

- [ ] **Step 6: Run the test to verify it fails**

Run: `TZ=UTC pnpm --filter @mr/db test:integration -- claim-categories`
Expected: FAIL — the table does not exist yet in the test database (the migration has not been applied to it).

- [ ] **Step 7: Prove migrate-from-zero, then run the test green**

Run: `TZ=UTC pnpm test:integration`
The integration global setup migrates `mr_reklamacije_test` from zero, so a green run **is** the proof that the chain `0000..0045` applies to an empty database. Expected: PASS, including the two new tests.

- [ ] **Step 8: Verify the backfill against data that predates the column**

The test database is built from zero, so it never exercises the `UPDATE`. Check it against the dev database, which holds demo claims created before this migration:

```bash
pnpm --filter @mr/db run db:migrate
docker exec -it mr-reklamacije-postgres psql -U mr -d mr_reklamacije -c \
  "SELECT (SELECT COUNT(*) FROM emotive_claims WHERE category_id IS NULL) AS emotive_null,
          (SELECT COUNT(*) FROM domace_claims WHERE category_id IS NULL) AS domace_null;"
```

Expected: both counts `0`. If either is non-zero the backfill's `WHERE` or the sub-select is wrong — fix it in a new migration, never by editing `0045` after it has been applied.

- [ ] **Step 9: Commit**

```bash
git add packages/db
git commit -m "feat(db): claims get a category, and every existing one is a general overhaul"
```

---

### Task 2: `@mr/shared` — schemas, query factory, resource key

**Files:**

- Modify: `packages/shared/src/schemas/reference-data.schema.ts` (add beside `EngineManufacturer*`, ~line 128-158)
- Modify: `packages/shared/src/queries/reference-data.ts` (add beside `claimSourcesReferenceOptions`, ~line 93)
- Modify: `packages/shared/src/queries/index.ts` (export the two new functions)
- Modify: `packages/shared/src/constants/resource-events.ts` (add `ClaimCategories: 'claimCategories'`)
- Modify: `packages/shared/src/constants/resource-query-map.ts` (map the new key to `['claim-categories']`)
- Test: none of its own — Task 3's integration tests consume these; type errors are the check here.

**Interfaces:**

- Produces: `ClaimCategoryListItem { id, code, name, sortOrder, isActive, usageCount }`, `ClaimCategoryCreateInput { code, name, sortOrder? }`, `ClaimCategoryUpdateInput { name?, sortOrder?, isActive? }`, `claimCategoriesReferenceOptions(filters?)`, `claimCategoriesReferenceQueryKey(filters?)`, `ResourceChangedKey.ClaimCategories`.

- [ ] **Step 1: Add the three schemas**

In `packages/shared/src/schemas/reference-data.schema.ts`, copying the shape of `EngineManufacturerListItemSchema` / `CreateInputSchema` / `UpdateInputSchema` exactly (same field names, same limits):

```ts
export const ClaimCategoryListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  usageCount: z.number().int().nonnegative(),
})

export type ClaimCategoryListItem = z.infer<typeof ClaimCategoryListItemSchema>

export const ClaimCategoryCreateInputSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
})

export type ClaimCategoryCreateInput = z.infer<typeof ClaimCategoryCreateInputSchema>

export const ClaimCategoryUpdateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type ClaimCategoryUpdateInput = z.infer<typeof ClaimCategoryUpdateInputSchema>
```

There is deliberately **no `name_en`** (spec §4.1): nothing bilingual reads this catalog in Faza 1, and a second name would be typed by every admin from today and read by nobody.

- [ ] **Step 2: Add the query factory**

In `packages/shared/src/queries/reference-data.ts`, beside `claimSourcesReferenceOptions`:

```ts
export function claimCategoriesReferenceQueryKey(
  filters: ReferenceLookupFilters = {},
): readonly ['claim-categories', 'reference', ReferenceLookupFilters] {
  return ['claim-categories', 'reference', normalizeReferenceLookupFilters(filters)] as const
}

export function claimCategoriesReferenceOptions(filters: ReferenceLookupFilters = {}) {
  const normalized = normalizeReferenceLookupFilters(filters)
  return queryOptions({
    queryKey: claimCategoriesReferenceQueryKey(normalized),
    queryFn: () =>
      fetchAllReferencePages<ClaimCategoryListItem>('/api/claim-categories', {
        activeOnly: normalized.activeOnly ?? true,
        search: normalized.search,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}
```

Export both from `packages/shared/src/queries/index.ts` next to the `claimSources*` exports.

- [ ] **Step 3: Register the SSE resource key**

`packages/shared/src/constants/resource-events.ts`: add `ClaimCategories: 'claimCategories',` to `ResourceChangedKey`.
`packages/shared/src/constants/resource-query-map.ts`: add the `case ResourceChangedKey.ClaimCategories:` branch returning the `['claim-categories']` prefix, in the same shape as `ResourceChangedKey.ClaimSources` at line 27.

- [ ] **Step 4: Build and typecheck**

Run: `TZ=UTC pnpm exec turbo run build typecheck --filter=@mr/shared --force`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): the category catalog gets its schemas, its query and its event key"
```

---

### Task 3: API module `claim-categories` + the permission that guards it

**Files:**

- Create: `apps/api/src/modules/claim-categories/claim-categories.schema.ts`
- Create: `apps/api/src/modules/claim-categories/claim-categories.validators.ts`
- Create: `apps/api/src/modules/claim-categories/claim-categories.repository.ts`
- Create: `apps/api/src/modules/claim-categories/claim-categories.service.ts`
- Create: `apps/api/src/modules/claim-categories/claim-categories.controller.ts`
- Create: `apps/api/src/modules/claim-categories/claim-categories.routes.ts`
- Create: `apps/api/src/modules/claim-categories/index.ts`
- Modify: `apps/api/src/core/container.ts` (repository + service, constructor-injected like `engineManufacturers*` at lines 219-224 and the export list at ~439)
- Modify: `apps/api/src/app.ts` (import + `registerClaimCategoriesRoutes(app, container)` beside line 145)
- Modify: `packages/shared/src/permissions.ts` (add `'settings.claim_categories.manage'`; **not** in `OPERATOR_PERMISSIONS`)
- Modify: `packages/db/src/seed/permission-labels.ts` (human label for the roles screen)
- Modify: `packages/db/src/seed/standard-roles.ts` (add the action to the `catalogs_claims` package)
- Test: `apps/api/src/modules/claim-categories/__tests__/claim-categories.integration.test.ts`

**Interfaces:**

- Consumes: `ClaimCategory*` schemas and `ResourceChangedKey.ClaimCategories` from Task 2; `schema.claimCategories` from Task 1.
- Produces: `GET|POST /api/claim-categories`, `PATCH|DELETE /api/claim-categories/:id`; `container.claimCategoriesService`; permission `settings.claim_categories.manage`.

- [ ] **Step 1: Copy the catalog template**

Every file is the `engine-manufacturers` module with the names substituted. Read `apps/api/src/modules/engine-manufacturers/*` and apply:

| engine-manufacturers | claim-categories |
| --- | --- |
| `engineManufacturers` (schema export) | `claimCategories` |
| `EngineManufacturer*` (types) | `ClaimCategory*` |
| `engine_manufacturer` (audit `entityType`) | `claim_category` |
| `ResourceChangedKey.EngineManufacturers` | `ResourceChangedKey.ClaimCategories` |
| `/api/engine-manufacturers` | `/api/claim-categories` |

Two deliberate differences:

1. **No `catalog_added` notification.** Drop the `notifications.notifyCatalogAdded` call and the `NotificationsPort` constructor parameter. That notification exists for the three catalogs an operator hits mid-entry (customers, engine types, manufacturers); categories are seeded once and a fifth is added on purpose from the admin panel (spec §4.5).
2. **The usage count spans both claim tables through the new column:**

```ts
const categoryUsageCountSql = sql<number>`(
  COALESCE((
    SELECT COUNT(*)::int
    FROM emotive_claims
    WHERE emotive_claims.category_id = claim_categories.id
      AND emotive_claims.deleted_at IS NULL
  ), 0)
  + COALESCE((
    SELECT COUNT(*)::int
    FROM domace_claims
    WHERE domace_claims.category_id = claim_categories.id
      AND domace_claims.deleted_at IS NULL
  ), 0)
)`.mapWith(Number)
```

- [ ] **Step 2: Write the routes with the right permission spread**

`claim-categories.routes.ts` — reading the catalog is allowed to everyone who already reads claims (the list filter and both forms need it); mutating it is admin-only:

```ts
  routes.get(
    '/',
    // Anyone who may see or enter a claim needs to read this catalog — the filter and both
    // create forms are built from it. Mutations below stay settings-gated.
    requirePermissions(
      'emotive_claims.view',
      'domace_claims.view',
      'emotive_claims.create',
      'emotive_claims.update',
      'domace_claims.create',
      'domace_claims.update',
      'settings.claim_categories.manage',
    ),
    controller.list,
  )
  routes.post('/', requirePermission('settings.claim_categories.manage'), controller.create)
  routes.patch('/:id', requirePermission('settings.claim_categories.manage'), controller.update)
  routes.delete('/:id', requirePermission('settings.claim_categories.manage'), controller.delete)

  app.route('/api/claim-categories', routes)
```

- [ ] **Step 3: Add the permission, its label and its package**

`packages/shared/src/permissions.ts`: add `'settings.claim_categories.manage'` beside the other `settings.*` entries (~line 130). **Do not** add it to `OPERATOR_PERMISSIONS` — the newest catalogs are deliberately outside it (spec §4.4).

`packages/db/src/seed/permission-labels.ts`: add the human sentence the roles screen prints, in the voice of the existing labels — e.g. `'settings.claim_categories.manage': 'Uređuje kategorije reklamacija'`.

`packages/db/src/seed/standard-roles.ts`: add the action to the `catalogs_claims` package, so the standard privilege set that owns claim catalogs carries it.

⚠ `packages/shared/src/__tests__/permission-enforcement.test.ts` fails if a permission in the catalog is never checked anywhere. The routes in Step 2 are what satisfy it — add the permission and the routes **in the same commit**, never separately.

- [ ] **Step 4: Write the failing integration test**

`apps/api/src/modules/claim-categories/__tests__/claim-categories.integration.test.ts`, following the shape of the engine-manufacturers suite (seed permissions before roles — see the isolation note in CLAUDE.md §8):

```ts
it('lists the seeded categories to a user who may only view claims', async () => {
  const res = await request(app, '/api/claim-categories', { as: claimViewer })

  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body.items.map((item: { code: string }) => item.code)).toContain('MASINSKA_OBRADA')
})

it('refuses to create a category to someone without settings.claim_categories.manage', async () => {
  const res = await request(app, '/api/claim-categories', {
    as: claimViewer,
    method: 'POST',
    body: { code: 'BALANSIRANJE', name: 'Balansiranje' },
  })

  expect(res.status).toBe(403)
})

it('refuses to hard-delete a category a claim points at', async () => {
  const res = await request(app, `/api/claim-categories/${remontCategoryId}`, {
    as: admin,
    method: 'DELETE',
  })

  expect(res.status).toBe(409)
})
```

- [ ] **Step 5: Run it and watch it fail**

Run: `TZ=UTC pnpm --filter api test:integration -- claim-categories`
Expected: FAIL — 404 on every route, because nothing is registered yet.

- [ ] **Step 6: Wire the container and the app, then run it green**

`container.ts`: construct `ClaimCategoriesRepository(db)` and `ClaimCategoriesService(repo, audit, eventBus)` exactly where the engine-manufacturers pair is built, and add both to the container's type and returned object.
`app.ts`: import from `./modules/claim-categories/index.js` and call `registerClaimCategoriesRoutes(app, container)`.

Run: `TZ=UTC pnpm --filter api test:integration -- claim-categories`
Expected: PASS.

- [ ] **Step 7: Mutation-check the 409**

Temporarily change the repository's hard-delete guard so it ignores the usage count, re-run the third test, and confirm it goes **red** (the database's `ON DELETE RESTRICT` may surface as a 500 rather than a 409 — that is exactly the difference the test must pin). Restore the guard.

- [ ] **Step 8: Full gate, then commit**

```bash
git add apps/api packages/shared packages/db
git commit -m "feat(api): categories become a catalogue the admin panel can edit"
```

---

### Task 4: Admin screen — "Kategorije reklamacija"

**Files:**

- Create: `apps/admin-web/src/resources/claim-categories.definition.ts`
- Create: `apps/admin-web/src/routes/_shell/settings/claim-categories/index.tsx`
- Modify: `apps/admin-web/src/components/layout/…` the sidebar catalogue group (beside "Izvori reklamacije")
- Modify: `packages/i18n/src/messages/sr.json` + `en.json` (`admin_claim_categories_*`)
- Test: `apps/admin-web/src/resources/__tests__/claim-categories.definition.test.ts`

**Interfaces:**

- Consumes: `claimCategoriesReferenceOptions`, `ClaimCategory*` schemas (Task 2); `/api/claim-categories` (Task 3).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the definition**

`claim-categories.definition.ts` is `claim-sources.definition.ts` with the fields this catalogue has —
code (create-only, then read-only), name, sort order — plus the usage-count and active columns every
catalogue shows. `resourceKey: ResourceChangedKey.ClaimCategories`, `apiBase: '/api/claim-categories'`,
`listQueryKeyPrefix: ['claim-categories']`. Fill `lifecycle` so a category can be deactivated,
reactivated, and hard-deleted **only** while `usageCount` is 0 — the shared table already disables the
delete button and shows `admin_catalog_hard_delete_blocked` when it is not.

There is no "+ Novo" restriction here: unlike privileges, a fifth category is exactly the thing Nikola
must be able to add himself (spec §10.3).

- [ ] **Step 2: Add the route**

`routes/_shell/settings/claim-categories/index.tsx` is the claim-sources route file verbatim with the
definition and query swapped:

```tsx
export const Route = createFileRoute('/_shell/settings/claim-categories/')({
  validateSearch: (search) => ResourceCatalogSearchSchema.parse(search),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(claimCategoriesReferenceOptions({ activeOnly: false }))
  },
  component: ClaimCategoriesRoute,
})
```

Add the sidebar entry to the CATALOGUES group, alphabetically beside the existing ones.

- [ ] **Step 3: Write the failing test**

```ts
it('keeps the code fixed once the category exists', () => {
  const createFields = claimCategoriesResourceDefinition.formFields.filter((f) => !f.editOnly)
  const editFields = claimCategoriesResourceDefinition.formFields.filter((f) => !f.createOnly)

  expect(createFields.find((f) => f.key === 'code')?.type).toBe('text')
  expect(editFields.find((f) => f.key === 'code')?.type).toBe('readonly')
})

it('blocks hard delete while claims still use the category', () => {
  expect(claimCategoriesResourceDefinition.lifecycle?.getUsageCount({ usageCount: 3 } as never)).toBe(3)
})
```

- [ ] **Step 4: Run it**

Run: `TZ=UTC pnpm --filter admin-web test -- claim-categories`
Expected: FAIL first (no definition), PASS after Step 1.

- [ ] **Step 5: Look at it in the browser**

Open the admin panel on the dev server already running in Nikola's terminal, add a fifth category, and
confirm it appears in the internal claim form's select without a deploy. That round trip **is** the
changeability requirement from the spec — if it needs anything else, the design is wrong, not the data.

- [ ] **Step 6: Compile messages, full gate, commit**

```bash
git add apps/admin-web packages/i18n
git commit -m "feat(admin): categories become a catalogue Nikola can extend himself"
```

---

### Task 5: The category on the claim — server side

**Files:**

- Modify: `packages/shared/src/schemas/emotive-claim.schema.ts` (create + update input: `categoryId` required)
- Modify: `packages/shared/src/schemas/domace-claim.schema.ts` (same)
- Modify: `apps/api/src/modules/emotive-claims/emotive-claims.repository.ts` (write the column, read it into the detail)
- Modify: `apps/api/src/modules/domace-claims/domace-claims.repository.ts` (same)
- Test: `apps/api/src/modules/emotive-claims/__tests__/emotive-claims.integration.test.ts`, `apps/api/src/modules/domace-claims/__tests__/domace-claims.integration.test.ts`

**Interfaces:**

- Consumes: `ClaimCategoryListItem` (Task 2), `categoryId` column (Task 1).
- Produces: `categoryId: string` on both create/update inputs; `category: { id: string; code: string; name: string } | null` on both claim detail wires — the internal screens in Task 6 and the list in Task 7 read this shape.

- [ ] **Step 1: Write the failing tests**

In both claim suites:

```ts
it('refuses to create a claim without a category', async () => {
  const res = await request(app, '/api/emotive-claims', {
    as: operator,
    method: 'POST',
    body: { ...validEmotiveClaimBody, categoryId: undefined },
  })

  expect(res.status).toBe(422)
})

it('returns the category on the detail, resolved to code and name', async () => {
  const res = await request(app, `/api/emotive-claims/${claimId}`, { as: operator })

  const body = await res.json()
  expect(body.category).toEqual({
    id: remontCategoryId,
    code: 'REMONT_MOTORA',
    name: 'Generalni remont motora',
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `TZ=UTC pnpm --filter api test:integration -- emotive-claims domace-claims`
Expected: FAIL — the create returns 201 (no such validation) and `body.category` is `undefined`.

- [ ] **Step 3: Make `categoryId` required in both input schemas**

```ts
  categoryId: z.string().uuid(),
```

on create **and** update for both families. Required on update too, deliberately: a claim being edited must not leave the edit uncategorised (spec §3.3), and the backfill from Task 1 means no existing claim is blocked by this.

- [ ] **Step 4: Map the column in both repositories**

Write `categoryId` in the create and update paths beside `manufacturerId`; in the detail read, LEFT JOIN `claim_categories` and project `{ id, code, name }` into `category`, `null` when the column is null. Follow how the repository already resolves the manufacturer so the JOIN count does not grow — this rides the aggregate detail fetch, it does not add a second query.

- [ ] **Step 5: Run the tests green**

Run: `TZ=UTC pnpm --filter api test:integration -- emotive-claims domace-claims`
Expected: PASS.

- [ ] **Step 6: Full gate, then commit**

```bash
git add apps/api packages/shared
git commit -m "feat(claims): a claim says what kind of work it is about, and the server insists"
```

---

### Task 6: The field in both create forms and both detail screens

**Files:**

- Modify: `apps/internal-web/src/features/emotive-claims/create/emotive-claim-create-schemas.ts`
- Modify: `apps/internal-web/src/features/emotive-claims/create/step-basic-fields.tsx`
- Modify: `apps/internal-web/src/features/emotive-claims/create/serialize-emotive-create-body.ts`
- Modify: `apps/internal-web/src/features/domace-claims/create/domace-claim-create-schemas.ts`
- Modify: `apps/internal-web/src/features/domace-claims/create/domace-basic-fields.tsx`
- Modify: `apps/internal-web/src/features/domace-claims/create/serialize-domace-create-body.ts`
- Modify: the two detail edit sections (`features/emotive-claims/detail/`, `features/domace-claims/detail/` — the section that already edits manufacturer and engine type)
- Modify: `packages/i18n/src/messages/sr.json` + `en.json` (`field_claim_category`, `claims_filter_category`, `statistics_by_category_title`)
- Test: `apps/internal-web/src/features/emotive-claims/create/__tests__/` and the DOMAĆE equivalent

**Interfaces:**

- Consumes: `claimCategoriesReferenceOptions` (Task 2), `categoryId` on the create/update bodies (Task 5).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

```tsx
it('will not submit an EMOTIVE claim until a category is chosen', async () => {
  render(<EmotiveClaimCreateWizard />)

  await fillTheRequiredBasicsExceptCategory()

  expect(screen.getByRole('button', { name: /dalje/i })).toBeDisabled()
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `TZ=UTC pnpm --filter internal-web test -- emotive-claim-create`
Expected: FAIL — the button is enabled, because the form does not know about the field yet.

- [ ] **Step 3: Add the field**

A searchable select fed by `claimCategoriesReferenceOptions({ activeOnly: true })`, placed beside manufacturer in the "basics" step of both forms, required in both zod form schemas, serialised as `categoryId`.

⚠ In the detail screens, keep the claim's **current** category selectable even when it has since been deactivated — the same rule `EmployeeSelectField` follows with `currentEmployeeName`. A category the office switched off must not silently drop off a claim that carries it (spec §10.3).

- [ ] **Step 4: Run the tests green**

Run: `TZ=UTC pnpm --filter internal-web test -- claim-create`
Expected: PASS.

- [ ] **Step 5: Compile the messages and check both files**

Run: `pnpm --filter @mr/i18n run compile && pnpm --filter @mr/i18n run build`
Expected: PASS, and every new key present in **both** `sr.json` and `en.json`.

- [ ] **Step 6: Full gate, then commit**

```bash
git add apps/internal-web packages/i18n
git commit -m "feat(internal): both claim forms ask what kind of work it was"
```

---

### Task 7: The column and the filter in the claims list

**Files:**

- Modify: `packages/shared/src/schemas/claim-list.schema.ts` (`ClaimListQuerySchema`: `categoryCode`)
- Modify: `packages/shared/src/schemas/…` the route search schema `ClaimsSearchSchema`
- Modify: `apps/api/src/modules/claims/claims.repository.ts` (**two** conditions — line ~231 for `ec`, line ~338 for `dc`)
- Modify: `apps/internal-web/src/features/claims/claims-filters.tsx`
- Modify: `apps/internal-web/src/features/claims/claims-table.tsx`
- Test: `apps/api/src/modules/claims/__tests__/claims.integration.test.ts`

**Interfaces:**

- Consumes: `category` on the list item (Task 5), the catalog query (Task 2).
- Produces: `?categoryCode=<CODE>` on `/api/claims` and on the internal `/reklamacije` route — Task 9's menu entry links to exactly this.

- [ ] **Step 1: Write the failing tests**

```ts
it('filters the unified list by category code, in both families', async () => {
  const res = await request(app, '/api/claims?categoryCode=MASINSKA_OBRADA', { as: operator })

  const body = await res.json()
  expect(body.items).toHaveLength(2) // one EMOTIVE, one DOMAĆE, seeded above
  expect(body.items.every((item: { category: { code: string } }) =>
    item.category.code === 'MASINSKA_OBRADA')).toBe(true)
})

it('returns an empty list for a code no category has, not an error', async () => {
  const res = await request(app, '/api/claims?categoryCode=NE_POSTOJI', { as: operator })

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ items: [], total: 0 })
})
```

The first test **must** seed one claim of each family, or the `dc` branch can be forgotten and stay green.

- [ ] **Step 2: Run and watch them fail**

Run: `TZ=UTC pnpm --filter api test:integration -- claims`
Expected: FAIL — the filter is ignored, so both families come back unfiltered.

- [ ] **Step 3: Add the query parameter and both conditions**

`ClaimListQuerySchema`: `categoryCode: z.string().trim().min(1).optional(),`

`claims.repository.ts`, in **both** branches (the EMOTIVE one beside line 231, the DOMAĆE one beside line 338):

```ts
    if (query.categoryCode !== undefined) {
      // Semi-join on the code, not the id: the code is what travels in the URL (spec §4.2), and an
      // unknown one yields an empty list rather than an error.
      conditions.push(sql`${sql.raw(alias)}.category_id IN (
        SELECT id FROM claim_categories
        WHERE code = ${query.categoryCode} AND deleted_at IS NULL
      )`)
    }
```

(substituting the literal alias each branch already uses — `ec` and `dc`).

- [ ] **Step 4: Run them green**

Run: `TZ=UTC pnpm --filter api test:integration -- claims`
Expected: PASS.

- [ ] **Step 5: Mutation-check the DOMAĆE branch**

Delete the condition from the `dc` branch only and re-run. Expected: the first test goes **red** (three items instead of two). This is the branch most easily forgotten; if the test stays green, the test is wrong, not the code. Restore.

- [ ] **Step 6: Add the column and the filter control**

`claims-table.tsx`: a "Kategorija" column rendering `item.category?.name ?? '—'`.
`claims-filters.tsx`: a `SearchableSelect` beside the manufacturer one (line ~179), writing `categoryCode` into the route search, and included in the "any filter active" check (~line 89) and the reset (~line 100).

- [ ] **Step 7: Full gate, then commit**

```bash
git add apps packages
git commit -m "feat(claims): the list shows the category and filters by it"
```

---

### Task 8: Statistics — one condition, one new section

**Files:**

- Modify: `apps/api/src/modules/statistics/statistics-claim-filter.ts` (context field ~line 33, `buildActiveClaimWhere` ~line 133)
- Modify: `apps/api/src/modules/statistics/statistics.repository.ts` (`fetchByCategory`, modelled on `fetchByManufacturer` at line 242)
- Modify: `apps/api/src/modules/statistics/statistics.service.ts` (`byCategory` section beside `byManufacturer`, ~line 185)
- Modify: `apps/api/src/modules/statistics/statistics.validators.ts` (`categoryCode` filter)
- Modify: `packages/shared/src/schemas/statistics.schema.ts` (`StatisticsCategoryRowSchema`, `StatisticsByCategorySchema`, add to `StatisticsSummarySchema`)
- Modify: `apps/internal-web/src/routes/_shell/statistika.tsx` (or the section components it renders) — a rank chart in the shape of "Po partneru"
- Test: `apps/api/src/modules/statistics/__tests__/statistics.integration.test.ts`

**Interfaces:**

- Consumes: `categoryCode` filter convention (Task 7), the column (Task 1).
- Produces: `summary.byCategory.items: Array<{ categoryId, code, name, total, pending, accepted, rejected }>`.

- [ ] **Step 1: Write the failing tests**

```ts
it('counts claims per category, with outcomes', async () => {
  const summary = await fetchSummary({ manufacturerId: isolatingManufacturerId })

  expect(summary.byCategory.items).toEqual([
    expect.objectContaining({ code: 'REMONT_MOTORA', total: 2, accepted: 1 }),
    expect.objectContaining({ code: 'MASINSKA_OBRADA', total: 1 }),
  ])
})

it('honours the category filter in a section that knows nothing about categories', async () => {
  const summary = await fetchSummary({
    manufacturerId: isolatingManufacturerId,
    categoryCode: 'MASINSKA_OBRADA',
  })

  expect(summary.outcomes.distribution.total).toBe(1)
})
```

The second test is the one that matters: it proves the filter went into `buildActiveClaimWhere` and not into the new section only. Isolate with a per-test manufacturer filter — the container commits through the pool, so rows persist across tests and runs (CLAUDE.md §6, testing).

- [ ] **Step 2: Run and watch them fail**

Run: `TZ=UTC pnpm --filter api test:integration -- statistics`
Expected: FAIL — `byCategory` is undefined; the filter is ignored.

- [ ] **Step 3: Add the one filter condition**

`statistics-claim-filter.ts`, beside the manufacturer condition:

```ts
  if (ctx.categoryCode !== undefined) {
    conditions.push(sql`${sql.raw(alias)}.category_id IN (
      SELECT id FROM claim_categories
      WHERE code = ${ctx.categoryCode} AND deleted_at IS NULL
    )`)
  }
```

Every existing section calls this function, so all of them honour the category with no change of their own.

- [ ] **Step 4: Add the section**

`fetchByCategory` is `fetchByManufacturer` (line 242) with `manufacturer_id` → `category_id` and `engine_manufacturers` → `claim_categories`. Keep the `HAVING COUNT(*) > 0` and the `ORDER BY total DESC` so the rank chart reads the same way. A row whose `category_id` is null keeps the existing "Nepoznato" treatment — after the backfill it should never appear, and if it does, that is worth seeing rather than hiding.

- [ ] **Step 5: Run them green**

Run: `TZ=UTC pnpm --filter api test:integration -- statistics`
Expected: PASS.

- [ ] **Step 6: Mutation-check the shared filter**

Move the new condition out of `buildActiveClaimWhere` and into `fetchByCategory` only. Expected: the second test goes **red**. Restore.

- [ ] **Step 7: Draw the section, full gate, commit**

```bash
git add apps packages
git commit -m "feat(statistics): claims can be counted by the kind of work they are about"
```

---

### Task 9: "Mašinska obrada" stops being a screen that says it is coming

**Files:**

- Modify: `apps/internal-web/src/config/navigation.ts` (the entry now links to `/reklamacije?categoryCode=MASINSKA_OBRADA`)
- Delete: `apps/internal-web/src/routes/_shell/masinska-obrada.tsx`
- Modify: `apps/internal-web/src/routeTree.gen.ts` (regenerated, not hand-edited)
- Modify: `packages/i18n/src/messages/sr.json` + `en.json` (remove the five `machining_placeholder_*` keys)
- Modify: `apps/internal-web/src/features/command-palette/__tests__/command-registry.test.ts`
- Test: the command-palette registry test above

**Interfaces:**

- Consumes: the `categoryCode` route search from Task 7.

- [ ] **Step 1: Point the menu entry at the filtered list**

In `config/navigation.ts`, change the entry's target to the claims route with `search: { categoryCode: 'MASINSKA_OBRADA' }`. The label and the icon stay — people already know where it is.

- [ ] **Step 2: Delete the placeholder and its strings**

Delete the route file and the five `machining_placeholder_*` keys from both message files. Regenerate the route tree by running the dev build once, or let the router plugin rewrite `routeTree.gen.ts`; never edit that file by hand.

- [ ] **Step 3: Update and run the command-palette test**

Run: `TZ=UTC pnpm --filter internal-web test -- command-registry`
Expected: PASS with the entry now resolving to the claims route.

- [ ] **Step 4: Walk it in the browser**

With `pnpm dev:all` already running in Nikola's terminal (never start or stop it), open internal-web, click "Mašinska obrada", and confirm the claims list opens pre-filtered and the filter control shows the category. A category filter that silently drops on navigation is exactly what this task exists to prevent.

- [ ] **Step 5: Full gate, then commit**

```bash
git add apps packages
git commit -m "feat(internal): machining becomes a list of real claims instead of a promise"
```

---

### Task 10: The portal stops claiming it has no machining claims

**Files:**

- Modify: `apps/portal-web/src/routes/claims/index.tsx:80` (the hardcoded `filter === 'machining' ? [] : list.items`)
- Modify: `packages/shared/src/schemas/client-claim.schema.ts` (carry the category code on the client wire)
- Modify: `apps/api/src/modules/…` client projection (`toClientClaimListItem`)
- Test: `apps/portal-web/src/routes/claims/__tests__/`

**Interfaces:**

- Consumes: the category on the claim (Task 5).

- [ ] **Step 1: Write the failing test**

```tsx
it('shows a machining claim under the machining filter', async () => {
  renderClaimsList({ items: [claimWithCategory('MASINSKA_OBRADA')], filter: 'machining' })

  expect(await screen.findByText('MR-7167')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `TZ=UTC pnpm --filter portal-web test -- claims`
Expected: FAIL — the list is hardcoded empty for that filter.

- [ ] **Step 3: Read the real category**

`claimServiceType()` reads the claim's category code instead of returning the engine-remanufacture constant; the hardcoded empty branch goes away. Only the coarse split (remont / mašinska) is wired — the finer `PortalServiceType` (`head | block | crank`) is the **part**, which is Faza 2, and must not be faked from the category.

⚠ The category code must reach the portal through the client projection, which masks fields while a claim is unpublished. The category is not a masked field — but confirm the projection test suite still passes, since it is the file that keeps clients from seeing what they must not.

- [ ] **Step 4: Run it green, full gate, commit**

```bash
git add apps packages
git commit -m "fix(portal): the machining filter shows machining claims instead of nothing"
```

---

## After the last task

- Push the branch. Feature branches do not deploy (Railway watches `main`).
- Merging to `main` deploys. **After that deploy, run once, by hand, in the api service's Console:** `pnpm --filter @mr/db run db:seed` — for the new permission `settings.claim_categories.manage` and the updated standard package. The catalog itself needs no seed; its four rows ride in migration `0045` (spec §4.3).
- The migration runs itself: `preDeployCommand` is `db:migrate:deploy`.
- Verify in the browser on live: create one claim of each family, filter the list by category, open Statistics and read the new section, click "Mašinska obrada" in the menu.
