# Statistika „zašto se desilo" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach the statistics screen to read the category-field answers the app already collects, make one field's options depend on another field's answer, and let any answer filter the whole screen — so „ko je imao reklamacije" and „zašto" can be seen together.

**Architecture:** No new claim column and no new catalogue. One nullable self-FK (`parent_option_id`) turns the existing option catalogue into a dependent one; one condition in `buildActiveClaimWhere` turns any answer into a filter honoured by all 12 existing sections (that is the whole of „ukrštanje"); one new summary section counts answers per field per category, with two honest buckets for what is not known.

**Tech Stack:** Drizzle + Postgres (jsonb `category_field_values`, nested by category id since `0047`) · Hono API · TanStack Start + recharts (internal-web) · admin `ResourceDefinition` machine · Paraglide i18n · Vitest + real-Postgres integration tests.

**Spec:** `docs/superpowers/specs/2026-08-22-statistika-uzrok-design.md`

## Global Constraints

- **No new permission.** Reads stay on the existing 10-permission list (three `statistics.view_*` included); catalogue mutations stay on `settings.claim_categories.manage`. **No `db:seed` after deploy.**
- **No new claim column, no new catalogue table.** The cause is the category fields that already exist.
- **No layer may branch on a category or field code.** Filtering travels by code through the query, never `if (code === '…')`.
- **Two migrations, both forward-only, neither deletes or rewrites an existing row.** Generate with `drizzle-kit` — never hand-write DDL. After `db:generate` **always** `pnpm --filter @mr/db run db:migrate` into the dev DB (22.08.: skipping it passed every HTTP test and returned 500 in the browser).
- **`null` ≠ empty.** A withheld section is `null` (a statement about the reader); an empty list is a statement about the shop. Withholding happens AFTER the cache read.
- **Server sends codes and catalogue names only** — never a Serbian label for a synthetic bucket. `__UNFILLED__` / `__PREDATES__` are labelled by the client.
- **Every bug guard ships a mutation proof:** break the line the test covers, watch it go red, restore.
- **Gate before every commit** (this MacBook Air — tests in their own pass):
  ```bash
  pnpm format:check \
    && TZ=UTC pnpm exec turbo run build typecheck lint --force --concurrency=2 \
    && TZ=UTC pnpm exec turbo run test --force --concurrency=1 \
    && pnpm --filter api depcruise && TZ=UTC pnpm test:integration
  ```
- **i18n:** every string via Paraglide, `sr.json` + `en.json` both, no ICU plurals. After editing messages: `pnpm --filter @mr/i18n run compile` for dev, **`build`** for the gate (a NEW key typechecks red until the package is built).

---

## File Structure

**`packages/db`** — `src/schema/catalogs.ts` (self-FK), two migration files, `src/__tests__/integration/schema.integration.test.ts`.
**`packages/shared`** — `src/schemas/claim-category-field.schema.ts` (parent on the wire), `src/schemas/statistics.schema.ts` (new section), `src/queries/{statistics-filters,statistics-search,serialize-statistics-params}.ts` (new filter), `src/constants/statistics-rank-colors.ts` (two bucket codes).
**`apps/api`** — `src/core/ports/category-fields-port.ts`, `src/core/claims/validate-category-field-values.ts` (dependency rule), `src/modules/claim-category-field-options/{repository,service,validators}.ts` (parent CRUD + 422), `src/modules/statistics/{statistics-claim-filter,statistics.repository,statistics.service}.ts`.
**`apps/internal-web`** — `src/features/claims/category-fields/{category-field-model.ts,category-fields-group.tsx}` (dependent control + orphan clearing), `src/features/claims/detail/…` (amber band + quick dialog), `src/features/statistika/analytics/{statistics-breakdown-charts.tsx,statistics-analytics-filters.tsx}`.
**`apps/admin-web`** — `src/resources/claim-category-field-options.definition.ts` + `src/lib/resource/reference-select-registry.ts` (parent picker).

---

### Task 1: The column — an option may hang off another option

**Files:**
- Modify: `packages/db/src/schema/catalogs.ts:295-321`
- Create: `packages/db/migrations/00NN_*.sql` (generated)
- Modify: `packages/db/src/__tests__/integration/schema.integration.test.ts`

**Interfaces:**
- Produces: `claimCategoryFieldOptions.parentOptionId` (`uuid`, nullable, self-FK `ON DELETE RESTRICT`), index `idx_claim_category_field_options_parent_option_id`.

- [ ] **Step 1: Write the failing schema test**

In `schema.integration.test.ts`, beside the other catalogue assertions:

```ts
it('lets an option hang off an option of another field, and refuses to delete a parent that has children', async () => {
  const [category] = await db.insert(schema.claimCategories).values({ code: `DEP-${Date.now()}`, name: 'Dep' }).returning()
  const [partField] = await db.insert(schema.claimCategoryFields).values({ categoryId: category!.id, code: 'deo', name: 'Deo' }).returning()
  const [faultField] = await db.insert(schema.claimCategoryFields).values({ categoryId: category!.id, code: 'kvar', name: 'Kvar' }).returning()
  const [parent] = await db.insert(schema.claimCategoryFieldOptions).values({ fieldId: partField!.id, code: 'glava', name: 'Glava' }).returning()
  const [child] = await db.insert(schema.claimCategoryFieldOptions).values({ fieldId: faultField!.id, code: 'ventili', name: 'Ventili', parentOptionId: parent!.id }).returning()

  expect(child!.parentOptionId).toBe(parent!.id)
  await expect(
    db.delete(schema.claimCategoryFieldOptions).where(eq(schema.claimCategoryFieldOptions.id, parent!.id)),
  ).rejects.toThrow()
})
```

- [ ] **Step 2: Run it and watch it fail**

`TZ=UTC pnpm --filter @mr/db test -- schema.integration` → FAIL, `parentOptionId` is not a known column.

- [ ] **Step 3: The schema change**

In `catalogs.ts`, inside `claimCategoryFieldOptions`'s column block, after `fieldId`:

```ts
    /**
     * The option this one hangs off — always an option of ANOTHER field of the SAME category
     * (glava → ventili ne zaptivaju). NULL means the option is always offered. The dependency
     * lives on the option, not on the field: the field's dependency is what its children say.
     */
    parentOptionId: uuid('parent_option_id'),
```

and in the table's second argument:

```ts
    index('idx_claim_category_field_options_parent_option_id').on(t.parentOptionId),
    foreignKey({
      name: 'claim_category_field_options_parent_option_id_fkey',
      columns: [t.parentOptionId],
      foreignColumns: [t.id],
    }).onDelete('restrict'),
```

- [ ] **Step 4: Generate and apply the migration**

```bash
pnpm --filter @mr/db run db:generate
```
Read the generated SQL: it must be exactly one `ALTER TABLE … ADD COLUMN "parent_option_id" uuid`, one `ADD CONSTRAINT … FOREIGN KEY … ON DELETE restrict`, one `CREATE INDEX`. Nothing else — if it carries any other statement, stop and report. Then:
```bash
pnpm --filter @mr/db run db:migrate
```

- [ ] **Step 5: Green + migrate-from-zero**

`TZ=UTC pnpm --filter @mr/db test -- schema.integration` → PASS. Then `TZ=UTC pnpm test:integration` (its global setup migrates from zero — that is the proof the chain is clean).

- [ ] **Step 6: Commit**

```bash
git add packages/db
git commit -m "feat(db): an option of a category field may hang off an option of another field"
```

---

### Task 2: The dependency crosses the wire

**Files:**
- Modify: `packages/shared/src/schemas/claim-category-field.schema.ts:37-118`
- Modify: `packages/shared/src/schemas/__tests__/claim-category-field.schema.test.ts`

**Interfaces:**
- Consumes: Task 1's column.
- Produces: on `ClaimCategoryFieldOptionListItemSchema` — `parentOptionId: string | null`, `parentFieldCode: string | null`, `parentOptionCode: string | null`; on create input — `parentOptionId?: string`; a standalone option update schema carrying `parentOptionId?: string | null`.

- [ ] **Step 1: Write the failing schema test**

```ts
it('carries the parent of a dependent option, and lets an update clear it', () => {
  const item = ClaimCategoryFieldOptionListItemSchema.parse({
    ...baseOption,
    parentOptionId: '11111111-1111-4111-8111-111111111111',
    parentFieldCode: 'sklop_u_kvaru',
    parentOptionCode: 'glava',
  })
  expect(item.parentOptionCode).toBe('glava')
  expect(ClaimCategoryFieldOptionListItemSchema.parse({ ...baseOption, parentOptionId: null, parentFieldCode: null, parentOptionCode: null }).parentOptionId).toBeNull()
  expect(ClaimCategoryFieldOptionUpdateInputSchema.parse({ parentOptionId: null }).parentOptionId).toBeNull()
})
```

- [ ] **Step 2: Run it and watch it fail**

`TZ=UTC pnpm --filter @mr/shared test -- claim-category-field.schema` → FAIL (unknown keys stripped / parse error).

- [ ] **Step 3: The schema change**

On `ClaimCategoryFieldOptionListItemSchema` add:

```ts
  /** The option this one hangs off — null when it is always offered. */
  parentOptionId: z.string().uuid().nullable(),
  /** Its field's and its own CODE, so no screen has to resolve an id to filter by it. */
  parentFieldCode: z.string().nullable(),
  parentOptionCode: z.string().nullable(),
```

On `ClaimCategoryFieldOptionCreateInputSchema` add `parentOptionId: z.string().uuid().optional(),`.

Replace the aliased update schema (an option has no `isRequired`, and it never had one on the form):

```ts
export const ClaimCategoryFieldOptionUpdateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    /** `null` clears the dependency; omitting the key leaves it as it is. */
    parentOptionId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })
```

- [ ] **Step 4: Green**

`TZ=UTC pnpm --filter @mr/shared test -- claim-category-field.schema` → PASS. Fix any fixture in the repo that builds an option list item (typecheck names them).

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): an option says which option it hangs off"
```

---

### Task 3: The catalogue serves and guards the dependency

**Files:**
- Modify: `apps/api/src/modules/claim-category-field-options/{claim-category-field-options.repository.ts,claim-category-field-options.service.ts}`
- Modify: `apps/api/src/core/ports/category-fields-port.ts`
- Modify: `apps/api/src/modules/claim-category-fields/claim-category-fields.repository.ts` (the `listForCategory` that feeds the port)
- Modify: `apps/api/src/modules/claim-categories/__tests__/*.integration.test.ts` (whichever suite covers the option CRUD)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `CategoryFieldCatalogOption.parent: { fieldCode: string; optionCode: string } | null`; `POST/PATCH` on options accept `parentOptionId` and answer **422** when it is not an option of another field of the same category.

- [ ] **Step 1: Write the failing integration tests**

```ts
it('refuses a parent from another category', async () => { /* expect 422 ValidationError */ })
it('refuses a parent from the SAME field', async () => { /* 422 — a field cannot depend on itself */ })
it('refuses an option as its own parent on update', async () => { /* 422 */ })
it('serves the parent field and option CODES on the list', async () => { /* parentFieldCode === 'sklop_u_kvaru', parentOptionCode === 'glava' */ })
it('gives the claims port the parent, retired parents included', async () => { /* listForCategory().options[i].parent */ })
```

- [ ] **Step 2: Run them and watch them fail**

`TZ=UTC pnpm --filter api test:integration -- claim-category` → FAIL.

- [ ] **Step 3: Repository — one self-join, no second query**

In the options repository's list select, join the parent once:

```ts
      parentOptionId: claimCategoryFieldOptions.parentOptionId,
      parentOptionCode: parentOption.code,
      parentFieldCode: parentField.code,
