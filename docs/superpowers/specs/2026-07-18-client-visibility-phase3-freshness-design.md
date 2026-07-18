# Client Visibility — Phase 3: NEW / UPDATE freshness (design)

> Builds directly on the shipped Phase 2 (`e7d9f77`) EMOTIVE client-visibility model
> (`client_visible_at` / `published_at` gates, `clientPhase` on the wire, outcome masking,
> 404 detail-gate). This phase adds per-client-user freshness badges to the portal claim list.
> Approved with Nikola 2026-07-18. EMOTIVE only — DOMACE has no portal.

## 1. Goal

A client scanning their portal claim list should see, at a glance, which claims have something
they haven't seen yet:

- **NEW** — the claim is openable and the client has never opened it (or content changed since
  their last view), **and it is not yet published**.
- **UPDATE** — same "there's something you haven't seen" condition, **but the claim is published**.
- **No badge** — the client has already seen the current state, or the claim is not openable
  (Primljeno), or it is a pre-Phase-3 claim with no recorded content-change yet.

The badge clears the moment the client opens the claim, and reappears if the operator later
changes client-visible content.

## 2. Data model (EMOTIVE)

### New column on `emotive_claims`
- `client_content_updated_at timestamptz NULL` — the time client-visible content last changed.
  Bumped to `now()` on the trigger set in §3. **Null for all existing rows** (backfill; see §6) so
  the deploy does not light a badge on every historical claim.

### New table `emotive_claim_client_views`
Per-client-user "last seen" tracking. Keyed **per user (account)**, not per customer — future-proofs
parent/child firms (today usually 1 account = 1 firm), and it is the account that opens the claim.

```
emotive_claim_client_views(
  user_id           uuid        not null,   -- fk users(id)            on delete cascade
  emotive_claim_id  uuid        not null,   -- fk emotive_claims(id)   on delete cascade
  viewed_at         timestamptz not null,
  primary key (user_id, emotive_claim_id)
)
```

> Note: `emotive_claims.id` is `uuid` (defaultRandom), so the FK is **uuid**, not the `bigint`
> the earlier v2 sketch wrote. Index: the PK `(user_id, emotive_claim_id)` covers the per-user
> lookup; add `idx_emotive_claim_client_views_claim_id` on `emotive_claim_id` for the cascade /
> future reverse lookups (FKs are not auto-indexed by Drizzle).

### Migration
Forward-only, drizzle-kit generated, proven migrate-from-zero. Adds the column + the table +
its index. Backfill: `client_content_updated_at` stays NULL for existing rows (see §6). DOMACE
untouched.

## 3. What bumps `client_content_updated_at` (client-visible content only)

Set `client_content_updated_at = now()` in the same write, whenever **content the client can
actually see** changes — regardless of the claim's current stage (the badge's own gating in §4
decides when it actually surfaces; bumping a still-Primljeno claim is harmless and correctly makes
it read NEW the moment Gate A opens it):

- an edit to any **whitelisted (client-visible) field** — the warranty/description narrative, the
  **inspection report**, dates, engine info, technician/employee name — i.e. any field that appears
  in `ClientClaimListItemSchema` / `ClientClaimDetailSchema`;
- a **client-visible attachment** added or removed;
- the **Gate A** transition (`client_visible_at` first set) — the claim becoming visible is itself
  the first "new" moment (in practice this coincides with the inspection-report edit that fires
  Gate A, but state it explicitly so a claim made visible by any path gets a NEW badge);
- the **Gate B** publish (`published_at` set) — the reveal is a change worth signaling (this is
  what flips a still-unseen claim's label from NEW to UPDATE, and re-surfaces the badge for a
  client who had already seen the in-progress state).

**Explicitly does NOT bump** (internal-only, the client never sees these, so they must not ping):
internal notes, fault attribution, repair amounts, or any non-whitelisted field. Editing internal
notes must never produce a client badge.

This bump is a repository-layer concern: it rides the existing UPDATE (no second write), the same
way Phase 2's Gate A monotonic `client_visible_at` does. Unlike `client_visible_at`, this column is
**not monotonic** — it is overwritten to `now()` on every qualifying change.

## 4. Badge computation (server, per requesting client user)

The client claim **list** projection gains a `freshness` field: `'new' | 'update' | null`.

Computed per item, for the requesting user, as:

```
freshnessFor(claim, viewedAt):        # viewedAt = this user's row in emotive_claim_client_views, or null
  if not openable(claim):             return null   # Primljeno (both gates null) → no badge, can't open
  if claim.client_content_updated_at is null: return null   # no recorded fresh content (e.g. backfilled)
  hasUnseen = (viewedAt is null) or (claim.client_content_updated_at > viewedAt)
  if not hasUnseen:                   return null
  return (claim.published_at is null) ? 'new' : 'update'
```

