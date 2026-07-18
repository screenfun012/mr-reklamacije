# Client Visibility v2 — draft-first claims, progressive client disclosure, free editing

- **Date:** 2026-07-18
- **Status:** Approved design (brainstormed with Nikola). Ready for implementation planning.
- **Supersedes:** the reverted `800a325` "client visibility (hide/publish)" feature, which
  solved a narrower slice (binary hidden/published + a completed-claim lock relaxation) and
  was rolled back. This design is the fuller, cleaner replacement.
- **Scope of the client-facing half:** EMOTIVE only (only EMOTIVE partners have a portal).
  The editing-freedom half applies to **both** EMOTIVE and DOMACE.

---

## 1. Problem

An operator sometimes knows a claim's outcome before the claim record is complete, and must
record `accepted`/`rejected` early — the business needs it for **statistics, Excel export and
the reports the operator's bosses ask for**. Two things then hurt:

1. **The claim locks.** Once `outcome != pending`, `assertClaimEditable` (`apps/api/src/core/claims/claim-lock.ts`)
   throws `ConflictError` on every content edit. Only an admin with `emotive_claims.reopen` /
   `domace_claims.reopen` can unlock. The operator has to keep asking an admin.
2. **Unlocking flickers the client.** Reopening sets `outcome` back to `pending`, and the
   portal mirrors the outcome directly (`deriveClientClaimPhase(outcome)`,
   `packages/shared/src/schemas/client-claim.schema.ts`). So the client sees
   `in progress → accepted → in progress → accepted …` as the operator reopens to edit.

## 2. Goals / non-goals

**Goals**
- Operators edit claims freely at any time (draft-like), regardless of outcome, on both kinds.
- The client sees a stable, honest, **progressive** story — never a flicker, never the real
  verdict before the operator publishes it.
- Statistics / Excel / reports keep using the **real internal outcome immediately**, decoupled
  from what the client sees.
- Clean, modern, no "patched holes": one enforcement gate, shared helpers, forward-only
  migration, whitelist-by-default for client data.

**Non-goals**
- No client-facing behavior for DOMACE (no portal). DOMACE only gets the lock removed.
- No change to the whitelist of which fields a client may ever see (same safe set as today).

## 3. The model — two pillars

### Pillar 1 — Editing freedom (both kinds)
- **Remove the outcome-based lock.** `assertClaimEditable` no longer blocks content edits when a
  claim is `accepted`/`rejected`. Operators with the normal edit permission edit any claim, any
  stage. Change is recorded in the **audit log** (the modern equivalent of a lock: a full history,
  not a frozen door).
- **Retire `reopen` for editing.** `assertOutcomeTransitionAllowed` / `assertCompletedActionAllowed`
  and `is-internal-notes-only-update.ts` (the old lock carve-out) are removed. No more "ask admin
  to unlock".
- **Guardrails that stay:**
  - **Outcome change always requires a `ConfirmDialog`.** While private: a plain "are you sure?".
    While published: a stronger warning — "the client already sees ACCEPTED; this sends them an
    UPDATE and changes what they see."
  - **Delete** stays gated by the delete permission + `ConfirmDialog` (destructive; a published
    claim may already be visible to the client).
  - The DOMACE "repair amount only on accepted" rule (`assertAcceptedClaimAmountEditable`) is a
    business rule, not the lock — it stays as-is.

### Pillar 2 — Client visibility (EMOTIVE only): three stages
The client's portal status is a 3-step bar: **Primljeno → U obradi → Ishod** (Received → In
progress → Outcome). Two gates drive it:

| Stage | Enters when | Client can open detail? | Outcome shown to client? |
|-------|-------------|-------------------------|--------------------------|
| **Primljeno** | claim created (mandatory fields) | ❌ no (server 404) | ❌ masked |
| **U obradi** | **Gate A** — operator first fills the client-visible **Inspection report** | ✅ yes — sees filled whitelist fields | ❌ masked (client sees "u obradi" even though internally it may be decided) |
| **Ishod / real status** | **Gate B** — operator clicks **"Objavi klijentu"** (2-click confirm) | ✅ yes — full whitelist | ✅ real status unmasked |

- **Gate A is automatic and monotonic.** The first time the client-visible Inspection report
  becomes non-empty, the claim advances to "U obradi" and becomes openable. Clearing the field
  later does **not** regress it. (Chosen over "all basic fields filled" because the mandatory
  basics are present at intake — that would collapse the Primljeno stage — and optional basics
  can legitimately be empty, which would make an "all filled" trigger fire unpredictably or never.)
- **Gate B just removes the mask.** After publish the client sees the **real internal status**:
  if the internal outcome is still `pending`, the client sees the real "U obradi"; if it's
  `accepted`/`rejected`, the client sees the verdict. Publishing is allowed at any time.

