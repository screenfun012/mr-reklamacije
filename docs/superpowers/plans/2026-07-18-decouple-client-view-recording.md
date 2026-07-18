# Decouple client view-recording from the detail GET — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Make the client claim-detail GET a pure read, and record "seen" via an explicit `mark-seen` action that clears the NEW/UPDATE badge + section markers everywhere (list + detail) without a reload.

**Root cause (why the earlier per-surface fix whack-a-moled):** The detail GET records the client's view as a SIDE EFFECT, and the 30s-cached list/detail queries don't refetch after → badges linger until reload. Fixing the detail (drop its cache on unmount, commit `1e249e8`) left the dashboard list badge stale. The fix is to remove the write-on-read and record "seen" explicitly, then invalidate the freshness queries.

**Tech Stack:** Hono + Drizzle, TanStack Start (React 19) + React Query, Zod, Vitest + real Postgres.

## Global Constraints
- EMOTIVE only. No new permission, no migration, no seed. `recordClientView` (repo) already exists (Phase 3) — reuse it.
- The detail GET (`findById`) must become a PURE read (no `recordClientView`). "Seen" is recorded ONLY by the explicit `POST /api/emotive-claims/:id/mark-seen`.
- `mark-seen` records a view ONLY for an `own_customer` (client) scope AND only for a claim that scope can actually open (same Primljeno/access 404 gate as `findById`) — a client can't mark-seen a claim they can't access (404, don't leak existence). Full-view/internal actors: no-op (never had view state).
- Hover-prefetch must NOT mark-seen (it runs the loader/GET, not the mount effect) — this is the intended semantics win: seen = actually opened.
- Markers/badge still SHOW on first open, clear on re-entry + on returning to the dashboard, all without reload.
- Replace the `1e249e8` unmount-`removeQueries` patch with the clean mechanism (detail query `staleTime: 0` + `refetchOnWindowFocus: false`, safe now that the GET is a pure read) — do not leave both.
- Parameterized `sql` only. Known pre-existing flakes (CLAUDE.md §8) are not gate failures.

---

## Task 1: API — detail GET read-only + `POST /:id/mark-seen`

**Files:** `apps/api/src/modules/emotive-claims/emotive-claims.{service,controller,routes}.ts`. Test: `emotive-claims.integration.test.ts`, `emotive-claims.http.integration.test.ts`.

**Interfaces:** Produces `POST /api/emotive-claims/:id/mark-seen` (204) → records the client's view; `EmotiveClaimsService.markClientSeen(id, actor, auditContext?)`. `findById` no longer records a view.

- [ ] **Step 1:** Read `emotive-claims.service.ts findById` — it currently calls `this.repo.recordClientView(scope.userId, id)` (best-effort try/catch) after the Primljeno 404 gate. Read `changeOutcome`/`publish` for the verb-endpoint route+controller shape.
- [ ] **Step 2: Failing tests:** (a) calling `findById` for a client no longer creates an `emotive_claim_client_views` row (it's a pure read now); (b) `markClientSeen` (own_customer) upserts the view row (viewed_at≈now); (c) `markClientSeen` for a Primljeno / non-owned claim → NotFoundError (404); (d) `markClientSeen` for a full-view actor → no-op (no row); (e) HTTP: `POST /:id/mark-seen` → 204 for a client, 404 for an inaccessible claim; (f) end-to-end: seed a fresh section, `findById` → sectionFreshness true (does NOT clear it), then `markClientSeen`, then `findById` → sectionFreshness false (freshness/list badge clears only after mark-seen).
- [ ] **Step 3: Run — FAIL.**
- [ ] **Step 4: Implement.**
  - In `findById`, REMOVE the `if (scope.type === 'own_customer') { recordClientView... }` block (pure read).
  - Add `async markClientSeen(id, actor, auditContext): Promise<void>`: `const scope = resolveListScope(actor); const claim = await this.repo.findById(id, scope); if (claim === null) throw NotFoundError; if (scope.type === 'own_customer' && claim.clientVisibleAt === null && claim.publishedAt === null) throw NotFoundError('Emotive claim', id);` (the Primljeno gate) `if (scope.type === 'own_customer') await this.repo.recordClientView(scope.userId, id)` (no-op for `all`). Best-effort logging is unnecessary here (the client explicitly asked to mark seen; a failure can surface — but keep it from 500ing on a transient upsert race: wrap in try/catch + log, still return 204). Explicit return type.
  - `controller.markSeen`: parse `:id` (UUID, like siblings), call `service.markClientSeen(id, actor, auditContext)`, return `c.body(null, 204)`.
  - `routes.ts`: `routes.post('/:id/mark-seen', <the same view-permission middleware the detail GET uses — grep the detail route: view OR view_own_customer>, controller.markSeen)`.
- [ ] **Step 5: Run — PASS.** `pnpm --filter api typecheck` clean.
- [ ] **Step 6: Commit** `git add apps/api && git commit -m "refactor(emotive-claims): detail GET is read-only; record client view via explicit mark-seen endpoint"`.

---

## Task 2: Portal — mark-seen on open + clear badges everywhere

**Files:** `apps/portal-web/src/routes/claims/$id.tsx`, `packages/shared/src/queries/claims.ts` (detail query config + a mark-seen call helper). Test: `apps/portal-web/src/features/claims/__tests__/` (the detail cache/mark-seen test).

**Interfaces:** Consumes `POST /api/emotive-claims/:id/mark-seen`.

- [ ] **Step 1:** In `clientEmotiveClaimDetailOptions` (`packages/shared/src/queries/claims.ts`), set `staleTime: 0` and `refetchOnWindowFocus: false` (so re-entry refetches fresh sectionFreshness, but the markers don't vanish mid-visit on window focus). Keep the list/summary options unchanged.
- [ ] **Step 2:** In `ClaimDetailComponent` (`$id.tsx`): REMOVE the `1e249e8` `useEffect` that `removeQueries(detail(id))` on unmount. Add a mark-seen effect: on mount (once per id), `fetch`-POST `/api/emotive-claims/${id}/mark-seen` (use the app's `fetchJson`/mutation pattern — grep how the portal does mutations, e.g. the client PDF or any POST; a `useMutation` fired in a `useEffect`, or a small `useEffect` calling the POST then `queryClient.invalidateQueries`). On success: `queryClient.invalidateQueries({ queryKey: clientClaimKeys.list ??? prefix })` + the summary key, so the dashboard list badge + summary refetch and the just-seen claim's `freshness` clears. Do NOT invalidate the current `detail(id)` (that would clear the markers the client is looking at) — the detail clears on the NEXT entry via `staleTime: 0`.
   - Find the list key prefix to invalidate all pages: `clientClaimKeys` in `claims.ts` (e.g. invalidate `['emotive-claims','client-list']` prefix + `['emotive-claims','client-summary']`). Use the coarsest key that matches all list pages.
- [ ] **Step 3: Tests.** Update/replace the `1e249e8` test: (a) opening the detail (mount) POSTs `mark-seen` once (mock fetch, assert called with the id); (b) on mark-seen success, the list + summary queries are invalidated (assert via a spy or `queryClient` state); (c) mark-seen is NOT fired by a bare loader/prefetch (only on component mount). Keep the fixtures valid (sectionFreshness required).
- [ ] **Step 4: Run — PASS** + `pnpm --filter portal-web typecheck && pnpm --filter portal-web lint`. (Build `@mr/shared` if needed.)
- [ ] **Step 5: Commit** `git add apps/portal-web packages/shared && git commit -m "fix(portal): mark claim seen on open and clear list + detail freshness without reload"`.

---

## Task 3: Docs + full gate

- [ ] **Step 1: Docs.** `CLAUDE.md` §2/§9: note the detail GET is a pure read and "seen" is recorded via `POST /:id/mark-seen` (which invalidates the client list/summary), replacing the GET side-effect; the `1e249e8` unmount patch is superseded by detail `staleTime:0`.
- [ ] **Step 2: Full gate** (`--force`): `pnpm format:check && pnpm exec turbo run build typecheck lint test --force && pnpm --filter api depcruise && pnpm test:integration`. `format:write` if needed. A documented known flake reproduced on base is not a gate failure.
- [ ] **Step 3: Commit** `git add -A && git commit -m "docs: record the client mark-seen decoupling"`.

## Self-Review
- Root fixed: GET is a pure read (no whack-a-mole surface left — list + detail both clear via mark-seen invalidation + detail staleTime 0). ✓
- Prefetch no longer marks seen (mount-only). ✓
- Old patch removed, not left alongside. ✓