```
with `const parentOption = alias(claimCategoryFieldOptions, 'parent_option')` and `const parentField = alias(claimCategoryFields, 'parent_field')`, both `leftJoin`ed (`parentOption.id = options.parentOptionId`, `parentField.id = parentOption.fieldId`). The same two joins go into the `listForCategory` used by the port, which maps them into `parent`.

⚠ `listForCategory` deliberately returns retired rows — do **not** add `isActive` filters to these joins.

- [ ] **Step 4: Service — the parent rule, in the service, not in SQL**

The rule needs a subquery, so a CHECK constraint cannot carry it. In `create` and `update`, when `parentOptionId` is present and not null:

```ts
    const parent = await this.repo.findById(input.parentOptionId)
    if (parent === null || parent.fieldId === fieldId || parent.categoryId !== categoryId || parent.id === id) {
      throw new ValidationError('Invalid parent option: it must be an option of another field of the same category')
    }
```
(`ValidationError` maps to 422 — the same shape `Invalid or inactive claim category` uses.)

- [ ] **Step 5: Port**

```ts
export interface CategoryFieldCatalogOption {
  code: string
  isActive: boolean
  /** The answer this option depends on — another field of the same category. */
  parent: { fieldCode: string; optionCode: string } | null
}
```

- [ ] **Step 6: Green + mutation proof**

Tests PASS. Then delete the `parent.categoryId !== categoryId` clause → the „another category" test must go RED. Restore.

- [ ] **Step 7: Commit**

```bash
git add apps/api packages/shared
git commit -m "feat(api): the catalogue refuses a dependency that crosses a category"
```

---

### Task 4: The server refuses an answer whose parent was not given

**Files:**
- Modify: `apps/api/src/core/claims/validate-category-field-values.ts`
- Modify: `apps/api/src/core/claims/__tests__/validate-category-field-values.test.ts`

**Interfaces:**
- Consumes: Task 3's `parent`.
- Produces: 400 on a dependent answer without / against its parent. Unchanged values keep passing.

- [ ] **Step 1: Write the failing tests**

```ts
it('refuses a dependent answer when its parent field was not answered', () => {
  expect(() => assertCategoryFieldValues({ values: { kvar: 'ventili' }, previousValues: {}, fields, requireComplete: false }))
    .toThrow(/requires sklop_u_kvaru = glava/)
})
it('refuses a dependent answer that contradicts the parent answer', () => {
  expect(() => assertCategoryFieldValues({ values: { sklop_u_kvaru: 'blok', kvar: 'ventili' }, previousValues: {}, fields, requireComplete: false }))
    .toThrow(/requires sklop_u_kvaru = glava/)
})
it('accepts the pair that belongs together', () => {
  expect(() => assertCategoryFieldValues({ values: { sklop_u_kvaru: 'glava', kvar: 'ventili' }, previousValues: {}, fields, requireComplete: false })).not.toThrow()
})
it('keeps an UNCHANGED dependent answer even after the pair stopped matching', () => {
  expect(() => assertCategoryFieldValues({ values: { sklop_u_kvaru: 'blok', kvar: 'ventili' }, previousValues: { kvar: 'ventili' }, fields, requireComplete: false })).not.toThrow()
})
```

- [ ] **Step 2: Run them and watch them fail**

`TZ=UTC pnpm --filter api test -- validate-category-field-values` → the first two FAIL (nothing throws).

- [ ] **Step 3: Implement**

`assertValue` needs the whole answer map, so give it one more parameter and pass `values` from the loop:

```ts
function assertValue(
  field: CategoryFieldCatalogField,
  value: string,
  isUnchanged: boolean,
  values: ClaimCategoryFieldValues,
): void {
  …
  if (isUnchanged) {
    return
  }

  if (!option.isActive) { … }

  // A dependent option is only offered under its parent answer, so accepting it without that
  // answer would store a pair the screen can never draw again.
  if (option.parent !== null && values[option.parent.fieldCode] !== option.parent.optionCode) {
    throw new ValidationError(
      `Invalid category field value: ${value} requires ${option.parent.fieldCode} = ${option.parent.optionCode}`,
    )
  }
}
```

- [ ] **Step 4: Green + mutation proof**

PASS. Then invert the condition to `===` → tests 1–3 go RED. Restore.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): a dependent answer is refused without the answer it hangs off"
```