## 4. Data model (EMOTIVE)

Three timestamps on `emotive_claims` (chosen over an explicit stage enum: timestamps also give
us history + drive NEW/UPDATE, and the stage derives cleanly from them):

- `client_visible_at timestamptz NULL` — set once, when Gate A first fires. Monotonic.
- `published_at timestamptz NULL` — set when Gate B fires (publish). Removes the outcome mask.
- `client_content_updated_at timestamptz NULL` — bumped whenever **client-visible content**
  changes while the claim is at least "U obradi" (see §7). Drives NEW/UPDATE freshness.

New table for per-client-user "seen" tracking (per-account, not per-firm — future-proofs
parent/child firms; today usually 1 account = 1 firm):

```
emotive_claim_client_views(
  user_id           uuid   not null,   -- fk users(id) on delete cascade
  emotive_claim_id  bigint not null,   -- fk emotive_claims(id) on delete cascade
  viewed_at         timestamptz not null,
  primary key (user_id, emotive_claim_id)
)
```

**Stage derivation (server, single source of truth):**
```
if client_visible_at is null and published_at is null → Primljeno
else if published_at is null                          → U obradi (masked)
else                                                  → published: show REAL status
                                                          (pending → U obradi, decided → Ishod)
```
- **Can open detail** iff `client_visible_at is not null OR published_at is not null`.
- **Outcome + dateOfFinish masked** iff `published_at is null`.

**Migration (forward-only, drizzle-kit generated, proven from-zero):** add the three columns +
the table. **Backfill existing EMOTIVE claims to `published_at = created_at`** so nothing that a
client can see today gets retroactively hidden. DOMACE is untouched.

## 5. Editability change (server)

- `claim-lock.ts`: delete/retire `assertClaimEditable`, `assertOutcomeTransitionAllowed`,
  `assertCompletedActionAllowed`, and the `reopen` permission path; delete
  `is-internal-notes-only-update.ts` and its usages. Both EMOTIVE and DOMACE services stop
  gating content edits on outcome.
- **Outcome change** endpoint stays, but no reopen gate — any transition is allowed; the client
  (internal UI) always confirms it. The email + UPDATE behavior below handles the published case.
- **Delete** gated by `<kind>_claims.delete` + `ConfirmDialog` (already the pattern), no reopen.
- Decide during planning whether to fully remove the `*.reopen` permissions from the seed or
  leave them dormant — prefer removing (no dead permission), via the system seed + a note that
  prod loses two unused permission rows.

## 6. Client-facing behavior (portal, EMOTIVE)

- **Whitelist unchanged.** The client still only ever receives the existing safe set
  (`ClientClaimListItemSchema` / `ClientClaimDetailSchema`): engine, MR number, dates, warranty
  + inspection narrative, technician name, firm. **Never** faults, internal notes, amounts, ids.
- **Progressive = null fields simply don't render.** No special mechanism; as the operator fills
  a whitelist field it appears. "We chunk what we have."
- **Masking while `published_at is null`:** on the wire, `outcome` is sent as `pending` and
  `dateOfFinish` as `null`, so the real verdict never leaves the server before publish (same
  proven approach as `800a325`: mask in `toClientClaimListItem` / `toClientClaimDetail`).
- **Detail-access gate:** `fetchById` for a `client`-role user returns `null` (→ 404) when the
  claim is not openable (Primljeno). One gate, reused by detail, attachments and the client PDF
  (via `loadClaimContext`) — the pattern `800a325` used, kept.
