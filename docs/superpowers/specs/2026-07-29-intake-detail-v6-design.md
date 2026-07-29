# V-6-1 — the intake order's detail screen, read side

Status: **approved by Nikola, 2026-07-29.** Phase V-6-1 of `docs/25-vehicle-service-intake-design.md`.
Branch `feat/vehicle-intake`, last commit `bde9616` (V-6-0, the history endpoint).

---

## 1. Why

`/prijem/$id` is still `IntakePhasePlaceholder`. Every row of the intake list — including the
unfinished drafts — already links to it, so today a serviser or an operator who taps a row lands on
a construction sign. The list tells them a car exists; nothing tells them what was found on it, who
signed, what was photographed, or who has touched it since.

The module exists to replace a paper work order whose whole value is that it records the vehicle's
condition at the moment the customer handed it over. Without the detail, that record is write-only:
it goes in through the wizard and never comes back out. The office in particular has no surface at
all — it cannot correct a mis-tapped status, cannot remove a duplicate order, and cannot see why a
colleague's intake is stuck on step 3.

V-6 closes that. It is split in two because the edit mode is the larger and riskier half:

- **V-6-1 (this spec):** reading — the four tabs, the header, status correction, removal, and the
  reduced view of an unfinished intake.
- **V-6-2 (next spec):** "Ispravi zatečeno stanje" — the amend mode that turns the Pregled tab into
  an editor and stamps the order as changed after signing.

Splitting them keeps each pass gate-green and browser-verified on its own, and lets the edit mode be
built on top of a screen Nikola has already seen rather than beside one he has not.

## 2. Scope

**In:** header with badges · status-correction bar (office) · advance button (serviser, one-way) ·
four tabs (Pregled · Fotografije · Specifikacija · Istorija) · order removal · the reduced view of
an unfinished intake with "Nastavi prijem".

**Out, deliberately:**

- The amend mode and post-signing photo add/delete — V-6-2.
- Print — V-7, still unspecified (`docs/25` §3.5).

**No migration, no new permission, no new wire field.** `IntakeOrderDetailSchema` already carries
every value the screen needs: `amendedAt`, `amendedByName`, `photosPending`, `photos`, both
signatures, `draftStep`, `technicianId`, `checklist`, `damages`, `services`, `materials`. The only
server change is a filter on the history projection (§6).

## 3. Who sees what

Read off the permissions that already exist (`packages/shared/src/permissions.ts`) — the screen
gates on permissions, never on a role name, exactly as the sidebar rule does.

| | serviser (`view_own`, `create`, `update`, `advance`) | operator / admin (all of them) |
| --- | --- | --- |
| Detail of own order | yes | yes (any order) |
| Detail of a colleague's order | **404**, not 403 — the service's `loadVisible` decides, and the history endpoint runs it first so it cannot be used to go around the row-level scope | yes |
| Advance to next status | yes — one-way button | yes |
| Status-correction bar | no | yes (`change_status`) |
| Remove a signed order | no | yes (`delete`, soft) |
| Discard an unfinished draft | own only — a hard delete that releases the order number | yes, any — this is how abandoned drafts get cleaned up (`docs/25` §3.3) |
| Amend the condition | no | yes (`amend`) — **V-6-2** |

## 4. The screen

Values are read from `prijem-prototip-v2.dc.html` lines 420–646, not from the handoff prose. Where
this document names a size or a string, it is the prototype's.

### 4.1 Header

`← Nazad na listu` (JetBrains Mono 11px, `--mri-text2`) above the title row:

- order number, **mono 27px/800**, letter-spacing −.02em
- status badge — dot + label, pill, per-status background and foreground
- vehicle-type badge — pill, `--mri-inbg` with `--mri-border2`
- `⚠ MENJANO POSLE POTPISA` — amber pill, **only when `amendedAt !== null`**
- subtitle: `vehicle · PLATE · ownerName`, the plate in mono