---

### Task 5: The content — „Uzrok kvara" for engine overhaul

**Files:**
- Create: `packages/db/migrations/00NN_engine_overhaul_cause_field.sql` (custom, via `pnpm --filter @mr/db exec drizzle-kit generate --custom --name engine_overhaul_cause_field`)
- Modify: `packages/db/src/__tests__/integration/*category-fields*.test.ts` (the 22.08. suite that asserts the seeded catalogue)

**Interfaces:**
- Consumes: Task 1's column.
- Produces: field `uzrok_kvara` („Uzrok kvara", `select`, not required, `sort_order` 1) under `REMONT_MOTORA`, with the options of spec §4.B, each carrying `parent_option_id` = the matching `sklop_u_kvaru` option.

- [ ] **Step 1: Write the failing catalogue test**

```ts
it('offers a cause for every assembly, and each cause hangs off its assembly', async () => {
  const fields = await repo.listForCategory(remontId)
  const cause = fields.find((f) => f.code === 'uzrok_kvara')
  expect(cause?.isRequired).toBe(false)
  expect(cause?.options.every((o) => o.parent?.fieldCode === 'sklop_u_kvaru')).toBe(true)
  const parents = new Set(cause?.options.map((o) => o.parent?.optionCode))
  expect(parents).toEqual(new Set(['blok','glava','radilica','klipnjace','klipovi','lezajevi','razvod','pumpa_ulja','turbina','zaptivke','ostalo']))
})
```

- [ ] **Step 2: Run it and watch it fail**

`TZ=UTC pnpm test:integration -- category-fields` → FAIL, no such field.

- [ ] **Step 3: Write the data migration**

Follow `0048_shop_category_fields.sql` exactly: `INSERT … SELECT` keyed on codes (never on hard-coded uuids), `ON CONFLICT DO NOTHING`, and every option's `parent_option_id` resolved by a subselect on `(field 'sklop_u_kvaru', option code)`. Sort order follows the table in spec §4.B. Nothing is `is_required`.

- [ ] **Step 4: Apply and green**

`pnpm --filter @mr/db run db:migrate` then `TZ=UTC pnpm test:integration -- category-fields` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat(db): engine overhaul asks what failed, and the answers hang off the assembly"
```

---

### Task 6: Any answer becomes a filter — and that is the whole of the cross-tab

**Files:**
- Modify: `packages/shared/src/queries/statistics-filters.ts`, `statistics-search.ts`, `serialize-statistics-params.ts`
- Modify: `apps/api/src/modules/statistics/statistics-claim-filter.ts:105-155`, `statistics.service.ts:100-112`
- Modify: `apps/api/src/modules/statistics/__tests__/statistics.integration.test.ts`
- Modify: `packages/shared/src/queries/__tests__/statistics-search.test.ts`

**Interfaces:**
- Produces: `StatisticsSummaryFilters.fieldCode?: string`, `.optionCode?: string`; both refused without `categoryCode`; `StatisticsQueryContext.fieldCode`/`.optionCode`; one condition in `buildActiveClaimWhere`.

- [ ] **Step 1: Write the failing tests**

Search schema:
```ts
it('refuses an answer filter without a category', () => {
  expect(() => StatisticsSearchSchema.parse({ fieldCode: 'sklop_u_kvaru', optionCode: 'glava' })).toThrow()
  expect(() => StatisticsSearchSchema.parse({ categoryCode: 'REMONT_MOTORA', fieldCode: 'sklop_u_kvaru' })).toThrow()
  expect(StatisticsSearchSchema.parse({ categoryCode: 'REMONT_MOTORA', fieldCode: 'sklop_u_kvaru', optionCode: 'glava' }).optionCode).toBe('glava')
})
```
Integration — the point of the whole task is that a section which knows nothing about fields obeys it:
```ts
it('an answer filter narrows a section that knows nothing about category fields', async () => {
  // two claims, same manufacturer, same employee-less/employed split; one answered glava, one blok
  const all = await container.statisticsService.getSummary(FULL_STATISTICS, { manufacturerId })
  const glava = await container.statisticsService.getSummary(FULL_STATISTICS, { manufacturerId, categoryCode: 'REMONT_MOTORA', fieldCode: 'sklop_u_kvaru', optionCode: 'glava' })
  expect(all.byEmployee?.items.length).toBe(2)
  expect(glava.byEmployee?.items.length).toBe(1)
  expect(glava.outcomes.distribution.total).toBe(1)
})
it('still withholds byEmployee from a reader without employees.view_analytics while an answer filter is on', async () => { … expect(summary.byEmployee).toBeNull() })
```

- [ ] **Step 2: Run them and watch them fail**

`TZ=UTC pnpm --filter @mr/shared test -- statistics-search` and `pnpm --filter api test:integration -- statistics` → FAIL.

- [ ] **Step 3: Shared — the filter, in all four places**

`statistics-filters.ts`: two optional string fields on the interface + two copies in `normalizeStatisticsSummaryFilters`.
`statistics-search.ts`: `fieldCode`/`optionCode` as `z.string().trim().min(1).optional()`, both copied in `statisticsFiltersFromSearch` and `statisticsSearchFromFilters`, and in the `superRefine`:

```ts
    const hasAnswer = data.fieldCode !== undefined || data.optionCode !== undefined
    if (hasAnswer && (data.fieldCode === undefined || data.optionCode === undefined || data.categoryCode === undefined)) {
      ctx.addIssue({
        code: 'custom',
        // A field code is unique per category, not across the shop: `pojava_kvara` exists under
        // engine overhaul AND under auto service. Without the category it names two questions.
        message: 'fieldCode and optionCode require categoryCode',
        path: ['fieldCode'],
      })
    }
```
`serialize-statistics-params.ts`: two `params.set` lines.

- [ ] **Step 4: API — one condition, honoured by all 12 sections**

`buildStatisticsQueryContext`: copy both onto the context. In `buildActiveClaimWhere`, after the category semi-join:

```ts
  if (ctx.fieldCode !== undefined && ctx.optionCode !== undefined && ctx.categoryCode !== undefined) {
    // The answers are nested by the FIELD'S OWN category id (migration 0047), which is the
    // category being filtered — the same key `category-field-usage-sql.ts` reads. Because every
    // section is built on this function, one condition here is the whole of the cross-tab.
    // ponytail: no index on category_field_values; at this size it is a scan nobody feels.
    conditions.push(sql`${sql.raw(alias)}.category_field_values
      -> (SELECT cc.id::text FROM claim_categories cc WHERE cc.code = ${ctx.categoryCode} AND cc.deleted_at IS NULL)
      ->> ${ctx.fieldCode} = ${ctx.optionCode}`)
  }
```

`statistics.service.ts`: add `filters.fieldCode, filters.optionCode` to the cache key array — **between `categoryCode` and `year`**, and never omit them, or two different answers share one cached summary.

- [ ] **Step 5: Green + mutation proof**

Both suites PASS. Then delete the new `conditions.push` → the narrowing test goes RED. Restore. Then remove `filters.optionCode` from the cache key → run the integration suite twice in one process with two different option codes; if nothing goes red, add the test that does (two answers, same everything else, different totals).

- [ ] **Step 6: Commit**

```bash
git add packages apps/api
git commit -m "feat(statistics): an answer narrows every section at once"
```

---

### Task 7: The section — what each field of each category says

**Files:**
- Modify: `packages/shared/src/constants/statistics-rank-colors.ts`, `packages/shared/src/schemas/statistics.schema.ts:203-223`
- Modify: `apps/api/src/modules/statistics/statistics.repository.ts`, `statistics.service.ts:155-200`
- Modify: `apps/api/src/modules/statistics/__tests__/statistics.integration.test.ts`, `packages/shared/src/schemas/__tests__/statistics.schema.test.ts`

**Interfaces:**
- Produces: `STATISTICS_FIELD_UNFILLED_CODE = '__UNFILLED__'`, `STATISTICS_FIELD_PREDATES_CODE = '__PREDATES__'`; `StatisticsSummary.byCategoryFields: StatisticsCategoryFieldGroup[]`; `StatisticsRepository.fetchByCategoryFields(ctx)`.

- [ ] **Step 1: Shared shape**

```ts
export const StatisticsCategoryFieldBucketSchema = z.object({
  /** An option code, or one of the two synthetic buckets the client labels itself. */
  code: z.string().min(1),
  /** The option's name; EMPTY for a synthetic bucket — the server never writes Serbian. */
  name: z.string(),
  total: z.coerce.number().int().nonnegative(),
  /** false for a retired option some claim still carries — drawn with †. */
  isActive: z.boolean(),
})

export const StatisticsCategoryFieldSchema = z.object({
  fieldCode: z.string().min(1),
  fieldName: z.string().min(1),
  isActive: z.boolean(),
  items: z.array(StatisticsCategoryFieldBucketSchema),
})

export const StatisticsCategoryFieldGroupSchema = z.object({
  categoryCode: z.string().min(1),
  categoryName: z.string().min(1),
  total: z.coerce.number().int().nonnegative(),
  fields: z.array(StatisticsCategoryFieldSchema),
})
```
and on `StatisticsSummarySchema`: `byCategoryFields: z.array(StatisticsCategoryFieldGroupSchema),` (an array, never null — nothing about it is withheld). Every fixture in `statistics.schema.test.ts` gains `byCategoryFields: []`, plus one populated case.

- [ ] **Step 2: Write the failing integration tests**

```ts
it('counts answers per field, and says separately what was not filled and what predates the field', async () => {
  // three claims in REMONT: a answered glava; b left it empty; c created_at moved before the field's created_at
  const summary = await container.statisticsService.getSummary(FULL_STATISTICS, { manufacturerId })
  const group = summary.byCategoryFields.find((g) => g.categoryCode === 'REMONT_MOTORA')
  const field = group?.fields.find((f) => f.fieldCode === 'sklop_u_kvaru')
  expect(field?.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'glava', total: 1, isActive: true }),
    expect.objectContaining({ code: STATISTICS_FIELD_UNFILLED_CODE, total: 1 }),
    expect.objectContaining({ code: STATISTICS_FIELD_PREDATES_CODE, total: 1 }),
  ]))
})
it('obeys the period, the manufacturer and the category like every other section', async () => { … })
it('names a retired option a claim still carries, and marks it inactive', async () => { … })
it('drops a retired FIELD nobody answered, and keeps one somebody did', async () => { … })
it('is empty, not null, for a scope with no claims', async () => { expect(summary.byCategoryFields).toEqual([]) })
```

- [ ] **Step 3: Run them and watch them fail**

`TZ=UTC pnpm --filter api test:integration -- statistics` → FAIL.

- [ ] **Step 4: The query**

In `statistics.repository.ts`, following `fetchByCategory`'s branch pattern (each branch selects `category_id, created_at, category_field_values`):

```sql
      SELECT
        cc.code AS category_code, cc.name AS category_name,
        f.code AS field_code, f.name AS field_name,
        f.is_active AS field_is_active, f.sort_order AS field_sort_order,
        CASE
          WHEN c.category_field_values -> c.category_id::text ->> f.code IS NOT NULL
            THEN c.category_field_values -> c.category_id::text ->> f.code
          WHEN c.created_at < f.created_at THEN '__PREDATES__'
          ELSE '__UNFILLED__'
        END AS bucket,
        COUNT(*)::int AS total,
        COALESCE(MAX(o.name), '') AS option_name,
        COALESCE(bool_and(o.is_active), true) AS option_is_active
      FROM (${unionSql}) AS c
      JOIN claim_categories cc ON cc.id = c.category_id
      JOIN claim_category_fields f
        ON f.category_id = c.category_id AND f.field_type = 'select' AND f.deleted_at IS NULL
      LEFT JOIN claim_category_field_options o
        ON o.field_id = f.id
       AND o.code = c.category_field_values -> c.category_id::text ->> f.code
      GROUP BY 1, 2, 3, 4, 5, 6, 7
      ORDER BY cc.name ASC, f.sort_order ASC, f.code ASC, total DESC, bucket ASC
