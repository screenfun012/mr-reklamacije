# Freshness: don't signal NEW/UPDATE on content REMOVAL (design)

> Bugfix on the shipped EMOTIVE client-visibility freshness feature (Phase 3 / 3.1). Reported by Nikola
> 2026-07-19: adding a photo correctly shows the client a NEW/UPDATE badge; **removing** a photo shows it
> AGAIN — a false signal ("client sees 'new' but there's nothing to look at → looks like a bug"). Same
> for clearing a client-visible field. Approved 2026-07-19: freshness should fire only when there is new
> client-visible content to look at, never on a removal/clear. EMOTIVE only, API-only, **no migration**.

## Principle
The NEW/UPDATE list badge (`client_content_updated_at`) and the per-section "Novo" markers
(`section_updated_at`) must bump only when a client-visible change **adds or changes content to a
meaningful value** — never when content is **removed or cleared**. The SSE invalidation still fires on
removals (a client currently viewing the claim sees the item disappear); only the freshness signal is
suppressed.

## Change 1 — attachments (`apps/api/src/modules/attachments/attachments.service.ts`)
`publishClaimAttachmentsChanged(claimId, claimKind, clientVisible)` is the single choke point called by
both `upload()` (add) and `delete()` (remove). It (a) fires the SSE event and (b) calls
`repo.bumpEmotiveClientContentUpdatedAt` (which bumps `client_content_updated_at` + the `photos` section).
- Add a `bumpFreshness: boolean` param. The SSE fire stays **unconditional** (both add and remove).
- Only call `bumpEmotiveClientContentUpdatedAt` when `isEmotiveClientVisible && bumpFreshness`.
- `upload()` passes `bumpFreshness: true`; `delete()` passes `bumpFreshness: false`.

## Change 2 — fields (`apps/api/src/modules/emotive-claims/emotive-claims.repository.ts`)
Today the gates use **presence in the patch** (`value !== undefined`), so clearing a client-visible field
(e.g. warranty report → empty) still bumps. Switch to **meaningful value**:
- Add `isMeaningfulValue(v: unknown): boolean` = `v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')`. (Non-string non-null values — dates, FK ids — are meaningful; empty/blank strings and null are not.)
- `touchesDetailsFields`: `[...detailFields].some(isMeaningfulValue)` (was `.some(v => v !== undefined)`).
- `touchesClientVisibleFields`: `hasInspectionReport(input.inspectionReport) || touchesDetailsFields(input)` (reuse the existing `hasInspectionReport` trim check for the report — a blank report edit no longer bumps freshness; Gate A already used `hasInspectionReport`, unchanged).
- **Section-key logic in BOTH create (~L388 `initialSections`) and update (~L778-785):** `'inspection'` only when `hasInspectionReport(input.inspectionReport)`; `'details'` only when `touchesDetailsFields(input)` (now meaningful-based). So clearing a field marks no section.
- **Unchanged:** Gate A (`clientVisibleAt`, monotonic COALESCE), Gate B publish (`outcome` section), outcome change, `internalNotes`/faults/`sourceId`/`claimNumber`/amounts (still never bump). A real edit to a new value still bumps (client should re-read).

## Behavior table (after)
| Action | SSE refresh | NEW/UPDATE badge + "Novo" marker |
|---|---|---|
| Add client-visible photo | yes | yes |
| Remove client-visible photo | yes | **no** |
| Edit a client-visible field to a value | yes | yes |
| Clear a client-visible field (→ empty/null) | yes | **no** |
| Gate A first report / Gate B publish / outcome | yes | yes (unchanged) |
| Internal-only edit (notes/faults/amounts) | (its own signal) | no (unchanged) |

## Tests (real Postgres; every bugfix ships a regression test)
- Attachment **remove** on a client-visible EMOTIVE claim → `client_content_updated_at` and the `photos`
  section are NOT bumped; the SSE/attachments-changed event still fires. Attachment **add** → still bumps.
- Field **clear** (e.g. `warrantyReport: ''`) → no `client_content_updated_at`, no `details` section.
  Field **edit to a value** → bumps (unchanged). Blank `inspectionReport` edit → no `inspection` marker;
  non-blank → marker (and Gate A still stamps `client_visible_at`).
- Update the existing tests that currently assert removal/clear DOES bump — they must flip.

## Docs
Update CLAUDE.md §2 (Phase 3 + Phase 3.1 invariants): "attachment add/remove" → "attachment **add**
(remove fires SSE only, not freshness)"; "whitelisted field edit" → "whitelisted field edit **to a
meaningful value** (clearing a field fires SSE only, not freshness)".

## Out of scope / non-goals
No migration (behavior of existing columns only). No DOMACE (no portal). No frontend change (the wire
fields are unchanged; they just fire less often). The direction is strictly **fail-safe** (freshness
fires less, never more — cannot leak).
