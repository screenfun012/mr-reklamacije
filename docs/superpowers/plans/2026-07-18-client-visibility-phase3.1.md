# Client Visibility — Phase 3.1 (section markers + chip animation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Mark the specific claim-detail section(s) a client hasn't seen ("Novo" on Prilozi/Nalaz/Osnovni-podaci/Status) and add a gentle pulse to the list NEW/UPDATE chip.

**Architecture:** One new `emotive_claims.section_updated_at jsonb` map (`{photos,inspection,details,outcome}` → last-change ISO ts), bumped per-section at the exact Phase-3 bump sites. The client detail (`GET /api/emotive-claims/:id`) computes `sectionFreshness` booleans in SQL against the requesting client's current (pre-open) `emotive_claim_client_views.viewed_at`; the existing `recordClientView` runs AFTER, so markers show on this visit and clear next visit — no app-side timestamp juggling. The portal renders per-section "Novo" markers + a reduced-motion-aware chip pulse.

**Tech Stack:** Hono + Drizzle (Postgres), TanStack Start (React 19), Zod, Paraglide i18n, Vitest + real Postgres.

**Spec:** `docs/superpowers/specs/2026-07-18-client-visibility-phase3.1-section-markers-design.md`

## Global Constraints

- EMOTIVE only. DOMACE untouched.
- Sections + their triggers (identical to Phase 3's client-visible bump set, routed per key): `photos` = client-visible EMOTIVE attachment add/remove; `inspection` = `inspectionReport` edit; `details` = any of `warrantyReport, dateOfClaim, dateOfFinish, engineCode, engineTypeId, manufacturerId, employeeId, mrNumber`; `outcome` = Gate B publish. **Internal-only edits (internalNotes, faults, amounts) route to NO section** — same leak-prevention as Phase 3.
- Keep Phase 3's `client_content_updated_at` (whole-claim list badge) intact and bumped alongside the section key(s) at every site.
- `sectionFreshness[key]` is true iff the claim is openable AND `section_updated_at[key]` exists AND (`viewed_at` is null OR `section_updated_at[key] > viewed_at`). Full-view/internal actors get all-false. Raw `section_updated_at`/`viewed_at` NEVER leave the server — only the derived booleans.
- Ordering: `findById` computes `sectionFreshness` against the CURRENT `viewed_at`; the existing `recordClientView` (Phase 3) advances `viewed_at` AFTER — one visit clears both the list badge and the section markers.
- Migration: forward-only, drizzle-kit generated, proven from-zero, only the intended DDL, nullable/no-default (existing rows NULL → no marker burst).
- Parameterized `sql` only — no `sql.raw` with user input. The jsonb path keys come from a FIXED allowlist (`photos`/`inspection`/`details`/`outcome`), never user input; still bind them as parameters (`${'{'+key+'}'}::text[]`).
- i18n: any new string in BOTH `packages/i18n/src/messages/{sr,en}.json` (parity CI-enforced), Serbian informal. Colors via `mrp-*` tokens only. The chip pulse honors `prefers-reduced-motion` (no animation when reduced).
- No new permission → no prod seed.
- Known pre-existing integration flakes (reference-modules, outcome-email PK, http employeeName, statistics-rows crowding `claims kind=emotive`, users order) are documented drift (CLAUDE.md §8) — do not fix; exclude if they reproduce on the base commit.

---

## File Structure

- `packages/db/src/schema/claims.ts` — add `sectionUpdatedAt` jsonb column to `emotiveClaims`.
- `packages/db/migrations/0029_*.sql` (+ snapshot + journal) — generated.
- `apps/api/src/modules/emotive-claims/emotive-claims.repository.ts` — route section bumps (update/create/publish); `findById` SQL computes `section_freshness`.
- `apps/api/src/modules/attachments/attachments.{service,repository}.ts` — the photos-section bump at the client-visible-attachment choke point.
- `packages/shared/src/schemas/emotive-claim.schema.ts` — `sectionFreshness` on `EmotiveClaimDetailSchema`.
- `packages/shared/src/schemas/client-claim.schema.ts` — `sectionFreshness` on `ClientClaimDetailSchema` + carried in `toClientClaimDetail`.
- `apps/portal-web/src/routes/claims/$id.tsx` — per-section "Novo" markers.
- `apps/portal-web/src/features/claims/claim-card.tsx` (+ its CSS) — chip pulse animation.
- `packages/i18n/src/messages/{sr,en}.json` — `portal_section_new` marker label.

---

## Task 1: Migration — `section_updated_at jsonb`

**Files:** Modify `packages/db/src/schema/claims.ts`; Create `packages/db/migrations/0029_*.sql` (generated).

**Interfaces:** Produces `emotiveClaims.sectionUpdatedAt` (`jsonb('section_updated_at')`, nullable, `$type<Record<string, string>>()`).

- [ ] **Step 1:** In `claims.ts` `emotiveClaims`, next to `clientContentUpdatedAt`, add:
```ts
sectionUpdatedAt: jsonb('section_updated_at').$type<Record<string, string>>(),
```
(Import `jsonb` from `drizzle-orm/pg-core` if not already imported.)
- [ ] **Step 2:** `pnpm --filter @mr/db run db:generate`. Inspect `0029_*.sql`: it must contain ONLY `ALTER TABLE "emotive_claims" ADD COLUMN "section_updated_at" jsonb;` — nothing else, no default. If anything else, STOP + report drift. Confirm one new `0029` journal entry.
- [ ] **Step 3:** `pnpm test:integration --filter @mr/db` → green (from-zero `0000..0029`).
- [ ] **Step 4:** Commit `git add packages/db && git commit -m "feat(db): section_updated_at jsonb on emotive_claims (Phase 3.1 section markers)"`.

---

## Task 2: Repo — route per-section bumps

**Files:** Modify `apps/api/src/modules/emotive-claims/emotive-claims.repository.ts`, `apps/api/src/modules/attachments/attachments.{service,repository}.ts`. Test: `emotive-claims.integration.test.ts`, `attachments.integration.test.ts`.

**Interfaces:** Consumes `sectionUpdatedAt` (Task 1). Produces: after a client-visible change, `section_updated_at[<key>]` equals the write time for the changed section(s); internal-only edits leave it unchanged; `client_content_updated_at` still bumped alongside.

Helper (in the emotive repo) — build a `jsonb_set` chain for a fixed set of section keys, parameterized:
```ts
private bumpSectionsSql(keys: readonly string[]) {
  let expr = sql`COALESCE(${emotiveClaims.sectionUpdatedAt}, '{}'::jsonb)`
  for (const key of keys) {
    expr = sql`jsonb_set(${expr}, ${`{${key}}`}::text[], to_jsonb(now()))`
  }
  return expr
}
```

- [ ] **Step 1: Failing tests (emotive):** (a) update `inspectionReport` → `section_updated_at->>'inspection'` set, `'details'` absent; (b) update a details field (e.g. `engineCode`) → `'details'` set, `'inspection'` absent; (c) update both → both set; (d) update ONLY `internalNotes` → `section_updated_at` unchanged/null; (e) `publish` → `'outcome'` set; (f) create with `inspectionReport` → `'inspection'` set. Read the Phase-3 `client_content_updated_at` tests for the read pattern.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement (emotive repo).** In the UPDATE path, alongside the existing `client_content_updated_at` bump, collect section keys: `const sectionKeys: string[] = []; if (input.inspectionReport !== undefined) sectionKeys.push('inspection'); if (<any details field !== undefined>) sectionKeys.push('details');` and if non-empty `patch.sectionUpdatedAt = this.bumpSectionsSql(sectionKeys)`. In CREATE, build a plain map: `const created: Record<string,string> = {}; if (input.inspectionReport !== undefined && ...) created.inspection = nowIso; if (<details present>) created.details = nowIso;` and set `sectionUpdatedAt: Object.keys(created).length ? created : null` (use `new Date().toISOString()`). In `publish`'s `.set(...)`, add `sectionUpdatedAt: this.bumpSectionsSql(['outcome'])` (alongside the existing `clientContentUpdatedAt`).
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Failing test (attachments):** adding a client-visible EMOTIVE photo sets `section_updated_at->>'photos'`; internal document does NOT; deleting a client-visible photo sets it.
- [ ] **Step 6: Implement (attachments).** Extend the Phase-3 `bumpEmotiveClientContentUpdatedAt(claimId)` (called from `publishClaimAttachmentsChanged` when `clientVisible && Emotive`) to ALSO `jsonb_set` the `'photos'` key in the same `UPDATE emotive_claims SET client_content_updated_at = now(), section_updated_at = jsonb_set(COALESCE(section_updated_at, '{}'::jsonb), '{photos}'::text[], to_jsonb(now())) WHERE id = ${claimId}` (parameterized).
- [ ] **Step 7: Run — PASS** (both suites) + `pnpm --filter api typecheck`.
- [ ] **Step 8: Commit** `git add apps/api && git commit -m "feat(emotive-claims): route per-section content-change timestamps"`.

---

## Task 3: API — `sectionFreshness` on the client detail

**Files:** Modify `emotive-claims.repository.ts` (`findById` SQL), `packages/shared/src/schemas/emotive-claim.schema.ts`, `packages/shared/src/schemas/client-claim.schema.ts`. Test: `emotive-claims.integration.test.ts`, `client-claim.schema.test.ts`.

**Interfaces:** Consumes `sectionUpdatedAt` + `emotiveClaimClientViews`. Produces: `SectionFreshness = { photos: boolean; inspection: boolean; details: boolean; outcome: boolean }` on `EmotiveClaimDetail` + `ClientClaimDetail`; `findById` returns it computed per requesting client user (all-false for full-view).

- [ ] **Step 1: Schemas.** Add `sectionFreshness: z.object({ photos: z.boolean(), inspection: z.boolean(), details: z.boolean(), outcome: z.boolean() })` to `EmotiveClaimDetailSchema` and `ClientClaimDetailSchema`; in `toClientClaimDetail`, pass `sectionFreshness: detail.sectionFreshness` through. (Build `@mr/shared` after.)
- [ ] **Step 2: Failing tests.** For a `view_own_customer` client opening a claim: (a) a claim with `section_updated_at.photos` set and never-viewed → `sectionFreshness.photos === true`, others false; (b) after a view with `viewed_at >= section ts` → false; (c) Primljeno (not openable) → all false; (d) internal full-view actor → all false; (e) per-user isolation. Reuse the Phase-3 client-scope + view-seeding helpers.
- [ ] **Step 3: Implement (`findById` SQL).** In the emotive detail SELECT, when the scope is `own_customer`, LEFT JOIN `emotive_claim_client_views v ON v.emotive_claim_id = ec.id AND v.user_id = ${scope.userId}` and select:
```sql
jsonb_build_object(
  'photos',     ${openableExpr} AND ec.section_updated_at->>'photos'     IS NOT NULL AND (v.viewed_at IS NULL OR (ec.section_updated_at->>'photos')::timestamptz     > v.viewed_at),
  'inspection', ${openableExpr} AND ec.section_updated_at->>'inspection' IS NOT NULL AND (v.viewed_at IS NULL OR (ec.section_updated_at->>'inspection')::timestamptz > v.viewed_at),
  'details',    ${openableExpr} AND ec.section_updated_at->>'details'    IS NOT NULL AND (v.viewed_at IS NULL OR (ec.section_updated_at->>'details')::timestamptz    > v.viewed_at),
  'outcome',    ${openableExpr} AND ec.section_updated_at->>'outcome'    IS NOT NULL AND (v.viewed_at IS NULL OR (ec.section_updated_at->>'outcome')::timestamptz    > v.viewed_at)
) AS section_freshness
```
where `openableExpr = sql\`(ec.client_visible_at IS NOT NULL OR ec.published_at IS NOT NULL)\``. For a full-view scope, select the literal `jsonb_build_object('photos',false,'inspection',false,'details',false,'outcome',false) AS section_freshness` (no join). Map `section_freshness` onto the returned detail as `sectionFreshness`. This runs BEFORE the service's `recordClientView` (Phase 3), so it reads the pre-open `viewed_at`.
- [ ] **Step 4: Run — PASS** (`pnpm --filter @mr/shared build` first) + `pnpm --filter api typecheck`.
- [ ] **Step 5: Commit** `git add packages/shared apps/api && git commit -m "feat(emotive-claims): per-section sectionFreshness on the client detail"`.

---

## Task 4: Portal — section "Novo" markers + chip pulse

**Files:** Modify `apps/portal-web/src/routes/claims/$id.tsx`, `apps/portal-web/src/features/claims/claim-card.tsx` (+ styles), `packages/i18n/src/messages/{sr,en}.json`. Test: `apps/portal-web/src/features/claims/__tests__/` (detail-section render + chip animation).

**Interfaces:** Consumes `ClientClaimDetail.sectionFreshness` + `ClientClaimListItem.freshness`.

- [ ] **Step 1: i18n.** Add `"portal_section_new"` (sr `"Novo"`, en `"New"`) to both files (parity), matching key order. `pnpm --filter @mr/i18n build`.
- [ ] **Step 2: Failing tests.** (a) `$id.tsx` cards: with `sectionFreshness.photos === true`, `PhotosCard` shows the "Novo" marker; `inspection` → `InspectionCard`; `details` → `BasicsCard`/`ReportedProblemCard`; `outcome` → `TimelineCard`; all-false → no markers. (b) `claim-card.tsx`: a chip with `freshness` non-null has the pulse-animation class; under `prefers-reduced-motion` the animation is disabled (assert the class/CSS respects it — e.g. the keyframe is wrapped in a `@media (prefers-reduced-motion: no-preference)` or a `motion-reduce:animate-none` utility).
- [ ] **Step 3: Run — FAIL.**
- [ ] **Step 4: Implement.** In `$id.tsx`, thread `claim.sectionFreshness` to each card and render a small "Novo" marker (reuse the freshness-chip style / `mrp-*` tokens; the marker is the same visual language as the list chip). In `claim-card.tsx`, add a subtle pulse to the freshness chip via a Tailwind `animate-*` utility or a small keyframe in the portal CSS, guarded by `motion-reduce:animate-none` (or a `@media (prefers-reduced-motion: no-preference)` wrapper). No hardcoded colors.
- [ ] **Step 5: Run — PASS** + `pnpm --filter portal-web typecheck && pnpm --filter portal-web lint`.
- [ ] **Step 6: Commit** `git add apps/portal-web packages/i18n && git commit -m "feat(portal): section Novo markers + freshness-chip pulse"`.

---

## Task 5: Docs + full gate

**Files:** `CLAUDE.md` (§2 + §9).

- [ ] **Step 1: Docs.** §2: extend the Phase 3 freshness invariant with the per-section markers (`section_updated_at` jsonb, per-section "Novo" on the client detail, cleared on visit via the same `viewed_at`, internal edits mark nothing). §9: add a shipped-work bullet (migration 0029, section bump routing, `sectionFreshness` detail wire, portal markers + chip pulse; no permission/seed).
- [ ] **Step 2: Full gate** (`--force`):
```
pnpm format:check && pnpm exec turbo run build typecheck lint test --force && pnpm --filter api depcruise && pnpm test:integration
```
`format:write` if needed. A failure that is ONLY a documented known flake (reproduced on base) is not a gate failure — note it, don't fix. Any other failure is real.
- [ ] **Step 3: Commit** `git add -A && git commit -m "docs: record Phase 3.1 section markers + chip animation"`.

---

## Self-Review

- **Spec coverage:** §1 goals → animation (T4) + section markers (T2/T3/T4); §2 section map → T2 routing + T4 rendering; §3 data model → T1; §4 compute + ordering → T3 (SQL against pre-open viewed_at, recordClientView after); §5 wire + portal → T3/T4; §6 invariants (per-user, no-leak, openable gate, migration) → T1/T2/T3; §7 testing → each task; §8 build order → T1–T5. ✓
- **Placeholder scan:** real code in each step; the jsonb_set helper + the findById `jsonb_build_object` are concrete. ✓
- **Type consistency:** `SectionFreshness = {photos,inspection,details,outcome: boolean}` identical on `EmotiveClaimDetailSchema`, `ClientClaimDetailSchema`, `toClientClaimDetail`, and the SQL `section_freshness` keys; `sectionUpdatedAt` column name consistent T1→T2→T3; section keys `photos/inspection/details/outcome` identical across routing (T2), SQL (T3), and rendering (T4). ✓

## Out of scope (per spec)
"What's new" summary list; operator-facing markers; email; DOMACE; per-field granularity beyond the 4 sections.