```

Map the rows into groups in TS (the only shaping the server does):
- group by `category_code`, then by `field_code`, keeping SQL's order;
- a group's `total` = the sum of one of its fields' buckets — take the FIRST field's, since every field of a category counts the same claims once;
- **drop a field with `field_is_active = false` whose every bucket is one of the two synthetic codes** — the office stopped asking, and nobody had answered.

⚠ The two joins deliberately do not filter `deleted_at`/`is_active` on the option: a claim keeps what it was given.

- [ ] **Step 5: Service**

Add `this.repo.fetchByCategoryFields(queryContext)` to the `Promise.all` and `byCategoryFields` to the returned object. **Nothing is withheld** — a field answer is not a named person and not money.

- [ ] **Step 6: Green + mutation proof**

PASS. Then swap `c.created_at < f.created_at` for `>` → the PREDATES test goes RED. Restore. Then delete the retired-field drop → the „drops a retired FIELD nobody answered" test goes RED. Restore.

- [ ] **Step 7: Commit**

```bash
git add packages/shared apps/api
git commit -m "feat(statistics): the summary counts what the category fields answered"
```

---

### Task 8: The form offers only the causes that belong to the chosen assembly

**Files:**
- Modify: `apps/internal-web/src/features/claims/category-fields/category-field-model.ts`, `category-fields-group.tsx`
- Modify: `apps/internal-web/src/features/claims/category-fields/__tests__/category-field-model.test.ts`
- Create: `apps/internal-web/src/features/claims/category-fields/__tests__/category-fields-dependency.test.tsx`

**Interfaces:**
- Consumes: `ClaimCategoryFieldOptionListItem.parentFieldCode` / `.parentOptionCode` (Task 2).
- Produces: `CategoryFieldView.awaitingParent: string | null` (the parent field's NAME when it is unanswered); `clearOrphanedCategoryFieldAnswers(values, fields)`.

- [ ] **Step 1: Write the failing model tests**

```ts
it('offers only the options that hang off the chosen parent', () => {
  const views = categoryFieldViews(fields, { sklop_u_kvaru: 'glava' })
  expect(views.find((v) => v.code === 'uzrok_kvara')?.options.map((o) => o.code)).toEqual(['ventili', 'pukla'])
})
it('waits for the parent, naming it, and offers nothing until then', () => {
  const view = categoryFieldViews(fields, {}).find((v) => v.code === 'uzrok_kvara')
  expect(view?.awaitingParent).toBe('Sklop u kvaru')
  expect(view?.options).toEqual([])
})
it('keeps a chosen option visible even when it no longer hangs off the current parent', () => {
  const view = categoryFieldViews(fields, { sklop_u_kvaru: 'blok', uzrok_kvara: 'ventili' }).find((v) => v.code === 'uzrok_kvara')
  expect(view?.options.some((o) => o.code === 'ventili')).toBe(true)
})
it('drops an answer whose parent changed under it', () => {
  expect(clearOrphanedCategoryFieldAnswers({ sklop_u_kvaru: 'blok', uzrok_kvara: 'ventili' }, fields)).toEqual({ sklop_u_kvaru: 'blok' })
})
it('picks the control AFTER narrowing — two options is a row of buttons, not a dropdown', () => {
  expect(categoryFieldViews(fields, { sklop_u_kvaru: 'glava' }).find((v) => v.code === 'uzrok_kvara')?.control).toBe('segmented')
})
```

- [ ] **Step 2: Run them and watch them fail**

`TZ=UTC pnpm --filter internal-web test -- category-field-model` → FAIL.

- [ ] **Step 3: Implement in the model**

Inside `categoryFieldViews`'s option `.filter`, before the control is chosen:

```ts
        .filter((option) => {
          if (option.parentFieldCode === null || option.parentOptionCode === null) {
            return true
          }
          // The chosen answer stays visible so the claim can still name it, even after the
          // parent was changed under it — the server keeps an unchanged value for the same reason.
          return values[option.parentFieldCode] === option.parentOptionCode || option.code === chosen
        })
