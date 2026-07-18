# Client Visibility — Phase 3.1: freshness animation + section "Novo" markers (design)

> Builds on shipped Phase 3 (`ab8eb9d`) NEW/UPDATE list freshness. Two enhancements Nikola asked for
> after using Phase 3: (a) the list NEW/UPDATE chip is too subtle → add a gentle attention animation;
> (b) inside a claim the client can't tell WHAT changed (Nikola added a photo and only he knew where
> to look) → mark the specific section(s) that changed since the client's last visit. Approved
> (UX = "just mark the section", no summary list) 2026-07-18. EMOTIVE only, portal + a little API.

## 1. Goals

1. **Attention animation** on the list `NEW`/`UPDATE` chip — noticeable but tasteful, so a client
   scanning the list doesn't skip it.
2. **Section-level "Novo" markers** on the claim detail: when a client opens a claim, each
   client-visible section that changed **since that client's last visit** shows a small "Novo"
   marker, pointing them to what's new (photos, inspection report, details, outcome/status). The
   markers clear on the next visit (they reuse the Phase-3 per-user "last seen").

Non-goals: a "what's new" summary list (Nikola chose section-marking only); operator-facing markers;
email; DOMACE (no portal).

## 2. Sections (map to the portal detail cards in `apps/portal-web/src/routes/claims/$id.tsx`)

| Marker key   | Portal card(s)                          | Changes that mark it fresh |
|--------------|-----------------------------------------|----------------------------|
| `photos`     | `PhotosCard`                            | a client-visible EMOTIVE attachment added/removed |
| `inspection` | `InspectionCard`                        | `inspectionReport` edited |
| `details`    | `BasicsCard` + `ReportedProblemCard`    | any of `warrantyReport, dateOfClaim, dateOfFinish, engineCode, engineTypeId, manufacturerId, employeeId, mrNumber` edited |
| `outcome`    | `TimelineCard` (status)                 | Gate B publish (`published_at` set → the verdict/status becomes visible) |

These are exactly the Phase-3 client-visible bump triggers (same whitelist + attachment choke +
publish), now routed to a per-section key. Internal-only edits still mark nothing.

## 3. Data model

One new nullable column on `emotive_claims`:

- `section_updated_at jsonb NULL` — a map of `{ photos, inspection, details, outcome }` → ISO
  timestamp of that section's last client-visible change. Absent key = never changed. Backfilled
  NULL for existing rows (no marker burst — consistent with Phase 3's null backfill).

No new table. The existing `emotive_claim_client_views.viewed_at` (Phase 3) is the per-user
reference. `client_content_updated_at` (Phase 3, the whole-claim list-badge signal) is kept and keeps
being bumped alongside — the two coexist (list badge = whole claim; section markers = per section).

**Bump routing** (same sites as Phase 3 Task 2, each also writes its section key via
`jsonb_set(COALESCE(section_updated_at, '{}'::jsonb), '{<key>}', to_jsonb(now()))`, parameterized):
- emotive repo UPDATE: if `inspectionReport` in patch → set `inspection`; if any `details`-group
  field in patch → set `details` (both can fire in one update).
- emotive repo CREATE: set the keys for whichever whitelisted groups are present.
- `publish`: set `outcome`.
- attachments `publishClaimAttachmentsChanged` (clientVisible && Emotive): set `photos`.

## 4. Section freshness computation (server, per client user, at detail open)

`GET /api/emotive-claims/:id` for a `own_customer` (client) user returns, in addition to the existing
whitelisted detail, a `sectionFreshness: { photos: boolean, inspection: boolean, details: boolean,
outcome: boolean }`.

Computed as: for each key, `true` iff the claim is openable **and** `section_updated_at[key]` exists
**and** `section_updated_at[key] > the client's PRE-open viewed_at` (or the client never viewed the
claim). Internal/full-view actors get an all-`false` / omitted `sectionFreshness`.

**Ordering (critical):** the detail read must compute `sectionFreshness` against the client's
`viewed_at` value from BEFORE this open, and only THEN record the view (advance `viewed_at = now`).
So `findById` for a client: (1) read the current view row's `viewed_at` (old); (2) load the claim
(with `section_updated_at`); (3) compute `sectionFreshness` from `section_updated_at` vs old
`viewed_at`; (4) `recordClientView` (advance viewed_at). One visit clears both the list badge (Phase
3) and the section markers — consistent "seen it" semantics.

Raw `section_updated_at` / `viewed_at` never leave the server — only the derived booleans.

## 5. Client wire + portal rendering

- `ClientClaimDetailSchema` gains `sectionFreshness: z.object({ photos: z.boolean(), inspection:
  z.boolean(), details: z.boolean(), outcome: z.boolean() })` (all-false when nothing fresh).
- Portal `$id.tsx`: each card renders a small "Novo" marker when its section is fresh — `PhotosCard`
  (photos), `InspectionCard` (inspection), `BasicsCard` + `ReportedProblemCard` (details),
  `TimelineCard` (outcome). Reuse the same chip/`mrp-*` token style as the list freshness chip; no
  hardcoded palette.
- The list `ClientClaimListItem.freshness` chip (Phase 3) gains a gentle **pulse** animation
  (CSS keyframe, subtle scale/opacity or a soft glow ring) — respects `prefers-reduced-motion`
  (no animation when the user prefers reduced motion). Tokens only.

## 6. Security / correctness invariants

- `sectionFreshness` is derived server-side per authenticated user against that user's own
  `viewed_at`; the wire never carries raw section/view timestamps, and one user's views never affect
  another's markers.
- Internal-only edits set no section key → never mark a client section (same leak-prevention as
  Phase 3; the routing keys off the identical whitelist).
- Section computation runs only after the Phase-2 404 openable gate passes; a Primljeno claim (not
  openable) shows no markers.
- Migration forward-only, drizzle-generated, proven from-zero; column nullable/no-default.

## 7. Testing

- **Integration:** each bump routes to the right section key (inspection edit → `inspection` only;
  details field → `details`; publish → `outcome`; client-visible photo → `photos`); an internal-only
  edit sets no key; `sectionFreshness` is true only for sections changed after the client's prior
  `viewed_at` and false once viewed; the compute-before-record ordering (open once with a fresh
  section → marker true; re-open → marker false); per-user isolation; a Primljeno claim → all false.
- **Portal component:** each card shows/hides its "Novo" marker from `sectionFreshness`; the list
  chip animates (assert the animation class/attribute is present, and absent under reduced-motion).
- **Migration:** proven migrate-from-zero.

## 8. Build order (subagent-driven, each reviewed)

1. Migration: `section_updated_at jsonb` column (approval before apply).
2. Repo/attachments: route the section-key bumps (`jsonb_set`) at the Phase-3 bump sites.
3. API: `sectionFreshness` on the client detail wire + the compute-before-record ordering in
   `findById` (+ a repo read of the pre-open `viewed_at`).
4. Portal: section "Novo" markers on the detail cards + the list-chip pulse animation + i18n.
5. Docs (CLAUDE.md) + full gate.

Prod after deploy: migration runs via `db:migrate:deploy`. No new permission → no seed.