- **Status is computed on the SERVER and sent on the wire.** The client cannot derive its own
  status: `client_visible_at` / `published_at` are internal timestamps (not whitelisted), and a
  masked `outcome=pending` cannot distinguish Primljeno from U obradi. So the client wire schema
  gains a `clientPhase` field. The server computes it via
  `deriveClientClaimPhase(outcome, { clientVisibleAt, publishedAt })` (Received / InProgress /
  Outcome per §4) and the portal renders it directly — the portal no longer calls
  `deriveClientClaimPhase` itself. This intentionally re-introduces a status wire field: the
  2026-07-04 "status is a pure function of outcome, no `progressPhase` wire field" decision held
  only under the old outcome-mirrors-everything model and is now superseded (update CLAUDE.md +
  the `client-claim.schema.ts` doc comment). `ClientClaimPhase.Received` becomes a **live**
  status again (it currently survives only as the timeline's first node).
- **The client wire carries:** `clientPhase` (authoritative status), `outcome` (masked to
  `pending` while private, real when published — the verdict label reads from it only when
  `clientPhase = Outcome`), the freshness badge (§7), and the existing whitelist fields.

## 7. NEW / UPDATE freshness (EMOTIVE, per client-user)

- **Bump `client_content_updated_at`** when client-visible content changes while the claim is at
  least "U obradi": any whitelist field edit, a client-visible attachment add/remove, the
  Gate-A transition itself, and the Gate-B publish (the reveal is a change worth signaling).
- **Badge for a given client user on a given claim:** show it when
  `client_content_updated_at > that user's viewed_at` (or the user has never viewed it) and the
  claim is openable. **Label:** `NEW` while `published_at is null`, `UPDATE` while published.
- **Clear:** when the client opens the claim detail, upsert `emotive_claim_client_views` with
  `viewed_at = now`.
- Endpoint: the client list/summary computes the badge per item for the requesting user.

## 8. Operator-facing behavior (internal app, EMOTIVE)

- **Stage indicator** on the claim (Primljeno / U obradi / Objavljeno) + an explicit "Još nije
  objavljeno" cue, so an operator can see at a glance what the client currently sees.
- **"Objavi klijentu"** action = `ConfirmDialog` (two deliberate clicks). Copy adapts: with a
  decided outcome — "Klijent će videti ishod: PRIHVAĆENO"; while pending — "Klijent će videti
  trenutni status: U obradi". Publishing sets `published_at` and (if a decided outcome is now
  visible) triggers the outcome email (§9).
- **Outcome-change confirm** (§3), stronger when published.

## 9. Email

- The outcome email fires **when a decided outcome first becomes visible to the client**:
  - publish while the outcome is already `accepted`/`rejected` → fire on publish;
  - publish while `pending`, then set the outcome later → fire on that outcome change (the claim
    is already published, so the outcome is live).
- Never fires while private. Reuses the existing signal-only bilingual email path
  (`notifyClientOutcomeChanged`, EmailPort-gated, admin toggle intact).

## 10. Server enforcement, permissions, statistics

- **One enforcement gate** (defense-in-depth kept): route `requirePermission` → service →
  `fetchById` visibility gate → whitelist projection. A `client` user can never read a private
  claim's detail/attachments/PDF, and never sees the masked outcome, by construction.
- **New permission `emotive_claims.publish`** (operator + admin). Route: verb endpoint
  `POST /api/emotive-claims/:id/publish` (audit + SSE + CAS). Prod needs one `db:seed` after
  deploy to insert it + grant to operator.
- **Statistics / Excel / dashboards / reports** read the real `outcome` column directly and are
  unaffected by visibility — the operator gets accurate reports the moment they set the outcome,
  regardless of publish state.
- **SSE / cache:** publish + content-change emit the existing claim-updated event; the internal
  and portal query invalidation added in the 2026-07-18 reactivity work already covers claim
  lists, detail, dashboard, attachments and the portal client views.

## 11. Testing (TDD, real Postgres for integration)

- Enforcement: a `client` user gets 404 on a Primljeno claim's detail/attachments/PDF; the
  masked outcome / dateOfFinish never appear on the wire while private.
- Stage transitions: create → Primljeno; fill inspection report → U obradi (monotonic, doesn't
  regress on clear); publish → real status; pending-at-publish shows U obradi, later decided
  shows Ishod.
- Editing freedom: an operator edits an accepted claim (both kinds) with no reopen; every edit
  audited.
- Email: fires exactly once when a decided outcome first becomes client-visible; never while
  private.
- NEW/UPDATE: badge appears on new client-visible content, label flips NEW→UPDATE at publish,
  clears on view, is per-user.
- Migration proven from-zero; existing claims backfilled to published.

## 12. Rollout

- Forward-only migration + backfill (existing EMOTIVE → published). DOMACE untouched apart from
  the lock removal (a code change, no migration).
- After deploy: run `db:seed` once (adds `emotive_claims.publish`, removes retired `*.reopen` if
  we choose to drop them — decide in the plan).

## 13. Prior art

`800a325` (reverted) already proved the enforcement-gate-in-`fetchById` and the
outcome-masking-in-`toClientClaimListItem` patterns, and a `deriveClientClaimPhase(outcome,
visibility)` signature. Its migration `0027` added a single `client_visibility text` column.
Reuse the **patterns**, not the code; this design is broader (three timestamps, progressive
gates, per-user NEW/UPDATE, lock removal for both kinds) and is built fresh and clean.

## 14. Open items to settle during planning (not blockers)

- Whether to physically remove the `*.reopen` permissions or leave them dormant (lean: remove).
- Exact portal 3-bar / badge visuals (behavior is specified here; visual polish during build).
- Whether DOMACE's "amount only on accepted" rule is relaxed now (lean: keep).