```
and compute `awaitingParent` from the field's children: the parent field's name when every option of this field depends on a field that has no answer yet. Export:

```ts
/** Answers whose option no longer hangs off the current parent answer — what a parent change discards. */
export function clearOrphanedCategoryFieldAnswers(
  values: ClaimCategoryFieldValues,
  fields: readonly ClaimCategoryFieldListItem[],
): ClaimCategoryFieldValues
```

- [ ] **Step 4: Wire it into the group**

`category-fields-group.tsx`: on every change, run the next values through `clearOrphanedCategoryFieldAnswers` before calling `onChange` — otherwise changing the assembly leaves a cause the server will refuse with a 400 the person cannot read. Render `awaitingParent` as a disabled control with the hint `m.claim_category_field_awaiting_parent({ field: view.awaitingParent })`.

- [ ] **Step 5: Green + mutation proof**

PASS. Then remove the `clearOrphanedCategoryFieldAnswers` call from the group → the component test that changes the parent and expects the child answer to disappear goes RED. Restore.

- [ ] **Step 6: Commit**

```bash
git add apps/internal-web packages/i18n
git commit -m "feat(internal): the cause list follows the assembly that was chosen"
```

---

### Task 9: „Nije upisano šta je otkazalo" — the amber band and its small window

**Files:**
- Create: `apps/internal-web/src/features/claims/category-fields/category-fields-quick-edit.tsx`
- Modify: the EMOTIVE and DOMACE detail overview cards (`emotive-claim-detail.tsx` / `domace-claim-detail.tsx` overview section)
- Create: `apps/internal-web/src/features/claims/category-fields/__tests__/category-fields-quick-edit.test.tsx`

**Interfaces:**
- Consumes: `categoryFieldViews`, the existing basic-data update mutation (the PATCH already accepts `categoryFieldValues` alone).
- Produces: `<CategoryFieldsQuickEdit claimId kind categoryId values />` and `hasUnansweredSelectFields(views)`.

- [ ] **Step 1: Write the failing component tests**

```ts
it('shows the band while a select field of the category has no answer', () => { … expect(screen.getByText(/Nije upisano/)).toBeVisible() })
it('does not show it once every select field is answered', () => { … expect(screen.queryByText(/Nije upisano/)).toBeNull() })
it('saves only the category answers, not the rest of the claim', async () => { … expect(patchBody).toEqual({ categoryFieldValues: { sklop_u_kvaru: 'glava' } }) })
it('does not count a text field as missing', () => { … })
```

- [ ] **Step 2: Run them and watch them fail**

`TZ=UTC pnpm --filter internal-web test -- category-fields-quick-edit` → FAIL.

- [ ] **Step 3: Implement**

A `<InternalNote tone="warning">` on the Pregled tab carrying the sentence and a button that opens a `<Dialog>` holding `CategoryFieldsGroup` + Save. **No server change** — the screen already has the fields and the answers, and the PATCH already takes its own part.

- [ ] **Step 4: Green**

PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/internal-web packages/i18n
git commit -m "feat(internal): a claim says when nobody wrote down what failed"
```