Right-aligned actions, 46px tall:

- `⎙ ŠTAMPAJ` — **rendered disabled** with a title explaining that print is not built yet
- next-status button (primary) — shown when the order is signed, the caller holds
  `intake_orders.advance`, and a next status exists (`preuzeto` is terminal)
- `ISPRAVI ZATEČENO STANJE` — **not rendered in V-6-1**
- `UKLONI NALOG` — red outline, shown with `intake_orders.delete` on a signed order

### 4.2 Status-correction bar

Rendered only with `intake_orders.change_status`, only on a signed order. Caption
`ISPRAVKA STATUSA` — **without the prototype's „(KANCELARIJA)"**, because "Kancelarija" is not a
role and must not be printed as one (`docs/25` §3.1). Four segments in one bordered strip, the
current status highlighted. Trailing note: *"Svaka ispravka se upisuje u Istoriju sa imenom i
vremenom."*

Neither the advance button nor a status segment opens a confirmation dialog: a status move is small,
reversible and already audited, so it fires directly and reports through `showInternalToast`.
Removal is the destructive action and keeps its `<ConfirmDialog>` (§4.9).

### 4.3 Tabs

`Pregled` · `Fotografije N` (the count appended, as in the prototype) · `Specifikacija` ·
`Istorija`. 2px red underline on the active one; inactive `--mri-text2`/600, active
`--mri-text`/700.

The active tab lives in the **URL** (`?tab=pregled|fotografije|spec|istorija`), validated with Zod
the same way the list validates its filters. A refresh, the back button and a shared link all land
where the user was.

### 4.4 Pregled

Two columns: a flexible left one and a fixed **320px** right rail.

**`OSNOVNI PODACI`** — a 4-column grid of exactly the prototype's eight facts, in its order:

| Label | Value |
| --- | --- |
| DATUM PRIJEMA | `receivedAt`, date · time, mono |
| SERVISER | `technicianName` |
| KILOMETRAŽA | `mileage` + " km", `—` when null, mono |
| NAČIN DOLASKA | `arrivalMode`, translated |
| VIN | `vin` or `—`, mono |
| TELEFON | `ownerPhone`, mono |
| GORIVO | `fuelLevel` + "/8", mono 600 |
| NEDOSTACI | `damages.length` — **green when 0, red otherwise** |

**`ŠEMA` + `NEDOSTACI I PRIMEDBE`** in one card. The silhouette renders at **152×248** through the
existing `IntakeDamageMap` with `onPlace` omitted. Each damage is a numbered circle in its type's
colour plus its label; an empty list prints *"Nema uočenih nedostataka pri prijemu."* Below,
`PRIMEDBE VLASNIKA` in italic `--mri-text2` from `ownerRemarks`.

**Right rail:**

- `FOTOGRAFIJE · N` — a 3-column grid of square thumbnails, each carrying the damage number badge
  top-left when `damageId` matches a damage. Clicking opens the lightbox.
- `POTPISI` — two 50px boxes, each an `<svg viewBox="0 0 460 200">` drawing the stored path with
  `--mri-sigink`, labelled `SERVISER · <name>` and `VLASNIK · <ownerName>`. Beneath them a note
  bar, transferred verbatim:
  - not amended → **green**: *"Nalog je potpisan i zaključan. Izmene se beleže u istoriji."*
  - amended → **amber**: *"Zatečeno stanje je menjano posle potpisa — {datum}, {ime}. Odštampani
    nalog kod mušterije nije identičan ovom zapisu."*

### 4.5 Fotografije

One card, `FOTODOKUMENTACIJA · N`, a **4-column** grid of 4:3 thumbnails. Each cell carries the
damage badge and a caption below: `IMG_03 · OŠT. 2` when the photo points at a damage, `IMG_03`
otherwise — the index is the photo's position, padded to two digits.