- `openable(claim)` = `client_visible_at IS NOT NULL OR published_at IS NOT NULL` (same predicate
  as Phase 2's detail gate).
- The list query LEFT JOINs `emotive_claim_client_views` on `(emotive_claim_id, user_id = requester)`
  to get `viewedAt`; a full-view internal actor (not a client) gets `freshness: null` always (the
  badge is a portal/client concept).
- Raw `client_content_updated_at` / `viewed_at` timestamps **never** leave the server — only the
  derived `'new' | 'update' | null` is whitelisted onto the wire, consistent with Phase 2 keeping
  the gate timestamps internal.

## 5. Clearing on view

When the client opens a claim's detail (`GET /api/emotive-claims/:id` for a client-scoped user),
the service upserts `emotive_claim_client_views (user_id, emotive_claim_id, viewed_at = now())`
`ON CONFLICT (user_id, emotive_claim_id) DO UPDATE SET viewed_at = now()`.

- The `user_id` is the authenticated user's id (never client-supplied) — no spoofing.
- Only client-scoped (`view_own_customer`) detail reads record a view; internal full-view reads do
  not (an operator previewing a claim must not clear the client's badge).
- The upsert is best-effort relative to the read: the detail response returns regardless; a failed
  view-write is logged, not surfaced (it only means the badge lingers until the next open).
- Because the badge SHOW condition compares `client_content_updated_at > viewed_at`, a later
  content change (new `now()` > the recorded `viewed_at`) re-surfaces the badge automatically — no
  extra bookkeeping.

## 6. No badge burst on deploy

`emotive_claim_client_views` starts empty, so every openable claim would read as "never viewed."
To avoid lighting NEW/UPDATE on every historical claim the day this ships, the badge SHOW condition
requires `client_content_updated_at IS NOT NULL`, and existing rows are **backfilled to NULL**.
Result: historical claims show no badge until the operator next changes their client-visible content
(which sets the timestamp). New/active claims get the timestamp at Gate A onward and badge correctly.
No per-user view seeding needed.

## 7. Portal (client) rendering

- The claims **list/table + the dashboard claim cards** render the badge from the wire `freshness`
  field: a small `NEW` / `UPDATE` chip on the card, using existing `mrp-*` tokens (info/accent tone
  — design polish during build; no hardcoded palette colors).
- The badge sits alongside the existing Phase 2 `clientPhase` status; they are independent (phase =
  where the claim is; freshness = whether you've seen the current state).
- A `Received`/Primljeno card is non-clickable (Phase 2) and shows no freshness badge (not openable).
- Opening the claim (navigating to detail) triggers the server-side view record (§5); on the next
  list load the badge is gone. No optimistic client-side clearing — invalidate-and-refetch, matching
  the SSE-is-signal-only contract.

## 8. Scope / non-goals

- **EMOTIVE only.** DOMACE has no portal and is untouched.
- **No operator-facing "client has/hasn't seen this"** indicator (possible future nicety; not now).
- **No email/notification** on content change — the badge is the only signal here (outcome email is
  Phase 2's, unchanged).
- **No per-field granularity** in the badge — one freshness signal per claim, whatever changed.
- Dashboard **counts** (Phase 2 `client-summary`) are not re-scoped for freshness; the badge is a
  per-claim list affordance.

## 9. Security / correctness invariants

- The freshness field is derived **server-side per authenticated user**; the wire never carries raw
  view timestamps or another user's view state.
- View records are keyed to the authenticated user id; a client cannot mark another user's claim
  seen, nor read a claim they can't already access (the Phase 2 404 gate still fronts every detail
  read, and the view upsert happens only after that gate passes).
- Internal-only content changes never bump freshness (§3) — no information about internal edits
  leaks via the badge.
- All FKs `ON DELETE CASCADE` (a deleted user or hard-deleted claim drops its view rows); business
  claims are soft-deleted, so `deleted_at` filtering on the list still applies before freshness.

## 10. Testing

- **Integration (real Postgres):** each bump trigger sets `client_content_updated_at` (whitelist
  edit, client-visible attachment add/remove, Gate A, publish) and each internal-only edit does NOT;
  badge computation returns `new` before publish / `update` after / `null` when seen or not-openable
  or backfilled-null; opening detail records the view and clears the badge; a subsequent change
  re-surfaces it; a Primljeno claim never shows a badge; the deploy-safe null backfill shows no badge
  until first change; per-user isolation (user A's view doesn't clear user B's badge).
- **Portal component:** the list/card renders NEW vs UPDATE vs no-badge from `freshness`; the chip
  uses tokens, sr/en parity for any new label strings.
- **Migration:** proven migrate-from-zero (the integration global setup validates the chain).

## 11. Build order (each its own reviewed task, subagent-driven)

1. Migration: `client_content_updated_at` column + `emotive_claim_client_views` table + index (auth/
   migration → explicit approval before apply).
2. Repo: bump `client_content_updated_at` on the qualifying writes (emotive update, attachments
   add/remove, Gate A, publish); confirm internal-only edits don't bump.
3. Shared + API: `freshness` on the client list schema; list query LEFT JOIN + `freshnessFor`
   projection.
4. API: record-view upsert on client detail read (+ the port/service plumbing).
5. Portal: render the NEW/UPDATE chip on list + cards; i18n.
6. Docs (CLAUDE.md + this model) + full gate.

Prod after deploy: the migration runs via `db:migrate:deploy` (api pre-deploy); **no seed needed**
(no new permission this phase).
