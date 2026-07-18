# Client Visibility — Phase 3 (NEW/UPDATE freshness) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a per-client-user NEW/UPDATE freshness badge on the portal EMOTIVE claim list that clears when the client opens the claim and re-appears when client-visible content changes.

**Architecture:** A non-monotonic `client_content_updated_at` timestamp on `emotive_claims` (bumped on any client-visible content change) plus a per-user `emotive_claim_client_views` table (last-seen). The unified `/api/claims` list computes a `freshness: 'new' | 'update' | null` per row for the requesting client user via a LEFT JOIN + CASE; opening a claim detail upserts the view row. Portal renders a chip.

**Tech Stack:** Hono + Drizzle (Postgres), TanStack Start (React 19), Zod, Paraglide i18n, Vitest + real Postgres.

**Spec:** `docs/superpowers/specs/2026-07-18-client-visibility-phase3-freshness-design.md`

## Global Constraints

- EMOTIVE only. DOMACE has no portal — its list branch selects `NULL` freshness; do not add columns/behavior to DOMACE.
- Freshness label semantics (Nikola-confirmed): badge shows when the claim is **openable** (`client_visible_at IS NOT NULL OR published_at IS NOT NULL`) **AND** `client_content_updated_at IS NOT NULL` **AND** (the user never viewed it **OR** `client_content_updated_at > viewed_at`). Label = **`new`** while `published_at IS NULL`, **`update`** while published. A Primljeno claim never shows a badge.
- Raw `client_content_updated_at` / `viewed_at` **never** leave the server — only the derived `'new' | 'update' | null` is whitelisted onto the client wire (same rule Phase 2 used for the gate timestamps).
- Internal-only content changes (internal notes, faults, amounts, any non-whitelisted field) must **never** bump `client_content_updated_at`. Only whitelisted client-visible fields, a client-visible attachment add/remove, Gate A, and Gate B publish bump it.
- `client_content_updated_at` is **not monotonic** — overwritten to `now()` on every qualifying change (unlike Phase 2's monotonic `client_visible_at`).
- No badge burst on deploy: existing rows backfill `client_content_updated_at = NULL`; the badge requires it non-null.
- No new permission this phase. No prod seed needed after deploy.
- Migration: forward-only, **drizzle-kit generated (never hand-written SQL)**, proven migrate-from-zero, only the intended DDL. Migration + schema touched only with the DDL verified before apply.
- Parameterized `sql` only — no `sql.raw` with user input (aliases-only `sql.raw` as already used in the repo is fine).
- i18n: any new user-facing string in BOTH `packages/i18n/src/messages/{sr,en}.json` (parity is CI-enforced), Serbian primary informal "ti". Colors via `mrp-*` (portal) tokens only — no hardcoded palette.
- Known pre-existing integration flakes (reference-modules `usageCount`, `emotive-claims.outcome-email` `app_settings` PK, users order-dependence) are documented drift (CLAUDE.md §8) — do not "fix" them; exclude from gate judgement if they reproduce on the base commit.

---

## File Structure

- `packages/db/src/schema/claims.ts` — add `clientContentUpdatedAt` column to `emotiveClaims`.
- `packages/db/src/schema/emotive-claim-client-views.ts` (**new**) — the views table; export from `packages/db/src/schema/index.ts`.
- `packages/db/migrations/0028_*.sql` (+ snapshot + journal) — generated.
- `packages/shared/src/enums.ts` — `ClaimFreshness` const + `claimFreshnessValues`.
- `packages/shared/src/schemas/emotive-claim.schema.ts` — `freshness` on `EmotiveClaimListItemSchema`.
- `packages/shared/src/schemas/client-claim.schema.ts` — `freshness` on `ClientClaimListItemSchema` + carried in `toClientClaimListItem`.
- `apps/api/src/modules/emotive-claims/emotive-claims.repository.ts` — bump `client_content_updated_at` in the update + create + publish writes; `recordClientView`.
- `apps/api/src/modules/emotive-claims/emotive-claims.service.ts` — record view on client `findById`.
- `apps/api/src/modules/attachments/attachments.service.ts` — bump on client-visible emotive attachment add/remove (in `publishClaimAttachmentsChanged`).
- `apps/api/src/modules/attachments/attachments.repository.ts` — a bump helper (or reuse the emotive repo via the container).
- `apps/api/src/modules/claims/claims.repository.ts` — freshness LEFT JOIN + CASE in `buildEmotiveBranch`; `NULL` in `buildDomaceBranch`; map in `mapUnifiedRow`.
- `apps/portal-web/src/features/claims/claim-card.tsx` + `dashboard-cards.tsx` — render the chip.
- `packages/i18n/src/messages/{sr,en}.json` — `portal_freshness_new` / `portal_freshness_update`.

---

## Task 1: Migration — `client_content_updated_at` + `emotive_claim_client_views`

**Files:**
- Modify: `packages/db/src/schema/claims.ts` (add column to `emotiveClaims`)
- Create: `packages/db/src/schema/emotive-claim-client-views.ts`
- Modify: `packages/db/src/schema/index.ts` (export the new table)
- Create: `packages/db/migrations/0028_*.sql` (+ `meta/0028_snapshot.json`, `meta/_journal.json`) — **generated**
- Test: the emotive integration suite exercises the columns in later tasks; this task's proof is a clean migrate-from-zero.

**Interfaces:**
- Produces: `emotiveClaims.clientContentUpdatedAt` (`timestamp('client_content_updated_at', { withTimezone: true, mode: 'date' })`, nullable); table `emotiveClaimClientViews { userId uuid, emotiveClaimId uuid, viewedAt timestamptz, PK(userId, emotiveClaimId) }`, both FKs `ON DELETE CASCADE`, index `idx_emotive_claim_client_views_claim_id` on `emotiveClaimId`.

- [ ] **Step 1: Add the column.** In `packages/db/src/schema/claims.ts`, in the `emotiveClaims` table (next to `clientVisibleAt` / `publishedAt`), add:
```ts
clientContentUpdatedAt: timestamp('client_content_updated_at', { withTimezone: true, mode: 'date' }),
```

- [ ] **Step 2: Create the views table.** `packages/db/src/schema/emotive-claim-client-views.ts`:
```ts
import { foreignKey, index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'

import { emotiveClaims } from './claims.js'
import { users } from './access-control.js'

export const emotiveClaimClientViews = pgTable(
  'emotive_claim_client_views',
  {
    userId: uuid('user_id').notNull(),
    emotiveClaimId: uuid('emotive_claim_id').notNull(),
    viewedAt: timestamp('viewed_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.emotiveClaimId] }),
    foreignKey({
      name: 'emotive_claim_client_views_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'emotive_claim_client_views_claim_id_fkey',
      columns: [t.emotiveClaimId],
      foreignColumns: [emotiveClaims.id],
    }).onDelete('cascade'),
    index('idx_emotive_claim_client_views_claim_id').on(t.emotiveClaimId),
  ],
)
```
Match the import style/paths already used in `packages/db/src/schema/access-control.ts` (grep it first; `users` lives there). Export the table from `packages/db/src/schema/index.ts` alongside the other exports.

- [ ] **Step 3: Generate the migration.** Run `pnpm --filter @mr/db run db:generate`. Inspect the generated `0028_*.sql`: it must contain ONLY `ALTER TABLE "emotive_claims" ADD COLUMN "client_content_updated_at" timestamp with time zone;`, `CREATE TABLE "emotive_claim_client_views" (...)`, its two FKs, and the index — no other tables/columns touched, no `client_content_updated_at` default, no data migration. If the diff includes anything else, STOP and report (schema drift). Confirm `meta/_journal.json` gained exactly one `0028` entry.

- [ ] **Step 4: Prove migrate-from-zero.** Run `pnpm test:integration --filter @mr/db` (the global setup migrates from zero on `mr_reklamacije_test`). Expected: green — the full `0000..0028` chain applies cleanly on an empty DB. (Extensions `uuid-ossp`, `pgcrypto`, `citext`, `pg_trgm` are installed by the integration setup, not migrations.)

- [ ] **Step 5: Commit** `git add packages/db && git commit -m "feat(db): client_content_updated_at + emotive_claim_client_views (Phase 3 freshness)"`.

---

## Task 2: Repo — bump `client_content_updated_at` on client-visible content changes

**Files:**
- Modify: `apps/api/src/modules/emotive-claims/emotive-claims.repository.ts` (update + create paths; a `bumpClientContentUpdatedAt` helper)
- Modify: `apps/api/src/modules/attachments/attachments.service.ts` (`publishClaimAttachmentsChanged` also bumps for client-visible emotive attachments)
- Modify: `apps/api/src/modules/attachments/attachments.repository.ts` (a `bumpEmotiveClientContentUpdatedAt(claimId)` method, or expose the emotive repo method via the container — pick whichever matches the existing wiring; the attachments repo already has `findEmotiveClaimCustomerId`, so add the bump next to it)
- Test: `apps/api/src/modules/emotive-claims/__tests__/emotive-claims.integration.test.ts`, `apps/api/src/modules/attachments/__tests__/attachments.integration.test.ts`

**Interfaces:**
- Consumes: `emotiveClaims.clientContentUpdatedAt` (Task 1).
- Produces: after any client-visible content change the claim's `client_content_updated_at` equals the write time; internal-only edits leave it unchanged.

**Whitelisted (client-visible) emotive fields** — bump when the update patch touches ANY of these (they are exactly the fields the client wire exposes via `ClientClaimDetailSchema`): `warrantyReport`, `inspectionReport`, `dateOfClaim`, `dateOfFinish`, `engineCode`, `engineTypeId`, `manufacturerId`, `employeeId`, `mrNumber`. **Do NOT bump** for `internalNotes`, faults, `sourceId`, `claimNumber`, or amount fields.

- [ ] **Step 1: Failing tests (emotive):** (a) updating a claim's `inspectionReport` (non-empty) sets `client_content_updated_at` to the write time (capture `now`, assert non-null and advanced); (b) updating only `internalNotes` leaves `client_content_updated_at` unchanged (null if it was null); (c) `publish` (Gate B) sets `client_content_updated_at`; (d) creating a claim with a whitelist field filled sets it. Read the Phase-2 Gate A tests in the same file for the seeding/read pattern (they read `client_visible_at` the same way).

- [ ] **Step 2: Run — verify FAIL.** `cd apps/api && npx vitest run --config vitest.integration.config.ts src/modules/emotive-claims/__tests__/emotive-claims.integration.test.ts`

- [ ] **Step 3: Implement (emotive repo).** In the UPDATE path, after the existing `patch` is assembled (the same block that sets `patch.clientVisibleAt` for Gate A), add: if the incoming input touches any whitelisted field (compute `const touchesClientVisible = [input.warrantyReport, input.inspectionReport, input.dateOfClaim, input.dateOfFinish, input.engineCode, input.engineTypeId, input.manufacturerId, input.employeeId, input.mrNumber].some((v) => v !== undefined)`), set `patch.clientContentUpdatedAt = new Date()`. In the CREATE `.values({...})`, set `clientContentUpdatedAt: touchesClientVisibleCreate ? new Date() : null` using the same field set on `input`. In the `publish` method's UPDATE `.set(...)`, add `clientContentUpdatedAt: new Date()`. Use `new Date()` (column `mode: 'date'`), consistent with the sibling date columns. Keep everything inside the existing single transaction/UPDATE — no extra write.

- [ ] **Step 4: Run — verify PASS.**

- [ ] **Step 5: Failing test (attachments):** adding a client-visible photo to an EMOTIVE claim bumps its `client_content_updated_at`; adding an INTERNAL document does not; deleting a client-visible photo bumps it. Use the attachments suite's existing upload/delete + emotive-claim seeding helpers.

- [ ] **Step 6: Implement (attachments).** In `attachments.service.ts` `publishClaimAttachmentsChanged`, when `clientVisible && claimKind === ClaimKind.Emotive`, also bump the claim's `client_content_updated_at` (call the attachments-repo helper / emotive repo). This single choke point already runs for both `upload` (`items.some(isClientVisibleClaimAttachment)`) and `delete` (`isClientVisibleClaimAttachment(attachment)`), so it covers add + remove.

- [ ] **Step 7: Run — verify PASS** (both suites) + `pnpm --filter api typecheck`.

- [ ] **Step 8: Commit** `git add apps/api && git commit -m "feat(emotive-claims): bump client_content_updated_at on client-visible content changes"`.

---

## Task 3: Shared + API — `freshness` on the client list

**Files:**
- Modify: `packages/shared/src/enums.ts` (`ClaimFreshness` + `claimFreshnessValues`)
- Modify: `packages/shared/src/schemas/emotive-claim.schema.ts` (`freshness` on `EmotiveClaimListItemSchema`)
- Modify: `packages/shared/src/schemas/client-claim.schema.ts` (`freshness` on `ClientClaimListItemSchema`; carry it in `toClientClaimListItem`)
- Modify: `apps/api/src/modules/claims/claims.repository.ts` (`buildEmotiveBranch` freshness CASE + LEFT JOIN; `buildDomaceBranch` NULL; `mapUnifiedRow`)
- Test: `apps/api/src/modules/claims/__tests__/claims.integration.test.ts`, `packages/shared/src/schemas/__tests__/client-claim.schema.test.ts`

**Interfaces:**
- Consumes: `emotiveClaims.clientContentUpdatedAt` (Task 1), `emotive_claim_client_views` (Task 1).
- Produces: `ClaimFreshness = { New: 'new', Update: 'update' }`; `EmotiveClaimListItem.freshness: ClaimFreshness | null`; `ClientClaimListItem.freshness: ClaimFreshness | null`; the unified list returns `freshness` per row (computed for the requesting client user, `null` for internal/full-view and for DOMACE).

- [ ] **Step 1: Shared enum.** In `packages/shared/src/enums.ts` (next to `ClientClaimPhase`):
```ts
export const ClaimFreshness = { New: 'new', Update: 'update' } as const
export type ClaimFreshness = (typeof ClaimFreshness)[keyof typeof ClaimFreshness]
export const claimFreshnessValues = [ClaimFreshness.New, ClaimFreshness.Update] as const
```

- [ ] **Step 2: Schemas.** In `emotive-claim.schema.ts`, add to `EmotiveClaimListItemSchema` (next to `clientVisibleAt`/`publishedAt`): `freshness: z.enum(claimFreshnessValues).nullable(),`. In `client-claim.schema.ts`, add `freshness: z.enum(claimFreshnessValues).nullable(),` to `ClientClaimListItemSchema`, and in `toClientClaimListItem` set `freshness: item.kind === ClaimKind.Emotive ? item.freshness : null` (narrow on kind; DOMACE never reaches a client but keeps TS total).

- [ ] **Step 3: Failing test (shared projection).** In `client-claim.schema.test.ts`, an emotive `ClaimListItem` with `freshness: 'update'` projects to a `ClientClaimListItem` with `freshness: 'update'`; `null` stays `null`. (These prove the projection carries the field; the SQL computation is proven in Step 5.)

- [ ] **Step 4: Failing test (unified repo).** In `claims.integration.test.ts`, for a `view_own_customer` client: (a) a claim that is openable, has `client_content_updated_at` set, never viewed → `freshness: 'new'` while unpublished, `'update'` once published; (b) after inserting an `emotive_claim_client_views` row with `viewed_at >= client_content_updated_at` → `freshness: null`; (c) a claim with `client_content_updated_at = NULL` → `freshness: null`; (d) a Primljeno claim (both gates null) → `freshness: null`; (e) a full-view internal actor → `freshness: null`; (f) user A's view row does not change user B's freshness. Read the existing claims.integration tests for the client-scope seeding pattern.

- [ ] **Step 5: Implement (repo).** In `buildEmotiveBranch(query, customerIds)` add a `viewerUserId: string | null` parameter. When non-null, add `LEFT JOIN emotive_claim_client_views v ON v.emotive_claim_id = ec.id AND v.user_id = ${viewerUserId}` and select the freshness CASE:
```sql
CASE
  WHEN ec.client_visible_at IS NULL AND ec.published_at IS NULL THEN NULL
  WHEN ec.client_content_updated_at IS NULL THEN NULL
  WHEN v.viewed_at IS NOT NULL AND ec.client_content_updated_at <= v.viewed_at THEN NULL
  WHEN ec.published_at IS NULL THEN ${ClaimFreshness.New}
  ELSE ${ClaimFreshness.Update}
END AS freshness
```
When `viewerUserId` is null, select `NULL::text AS freshness` (no JOIN). In `buildDomaceBranch`, select `NULL::text AS freshness` (keep UNION column parity — one added column in every branch). In `mapUnifiedRow`, map `freshness` (a nullable text) onto the emotive item; leave DOMACE items without it. In `buildUnionBranches`, pass `scope.emotiveCustomerScope === 'own_customer' ? scope.userId : null` as `viewerUserId`. Interpolate `${ClaimFreshness.New}` / `${ClaimFreshness.Update}` as parameterized `sql` values (not `sql.raw`).

- [ ] **Step 6: Run — verify PASS** (shared + claims integration). Build shared first: `pnpm --filter @mr/shared build`, then `pnpm --filter api typecheck` + the claims integration file.

- [ ] **Step 7: Commit** `git add packages/shared apps/api && git commit -m "feat(claims): per-client-user NEW/UPDATE freshness on the unified list"`.

---

## Task 4: API — record the view on client detail open

**Files:**
- Modify: `apps/api/src/modules/emotive-claims/emotive-claims.repository.ts` (`recordClientView`)
- Modify: `apps/api/src/modules/emotive-claims/emotive-claims.service.ts` (`findById` records the view for a client)
- Test: `apps/api/src/modules/emotive-claims/__tests__/emotive-claims.integration.test.ts`

**Interfaces:**
- Consumes: `emotive_claim_client_views` (Task 1), `EmotiveClaimsListScope = { type: 'all' } | { type: 'own_customer'; userId: string }`.
- Produces: `EmotiveClaimsRepository.recordClientView(userId: string, claimId: string): Promise<void>` (upsert `viewed_at = now()`).

- [ ] **Step 1: Failing test.** A `view_own_customer` client opening an openable claim's detail creates/updates its `emotive_claim_client_views` row with `viewed_at ≈ now`; opening it again advances `viewed_at`; a full-view internal actor's `findById` does NOT create a view row; and (integration) after a client opens the claim, its `freshness` (via the list query from Task 3) becomes `null`.

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement.** Add `recordClientView(userId, claimId)` to the repo: `insert(emotiveClaimClientViews).values({ userId, emotiveClaimId: claimId, viewedAt: new Date() }).onConflictDoUpdate({ target: [emotiveClaimClientViews.userId, emotiveClaimClientViews.emotiveClaimId], set: { viewedAt: new Date() } })`. In `service.findById`, after the Primljeno 404 gate passes, if `scope.type === 'own_customer'`, call `await this.repo.recordClientView(scope.userId, id)` before returning — wrap it so a view-write failure is logged (via the injected logger) and does not break the read (`try/catch`, log, continue). Do not record for `type === 'all'`.

- [ ] **Step 4: Run — verify PASS** + `pnpm --filter api typecheck`.

- [ ] **Step 5: Commit** `git add apps/api && git commit -m "feat(emotive-claims): record client view on detail open (clears freshness)"`.

---

## Task 5: Portal — NEW/UPDATE chip + i18n

**Files:**
- Modify: `apps/portal-web/src/features/claims/claim-card.tsx` (render the chip)
- Modify: `apps/portal-web/src/features/claims/dashboard-cards.tsx` (if the card is rendered there / list wiring)
- Modify: `packages/i18n/src/messages/sr.json` + `en.json` (`portal_freshness_new`, `portal_freshness_update`)
- Test: `apps/portal-web/src/features/claims/__tests__/claim-card.test.tsx`

**Interfaces:**
- Consumes: `ClientClaimListItem.freshness: 'new' | 'update' | null` (Task 3).

- [ ] **Step 1: i18n.** Add to BOTH `sr.json` and `en.json` (parity): `"portal_freshness_new"` (sr: "Novo", en: "New"), `"portal_freshness_update"` (sr: "Ažurirano", en: "Update"). Match the file's key ordering/format; run the app's i18n check if one exists.

- [ ] **Step 2: Failing test.** In `claim-card.test.tsx` (create if absent; the Phase 2 portal tests live in `apps/portal-web/src/features/claims/__tests__/`): a claim with `freshness: 'new'` renders the "Novo/New" chip; `'update'` renders "Ažurirano/Update"; `null` renders no chip. Assert via `getByText` / `queryByText`.

- [ ] **Step 3: Run — verify FAIL.**

- [ ] **Step 4: Implement.** In `claim-card.tsx`, when `claim.freshness !== null`, render a small chip (reuse the existing chip/pill styling used for `clientPhase`; a subtle `mrp-*` info/accent tone — grep the card for the existing status chip and mirror it; no hardcoded palette). Label from `claim.freshness === ClaimFreshness.New ? m.portal_freshness_new() : m.portal_freshness_update()`. The chip sits alongside the existing status chip; a Primljeno (non-clickable) card gets `freshness: null` from the server so no chip appears there.

- [ ] **Step 5: Run — verify PASS** + `pnpm --filter portal-web typecheck && pnpm --filter portal-web lint`.

- [ ] **Step 6: Commit** `git add apps/portal-web packages/i18n && git commit -m "feat(portal): NEW/UPDATE freshness chip on the claim list"`.

---

## Task 6: Docs + full gate

**Files:** `CLAUDE.md` (§2 + §9: record the Phase 3 freshness model), the Phase 3 spec/plan reference.

- [ ] **Step 1: Docs.** In `CLAUDE.md` §2, extend the Phase 2 client-visibility invariant with the freshness rule (per-client-user `emotive_claim_client_views` + `client_content_updated_at`; badge `new` while private / `update` once published; clears on open; internal-only edits never bump; EMOTIVE only). In §9, add a shipped-work bullet (columns/table, the unified-list freshness CASE, the view-on-open record, portal chip; note NO new permission / NO prod seed needed).

- [ ] **Step 2: Full gate** (all exit 0; `--force` per CLAUDE.md):
```
pnpm format:check && pnpm exec turbo run build typecheck lint test --force && pnpm --filter api depcruise && pnpm test:integration
```
If `format:check` fails, `pnpm format:write` then re-check. If a failure is ONLY a documented known flake reproducing on the base commit, note it — do not fix unrelated flakes. Any other failure is a real gate failure to fix.

- [ ] **Step 3: Commit** `git add -A && git commit -m "docs: record the Phase 3 client freshness (NEW/UPDATE) model"`.

---

## Self-Review

- **Spec coverage:** §2 data model → T1; §3 bump triggers → T2; §4 badge computation → T3; §5 clear-on-view → T4; §6 no-burst (null backfill + non-null gate) → T1 (backfill null) + T3 (CASE guards `client_content_updated_at IS NULL`); §7 portal chip → T5; §9 invariants (per-user, no internal leak, FK cascade) → T1/T2/T4; §10 testing → each task; docs → T6. ✓ No spec section unmapped.
- **Placeholder scan:** every code step carries real code/paths; no TBD. Attachment bump reuses the existing `publishClaimAttachmentsChanged` choke point (real). ✓
- **Type consistency:** `ClaimFreshness`/`claimFreshnessValues` defined in T3 Step 1, consumed by both schemas + the repo CASE + the portal; `freshness: ClaimFreshness | null` identical across `EmotiveClaimListItemSchema`, `ClientClaimListItemSchema`, and `mapUnifiedRow`; `recordClientView(userId, claimId)` defined T4, called T4; `clientContentUpdatedAt` column name consistent T1→T2→T3. ✓

## Out of scope (per spec §8)
Operator-facing "client has/hasn't seen" indicator; content-change email; per-field badge granularity; dashboard count re-scoping. Not this phase.