When `photosPending > 0`, an amber bar above the grid says not every photo from the tablet has
arrived. This is the only place besides the list where that indicator surfaces, and it is why
`photos_expected` exists.

### 4.6 Specifikacija

Two equal cards side by side, `USLUGE` and `MATERIJAL`, each a numbered list of the stored strings.
No empty state — matching the wizard's step 4, which has none either (`docs/25` §8, V-5).

### 4.7 Istorija

One card. Each row: time (130px, mono, `--mri-text2`) · what happened · who did it, separated by a
1px bottom border. Newest first — the endpoint already orders that way.

Labels are built in the frontend from `action` + `transition` + `fromStatus`/`toStatus`, in a
lookup map (never a nested ternary), through Paraglide messages in sr and en:

| transition / action | Serbian |
| --- | --- |
| `create` | Nalog kreiran |
| `sign` | Nalog potpisan |
| `advance` / `change_status` | Status: {from} → {to} |
| `amend_after_signing` | Zatečeno stanje ispravljeno |
| `amend_photo_added` | Fotografija dodata posle potpisa |
| `amend_photo_removed` | Fotografija uklonjena posle potpisa |
| `discard_draft` | Nedovršen prijem odbačen |
| `soft_delete` | Nalog uklonjen sa liste |

An unrecognised transition falls back to a neutral "Izmena" rather than rendering the raw key — new
transitions will be added by later phases and must not leak an English identifier onto a Serbian
screen.

### 4.8 An unfinished intake

`signedAt === null`. The prototype has no such screen — its detail assumes a signed order — so this
is ours, kept deliberately thin.

In place of the status bar, an **amber bar**: *"Nedovršen prijem · korak 3 od 5"*, with

- `NASTAVI PRIJEM →` — **only for `technicianId === current user`**. The office does not fill
  intakes in (`docs/25` §3.1), and an order is bound to the serviser who signs it, so nobody may
  take over someone else's.
- `ODUSTANI` — for the owner or anyone holding `delete`. Behind `<ConfirmDialog>`, worded for what
  actually happens: the draft is **really deleted** and the order number is released.

Tabs reduce to **Pregled and Fotografije**, showing whatever has been entered so far. No POTPISI
card, no advance button, no status-correction bar, no `UKLONI NALOG` (that dialog is about a signed
document and would be a lie here).

### 4.9 Removing a signed order

`<ConfirmDialog>`, wording from the prototype's modal: the order leaves the list but **stays in the
database** with a permanent trace of who removed it and when; this is not permanent deletion and the
signed document is not destroyed. On success, back to `/prijem` with a toast.

## 5. Data flow

- `intakeOrderDetailOptions(id)` — prefetched in the route loader (`ensureQueryData`), read with
  `useSuspenseQuery`. One aggregate fetch, photos included, per the claims rule.
- `intakeOrderHistoryOptions(id)` — **not** prefetched. It is needed by one tab out of four, so it
  is fetched when that tab mounts, inside a Suspense boundary with a skeleton. Two indexed reads on
  every detail open would be waste; this is not an N+1.
- Mutations (advance, change status, delete) invalidate the detail, the list and the summary. **No
  optimistic updates** — status is a state change with an audit trail, and `docs/04` reserves
  optimism for small toggles.
- SSE needs no work: the `intakeOrders` key already flows through the existing invalidation map, so
  an operator watching a detail sees a colleague's status change without refreshing.

## 6. The one server change — filtering the history

Every wizard step patch and every photo upload writes an audit row. A real intake with twelve
photos produces roughly twenty rows, of which about fifteen are the intake being filled in. The
prototype drew Istorija with two rows; the tab exists to answer *"who changed this after the
customer signed"*, and burying that under the filling is the failure mode.

`IntakeOrdersRepository.listHistory` drops a row when

    transition IN ('photo_uploaded', 'photo_removed')
    OR (action = 'update' AND transition IS NULL)

and keeps everything else.