---

### Task 10: The statistics screen — the section, and the click that filters everything

**Files:**
- Modify: `apps/internal-web/src/features/statistika/analytics/statistics-breakdown-charts.tsx`, `statistics-analytics-filters.tsx`
- Modify: `apps/internal-web/src/features/statistika/analytics/__tests__/statistics-breakdown-charts.test.tsx`
- Modify: `apps/internal-web/src/routes/_shell/statistika.tsx` (search schema already comes from `@mr/shared` — verify nothing else pins the old shape)

**Interfaces:**
- Consumes: `summary.byCategoryFields` (Task 7), the two bucket codes, the new search params (Task 6).
- Produces: one `BreakdownRankCard` per field, grouped under its category; a filter chip; bar click → `navigate({ search })`.

- [ ] **Step 1: Write the failing component tests**

```ts
it('draws one card per field, under its category', () => { … })
it('labels the two synthetic buckets in Serbian, and marks a retired option with †', () => { … })
it('a bar click sets categoryCode, fieldCode and optionCode together', async () => { … expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ search: expect.objectContaining({ categoryCode: 'REMONT_MOTORA', fieldCode: 'sklop_u_kvaru', optionCode: 'glava' }) })) })
it('the answer filter survives a period change', async () => { /* guards the `kept` literal */ })
it('the chip clears all three at once', async () => { … })
```