The rule keys on the **transition, not the action**. Deleting a photo is audited as
`AuditAction.Delete`, so a rule phrased as "drop noisy updates, keep every delete" would keep
`photo_removed` — a serviser deleting a blurred photo in step 3, which is the intake being filled
in and nothing else. Both photo transitions are named explicitly for that reason.

`transition IS NULL` is the wizard's own step patches. It is scoped to `action = 'update'` because
creation also carries no transition and must stay. Filtering happens in SQL, so the projection
stays small on the wire too.

Kept, by construction: `create`, `sign`, `advance`, `change_status`, `amend_after_signing`,
`amend_photo_added`, `amend_photo_removed`, `discard_draft`, `soft_delete`.

Integration tests pin both directions: filling an order in produces **no** history rows beyond
creation, and an amendment after signing produces exactly one.

## 7. Files

New, under `apps/internal-web/src/features/intake-orders/detail/`:

`intake-detail-header.tsx` · `intake-status-bar.tsx` · `intake-draft-bar.tsx` ·
`intake-detail-tabs.tsx` · `tab-overview.tsx` · `tab-photos.tsx` · `tab-spec.tsx` ·
`tab-history.tsx` · `history-labels.ts`

Changed: `apps/internal-web/src/routes/_shell/prijem/$id.tsx` (loader + composition, replacing the
placeholder) · `apps/api/src/modules/intake-orders/intake-orders.repository.ts` (the filter) ·
`packages/i18n/src/messages/{sr,en}.json`.

The query factories are already in place — `intakeOrderDetailOptions` and
`intakeOrderHistoryOptions` both live in `packages/shared/src/queries/intake-orders.ts`.

**Reused, not rewritten:**

- `IntakeDamageMap` — already supports read-only (`onPlace` omitted; it was written with the detail
  in mind). It needs one addition: a size prop, since it is fixed at 236×386 and the detail wants
  152×248.
- `intakeDamageMarkerColour`, `INTAKE_SILHOUETTES`, `buildPhotoCells` and the lightbox from
  `intake-photo-grid.tsx`
- `IntakePanel`, `ConfirmDialog`, `showInternalToast`, `internalButtonClasses`, `ListPagination`
  patterns from the list

Colours go through the `mri-*` utility classes. **Never `var(--mri-warn)` and friends** — the
status hues exist only inside `@theme inline` and an unresolved `var()` silently drops the property
to its initial value, which is how the fuel dial's amber arc was invisible for a day (CLAUDE.md §5).

## 8. Verification

1. Full gate green: `pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration`.
2. Integration tests for the history filter (both directions, §6).
3. Component tests for `history-labels.ts` (including the unknown-transition fallback) and for the
   draft bar's owner-only continue button.
4. In the browser, on `pnpm dev:all`, both accounts:
   - as an operator: open a signed order, walk all four tabs, correct the status and see the entry
     appear in Istorija, remove an order and land back on the list;
   - as a serviser: open own order (advance works, no status bar, no remove), open a colleague's id
     directly in the address bar and get the not-found screen;
   - open an unfinished draft from both accounts — the continue button appears only for its owner.
5. At **1180×820** (the serviser's iPad): measure `scrollWidth` vs `clientWidth` on the page and
   audit each cell against its column's right edge. Nikola picks the viewport from DevTools'
   Dimensions menu; never resize his window.

## 9. Reported to Nikola

1. **Divergence from the printed manual:** `Uputstvo Prijem Vozila` has a `ŠTAMPAJ` section with a
   picture of a printed work order. The button is rendered disabled until V-7 is specified. Nikola
   chose this over hiding it.
2. **`CLAUDE.md` §5 is stale:** it states that two unfixed `var(--mri-warn)` / `--mri-archived`
   uses remain in `intake-damage-map.tsx`. They were fixed in V-4c-0 (`5dee824`); the file's own
   comment now describes the bug in the past tense. The paragraph is corrected as part of V-6-1.