- [ ] **Step 2: Run them and watch them fail**

`TZ=UTC pnpm --filter internal-web test -- statistics-breakdown` → FAIL.

- [ ] **Step 3: Implement**

Reuse `BreakdownRankCard` and `collapseRankRowsForDisplay` unchanged. The two synthetic codes are labelled by the client (`m.statistika_field_unfilled()` / `m.statistika_field_predates()`); a bucket with `isActive: false` gets the existing † treatment.

⚠ **In `statistics-analytics-filters.tsx`, add `fieldCode` and `optionCode` to the `const kept = { kind, manufacturerId, categoryCode }` literal.** Without it the filter silently vanishes the moment the user changes the period — invisible until somebody complains.

- [ ] **Step 4: Green + mutation proof**

PASS. Then remove `fieldCode` from `kept` → the „survives a period change" test goes RED. Restore.

- [ ] **Step 5: Commit**

```bash
git add apps/internal-web packages/i18n
git commit -m "feat(statistics): the screen answers what failed, and one click asks everything else about it"
```

---

### Task 11: Admin — the office sets the dependency itself

**Files:**
- Modify: `apps/admin-web/src/resources/claim-category-field-options.definition.ts:70-100`
- Modify: `apps/admin-web/src/lib/resource/reference-select-registry.ts:21,67-77`

**Interfaces:**
- Consumes: Task 2's `parentOptionId` on create/update; Task 3's 422.
- Produces: registry key `claim-category-field-options`; a `parentOptionId` form field, editable (unlike `fieldId`, a dependency is a correction the office must be able to make).

- [ ] **Step 1: Registry entry**

```ts
  'claim-category-field-options': defineReferenceSelect<ClaimCategoryFieldOptionListItem>({
    queryOptions: () => claimCategoryFieldOptionsReferenceOptions({ activeOnly: true }),
    // "Generalni remont motora › Sklop u kvaru › Glava" — the whole path, because a bare option
    // name repeats across fields. The list is deliberately unfiltered: the registry has no
    // mechanism for one form field to narrow another, and the server refuses a wrong parent (422).
    toOptions: (items) => items.map((item) => ({
      value: item.id,
      label: `${item.fieldName} › ${item.name}`,
      keywords: item.code,
    })),
  }),
```

- [ ] **Step 2: Form field**

```ts
    {
      key: 'parentOptionId',
      label: () => m.field_claim_category_field_option_parent(),
      type: 'reference-select',
      referenceKey: 'claim-category-field-options',
      hint: () => m.admin_claim_category_field_options_parent_hint(),
    },
```

- [ ] **Step 3: Column**

Add a `parent` column rendering `item.parentOptionCode ?? '—'` so the office can see the dependency without opening each row.

- [ ] **Step 4: Verify in the browser**

Serve admin, create an option with a parent from another category → the screen must show the server's 422 sentence, not a blank failure.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-web packages/i18n
git commit -m "feat(admin): the office decides which cause belongs to which assembly"
```

---

### Task 12: i18n, docs, full gate, push

**Files:**
- Modify: `packages/i18n/src/messages/{sr,en}.json`
- Modify: `CLAUDE.md` (§2 invariant + the 78-option correction)

- [ ] **Step 1: Keys**

`claim_category_field_awaiting_parent` „Prvo izaberi: {field}" / "Choose {field} first" · `claim_detail_cause_missing` „Nije upisano šta je otkazalo — statistika ovu reklamaciju ne može da broji." / "Nobody wrote down what failed — statistics cannot count this claim." · `claim_detail_cause_fill` „DOPUNI" / "FILL IN" · `statistika_field_unfilled` „Nije upisano" / "Not filled" · `statistika_field_predates` „Uvedeno posle unosa" / "Introduced after entry" · `statistika_category_fields_section_title` „Po poljima kategorije" / "By category fields" · `statistika_answer_filter_chip` „{field}: {option}" / "{field}: {option}" · `field_claim_category_field_option_parent` „Zavisi od opcije" / "Depends on option" · `admin_claim_category_field_options_parent_hint` „Opcija drugog polja iste kategorije — ova opcija se nudi samo kad je ona izabrana." / "An option of another field of the same category — this option is offered only under it."

Then `pnpm --filter @mr/i18n run compile` **and** `pnpm --filter @mr/i18n run build` (a new key typechecks red until built).

- [ ] **Step 2: CLAUDE.md**

Extend the §2 category-fields invariant with: the dependency lives on the option (`parent_option_id`), the server refuses an answer without its parent, statistics reads the answers through `byCategoryFields` and any answer is a filter honoured by all sections through `buildActiveClaimWhere`. Correct 75 → **78** options.

- [ ] **Step 3: Full gate**

```bash
pnpm format:check \
  && TZ=UTC pnpm exec turbo run build typecheck lint --force --concurrency=2 \
  && TZ=UTC pnpm exec turbo run test --force --concurrency=1 \
  && pnpm --filter api depcruise && TZ=UTC pnpm test:integration
```

- [ ] **Step 4: Browser proof (Playwright from `apps/api/node_modules/playwright`)**

Enter a claim → the amber band appears → fill through the small window → the cause list narrows to the chosen assembly → the band disappears → `/statistika` draws the field cards → clicking a bar narrows „Po radniku" and the KPI row → the chip clears it.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "docs: the cause of a claim, and how statistics reads it"
git push
```
