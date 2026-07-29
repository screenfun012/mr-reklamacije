# V-6-1 — the intake order's detail screen, read side

Status: **approved by Nikola, 2026-07-29**, after a grilling pass that reopened seven of the
decisions in the first draft. Phase V-6-1 of `docs/25-vehicle-service-intake-design.md`.
Branch `feat/vehicle-intake`, last commit `bde9616` (V-6-0, the history endpoint).

---

## 1. Why

`/prijem/$id` is still `IntakePhasePlaceholder`. Every row of the intake list — including the
unfinished drafts — already links to it, so today a serviser or an operator who taps a row lands on
a construction sign. The list tells them a car exists; nothing tells them what was found on it, who
signed, what was photographed, or who has touched it since.

The module exists to replace a paper work order whose whole value is that it records the vehicle's
condition at the moment the customer handed it over. Without the detail, that record is write-only:
it goes in through the wizard and never comes back out.

The grilling pass found that "write-only" was worse than it looked, and in three separate places:

- **The recorded condition has no reader.** The checklist, the equipment note and the owner's
  address are entered in the wizard and displayed nowhere. The prototype draws the checklist only
  inside the print preview and inside the edit mode — and print (V-7) is unspecified, while the
  edit mode is V-6-2. Nobody could answer "did the car arrive with a spare wheel" from the app.
- **A decision Nikola took explicitly does not exist on screen.** `docs/25` §3.3.9 records
  services and materials as *"stalno otvorene"* — permanently editable, because a car can be
  finished before someone remembers which filter they actually fitted. The server honours it (they
  are the only fields free after signing). The UI had no place to do it: the wizard cannot be
  re-entered once signed.
- **Removal is a one-way door.** A soft-deleted order 404s for everyone including an admin, and
  nothing can bring it back. The printed manual the workers are given says the opposite in as many
  words: *"greška se ispravlja, ali se ne krije"*.

V-6 closes all of it, in three passes:

- **V-6-1a — server** (this spec, §6): the history projection, the draft-ownership rule, the photo
  counter, restore, and the list's view parameter. No UI at all.
- **V-6-1b — screen** (this spec, §4–§5): the four tabs, the reduced draft view, the list control.
- **V-6-2 — amend** (its own spec): "Ispravi zatečeno stanje", the amber edit mode that stamps the
  order as changed after signing.

Server before screen, because the ownership rule changes code that V-3 and V-5 already shipped. If
it breaks something, that is worth knowing before ten UI files exist on top of it.

## 2. Scope

**In (V-6-1a + V-6-1b):** header with badges · status-correction bar (office) · advance button
(serviser, one-way) · four tabs, with an editable Specifikacija · the recorded condition made
readable · order removal **and restore** · the reduced view of an unfinished intake with
"Nastavi prijem".

**Out, deliberately:**

- The amend mode and post-signing photo add/delete in the UI — V-6-2.
- Print — V-7, still unspecified (`docs/25` §3.5).

**No migration and no new permission.** `IntakeOrderDetailSchema` already carries every value the
screen needs: `amendedAt`, `amendedByName`, `photosPending`, `photos`, both signatures, `draftStep`,
`technicianId`, `checklist`, `equipmentNote`, `ownerAddress`, `damages`, `services`, `materials`.
Restore reuses `intake_orders.delete` — whoever may remove may put back.

## 3. Who sees what

Read off the permissions that already exist (`packages/shared/src/permissions.ts`). The screen gates
on permissions, never on a role name, exactly as the sidebar rule does.

| | serviser (`view_own`, `create`, `update`, `advance`) | operator / admin (all) |
| --- | --- | --- |
| Detail of own order | yes | yes (any order) |
| Detail of a colleague's order | **404**, not 403 — `loadVisible` decides, and the history endpoint runs it first so it cannot be used around the row-level scope | yes |
| Advance to next status | yes — one-way button | yes |
| Status-correction bar | no | yes (`change_status`) |
| Edit services / materials | yes, always — §4.6 | yes |
| Continue an unfinished intake | **own only**, now enforced on the server — §6.2 | **no**, not even an admin |
| Discard an unfinished draft | own only — a hard delete that releases the number | yes, any — this is how abandoned drafts get cleaned up (`docs/25` §3.3.5) |
| Remove a signed order | no | yes (`delete`, soft) |
| See and restore removed orders | no | yes (`delete`) |
| Amend the condition | no | yes (`amend`) — **V-6-2** |

## 4. The screen (V-6-1b)

Values come from `prijem-prototip-v2.dc.html` lines 420–646, not from the handoff prose. Where this
document names a size or a string, it is the prototype's. Every departure is listed in §9.

The printed manual describes this screen to the workers and its wording matches:
*"Posle potpisa otvara se ceo nalog. Četiri kartice: Pregled (podaci, crtež sa oštećenjima,
potpisi), Fotografije, Specifikacija (usluge i materijal), Istorija (ko je šta menjao i kada)."*

### 4.1 Header

`← Nazad na listu` (JetBrains Mono 11px, `--mri-text2`) above the title row:

- order number, **mono 27px/800**, letter-spacing −.02em
- status badge — dot + label, pill, tone from `INTAKE_STATUS_TONES`
- vehicle-type badge — pill, `--mri-inbg` with `--mri-border2`
- `⚠ MENJANO POSLE POTPISA` — amber pill, **only when `amendedAt !== null`**
- subtitle: `vehicle · PLATE · ownerName`, the plate in mono

Right-aligned actions, 46px tall:

- `⎙ ŠTAMPAJ` — **rendered disabled**, with a title saying print is not built yet (§9.1)
- next-status button (primary) — shown when the order is signed, the caller holds
  `intake_orders.advance`, and a next status exists. `preuzeto` is terminal and the server already
  answers a further `advance` with a 409, so hiding the button and refusing on the server agree.
- `ISPRAVI ZATEČENO STANJE` — **not rendered in V-6-1**
- `UKLONI NALOG` — red outline, with `intake_orders.delete`, on a signed and not-yet-removed order

### 4.2 Status-correction bar

Rendered only with `intake_orders.change_status`, only on a signed order. Caption
`ISPRAVKA STATUSA` — **without the prototype's „(KANCELARIJA)"**, because "Kancelarija" is not a
role and must not be printed as one (`docs/25` §3.1). Four segments in one bordered strip, the
current status highlighted. Trailing note: *"Svaka ispravka se upisuje u Istoriju sa imenom i
vremenom."*

Neither the advance button nor a status segment opens a confirmation dialog: a status move is
small, reversible and already audited, so it fires directly and reports through
`showInternalToast`. Removal is the destructive action and keeps its `<ConfirmDialog>` (§4.10).

### 4.3 Tabs

`Pregled` · `Fotografije N` (the count appended, as in the prototype) · `Specifikacija` ·
`Istorija`. 2px red underline on the active one; inactive `--mri-text2`/600, active
`--mri-text`/700.

The active tab lives in the **URL** (`?tab=pregled|fotografije|spec|istorija`), validated with Zod
through a new `IntakeDetailSearchSchema` — the same shape the claim detail already uses
(`ClaimDetailSearchSchema`, `routes/_shell/reklamacije/emotive/$id.tsx`). A refresh, the back
button and a shared link all land where the user was.

### 4.4 Pregled

Two columns: a flexible left one and a fixed **320px** right rail.

**`OSNOVNI PODACI`** — a 4-column grid. The prototype's eight facts in its order, plus the owner's
address as a ninth (§9.2):

| Label | Value |
| --- | --- |
| DATUM PRIJEMA | `receivedAt` (set at creation, i.e. when the car actually arrived), date · time, mono |
| SERVISER | `technicianName` |
| KILOMETRAŽA | `mileage` + " km", `—` when null, mono |
| NAČIN DOLASKA | `arrivalMode`, translated |
| VIN | `vin` or `—`, mono |
| TELEFON | `ownerPhone`, mono |
| GORIVO | `fuelLevel` + "/8", mono 600 |
| NEDOSTACI | `damages.length` — **green when 0, red otherwise** |
| ADRESA | `ownerAddress` or `—` |

**`ŠEMA` + `NEDOSTACI I PRIMEDBE`** in one card. The silhouette renders at **152×248** through the
existing `IntakeDamageMap` with `onPlace` omitted. Each damage is a numbered circle in its type's
colour plus its label; an empty list prints *"Nema uočenih nedostataka pri prijemu."* Below,
`PRIMEDBE VLASNIKA` in italic `--mri-text2` from `ownerRemarks`.

**`ZATEČENO STANJE`** — a third card, new (§9.2). The checklist as a 4-column ✓/✗ grid: the exact
layout the prototype already uses for this data in its print preview (lines 697–701), moved onto a
surface where it can be read.

**The third state is the point.** `IntakeChecklistSchema` is `z.boolean().nullable()` and the
wizard honours all three, but the prototype's print computes `yes ? '✓' : '✕'` — which renders an
untouched item as **"NE"**. On a document the customer signs that is not a blank, it is a false
statement: *"the car did not arrive with a spare wheel"* instead of *"nobody checked"*. So:

- `true` → `✓` green
- `false` → `✗` red
- `null` → `—` grey, neutral

When any item is unchecked the card header reads `ZATEČENO STANJE · 2 nisu provereni` — a fact, not
an alarm. An order can legitimately be signed with unchecked items (`✓ ZAVRŠI PRIJEM` does not
require them), so amber on every such order would stop meaning anything.

The equipment note (`equipmentNote`) sits under the grid in the same card — it is what the serviser
wrote when something did not fit in the eight items, and it belongs with them.

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

One card, `FOTODOKUMENTACIJA · N`, a **4-column** grid of 4:3 thumbnails served with
`?variant=thumbnail`. Each cell carries the damage badge and a caption below: `IMG_03 · OŠT. 2`
when the photo points at a damage, `IMG_03` otherwise. The number is the photo's position in the
list, padded to two digits — the prototype's scheme, and more readable than a phone's own filename.

When `photosPending > 0`, an amber bar above the grid says not every photo from the tablet has
arrived. This is why `photos_expected` exists, and §6.3 is what keeps it honest.

### 4.6 Specifikacija — **editable**

Two equal cards side by side, `USLUGE` and `MATERIJAL`, each a list of the stored strings with a
`+` input and a `✕` per row. No empty state — the wizard's step 4 has none either and the input's
own placeholder already instructs.

**This is not the amend mode.** `docs/25` §3.3.9 and §6 both record services and materials as the
only fields that stay free after signing: no `amend` permission, no `⚠ MENJANO POSLE POTPISA`
stamp, no amber banner. Anyone with `intake_orders.update` may edit them, including the serviser
who remembered the filter he fitted. Presenting this inside the edit mode would wrongly suggest it
marks the customer's paper as altered.

`StepSpecification` is reused unchanged — it is already a controlled component taking `items` plus
`onChange(items)`, so the detail simply points `onChange` at a mutation instead of at wizard state.
Deleting is by **position**, since two identical service lines are legitimate.

**Every add and every remove commits immediately** with a `PATCH`, rolling back and toasting on
failure. No save button, no dirty state, nothing to forget to press — and the same behaviour as
step 4, where `✕` also removes at once. One rule for one piece of data, whichever screen it is
seen on.

### 4.7 Istorija

One card. Each row: time (130px, mono, `--mri-text2`) · what happened · who did it, separated by a
1px bottom border. Newest first — the endpoint already orders that way. The list is short by
construction after §6.1, so it needs no pagination.

Labels are built in the frontend from `action` + `transition` + `fromStatus`/`toStatus`, through a
lookup map (never a nested ternary) and Paraglide messages in sr and en:

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
| `restore` | Nalog vraćen na listu |

An unrecognised transition falls back to a neutral "Izmena" rather than rendering the raw key — new
transitions arrive with later phases and must not leak an English identifier onto a Serbian screen.
A missing `actorName` (a deleted user) renders as `—`, never blank.

### 4.8 An unfinished intake

`signedAt === null`. The prototype has no such screen — its detail assumes a signed order — so this
is ours, kept deliberately thin.

In place of the status bar, an **amber bar**: *"Nedovršen prijem · korak 3 od 5"*, with

- `NASTAVI PRIJEM →` — **only when `technicianId` is the current user**. It navigates to
  `/prijem/novi?resume=<id>`, a new Zod-validated search param on the wizard route. The wizard's
  existing `resumeServerOrder(id)` does the rest: it fetches the order from the server and adopts
  it, which is what makes resuming on another tablet work. Two guards on mount — the order must be
  unsigned, and it must be the caller's — each redirecting to the detail with a toast rather than
  silently starting an empty wizard. A `localStorage` buffer holding a *different* order does not
  raise its offer while `?resume=` is present.
- `ODUSTANI` — for the owner or anyone holding `delete`. Behind `<ConfirmDialog>`, worded for what
  actually happens: the draft is **really deleted** and the order number is released.

Tabs reduce to **Pregled and Fotografije**, showing whatever has been entered. No POTPISI card, no
advance button, no status-correction bar, no `UKLONI NALOG` — that dialog is about a signed
document and would be a lie here.

### 4.9 A removed order

Reachable only by someone holding `intake_orders.delete`, through the list's new `Uklonjeni` view
(§4.11) or a direct link. The detail renders exactly as a signed order does, minus every action
button, plus a bar at the top: the order is removed from the list, and `VRATI NA LISTU`.

Restore needs no confirmation — it is the constructive direction. It reports through a toast and
leaves the user on the detail, which becomes an ordinary one.

### 4.10 Removing a signed order

`<ConfirmDialog>`, wording from the prototype's modal: the order leaves the list but **stays in the
database** with a permanent trace of who removed it and when; this is not permanent deletion and
the signed document is not destroyed. On success, back to `/prijem` with a toast.

### 4.11 The list's view control

`intake-filter-bar.tsx` today carries a `Nedovršeni` checkbox shown only to the office. It reads as
"also show the unfinished ones", but the repository does
`unfinished ? signedAt IS NULL : signedAt IS NOT NULL` — checking it replaces the list rather than
extending it. A third mode is now needed, and unfinished and removed are mutually exclusive
(drafts are hard-deleted, so a removed order is always a signed one), which two checkboxes cannot
express.

The checkbox becomes a single select in the same place and at the same width, so the bar's measured
layout does not move: **`Prikaz: Aktivni · Nedovršeni · Uklonjeni`**. Office only, like the checkbox
it replaces.

### 4.12 Widths

Two columns on desktop and on the tablet in landscape (1180×820, where the wizard was measured).
**Below 1024px everything collapses to one column**, in this order: `OSNOVNI PODACI` → `ŠEMA` +
`NEDOSTACI` → `ZATEČENO STANJE` → `FOTOGRAFIJE` → `POTPISI` — the vehicle's condition before the
evidence of it. The 4-column grids (facts, checklist) go to 2 columns; the photo grids keep their
own counts. The detail is the one screen someone may open from a phone while walking the shop, so
430px is measured too, not merely tolerated.

## 5. Data flow

- `intakeOrderDetailOptions(id)` — prefetched in the route loader (`ensureQueryData`), read with
  `useSuspenseQuery`. One aggregate fetch, photos included, per the claims rule.
- `intakeOrderHistoryOptions(id)` — **not** prefetched. One tab out of four needs it, so it loads
  when that tab mounts, inside a Suspense boundary with a skeleton.
- The route follows the established detail pattern verbatim: `beforeLoad` guard, `validateSearch`,
  `pendingComponent`, and an `errorComponent` that tells a 404 apart from a real error — see
  `apps/internal-web/src/routes/_shell/reklamacije/emotive/$id.tsx`.
- Mutations (advance, change status, edit spec, delete, restore) invalidate the detail, the list and
  the summary. **No optimistic updates** except the spec list's own rollback-on-failure — `docs/04`
  reserves optimism for small actions, and this is one.
- SSE needs no work: the `intakeOrders` key already flows through the existing invalidation map, so
  an operator watching a detail sees a colleague's status change without refreshing.

## 6. Server work (V-6-1a)

All five land together, with integration tests, before a line of the screen is written.

### 6.1 The history projection is filtered

Every wizard step patch and every photo upload writes an audit row. A real intake with twelve
photos produces roughly twenty rows, of which about fifteen are the intake being filled in. The
prototype drew Istorija with two rows; the tab exists to answer *"who changed this after the
customer signed"*, and burying that under the filling is the failure mode.

`IntakeOrdersRepository.listHistory` drops a row when

    transition IN ('photo_uploaded', 'photo_removed')
    OR (action = 'update' AND transition IS NULL)

The rule keys on the **transition, not the action**. Deleting a photo is audited as
`AuditAction.Delete`, so a rule phrased as "drop noisy updates, keep every delete" would keep
`photo_removed` — a serviser retaking a blurred photo in step 3, which is the intake being filled
in and nothing more. Both photo transitions are therefore named explicitly.

`transition IS NULL` is the wizard's own step patches. It is scoped to `action = 'update'` because
creation also carries no transition and must stay. Filtering happens in SQL, so the projection
stays small on the wire too.

Kept, by construction: `create`, `sign`, `advance`, `change_status`, `amend_after_signing`,
`amend_photo_added`, `amend_photo_removed`, `discard_draft`, `soft_delete`, `restore`.

Tests pin both directions: filling an order in produces no history rows beyond creation, and an
amendment after signing produces exactly one.

### 6.2 An unfinished intake may only be continued by its own serviser

Today the rule exists **only in the UI**: typing a colleague's unfinished number hard-locks
`DALJE` and names them (`intake-wizard-note.tsx`), while the server would accept a `PATCH` of that
draft from anyone holding `intake_orders.update` — which an operator does. V-6 adds a second
entrance (`/prijem/novi?resume=<id>`, a typeable address), so the gap stops being theoretical.
`CLAUDE.md` is explicit that the server is the judge and UI hiding is courtesy; here there was no
judge.

A new `assertDraftOwner` runs after `loadVisible` on every mutating path while `signedAt IS NULL` —
`update`, `sign`, `uploadPhoto`, `deletePhoto` — and throws `ForbiddenError` (403, not 404: an
operator legitimately knows the order exists; a serviser was already stopped by the row scope).
**`delete` is deliberately exempt**, because the office cleaning up after a serviser who left the
firm is a rule of its own (`docs/25` §3.3.5).

An admin is not excepted. The signature block on that document says SERVISER and names the person
who looked at the car; letting anyone else fill the sheet in would make it say something untrue.
`advance` and `change_status` need no addition — `assertSignedForStatusChange` already refuses an
unsigned order.

Expect some existing V-3/V-5 tests to need their actor aligned. That is the rule reporting itself,
not a regression.

### 6.3 `photos_expected` moves with an amendment

`photosPending = photos_expected − arrived`, computed live. While the intake is being filled in
that is exact. The moment V-6-2 lets the office touch photos it starts lying in both directions:
removing a bad photo makes the order claim photos never arrived, and adding one silences the
warning for a tablet photo that is still lost.

So an **amendment shifts the expectation with it**: `photos_expected += 1` when the office adds a
photo after signing, `−= 1` when it removes one. The difference is untouched, and the number keeps
meaning exactly one thing — how many of the serviser's photos never made it off the tablet. Both
call sites already branch on `isAmendment`, so this is one line each, no migration and no new
field. It lands here rather than in V-6-2 because it is server work and this is the server pass.

### 6.4 A removed order can be restored

`POST /api/intake-orders/:id/restore`, gated by `intake_orders.delete` — whoever may remove may put
back, so no new permission. It clears `deleted_at`, audits with `transition: 'restore'`, and signals
the change.

It **refuses with 409 when the order's number has meanwhile been taken**, naming the conflicting
order in the error envelope's `details` the way the MR-number conflict already does. Removal
releases the number for reuse (the uniqueness lookup filters `deleted_at IS NULL`), which is the
point — the usual reason to remove an order is that it was a duplicate — so restore has to be able
to lose that race.

Reading a removed order needs a matching opening: `findById` gains `includeDeleted`, and the
service passes it only when the caller holds `intake_orders.delete`. A serviser keeps getting a 404.
Mutating paths call `assertNotDeleted` and answer `ConflictError` ("restore it first") rather than
the bare 404 the SQL filters would otherwise produce, which is confusing when the office is looking
straight at the order.

### 6.5 The list takes a view instead of a flag

`unfinished: boolean` becomes `view: 'active' | 'unfinished' | 'deleted'` in
`IntakeOrderListQuerySchema` and `IntakeOrdersSearch`, matching §4.11. The repository's condition
becomes a three-way: live and signed · live and unsigned · removed. The service **refuses**
`view=deleted` without `intake_orders.delete` rather than quietly falling back, so a hand-typed
query cannot silently return a different list than it asked for. Nothing is deployed from this
branch, so no URL needs migrating.

The KPI summary is untouched — it already counts live, signed orders only.

## 7. Files

New, under `apps/internal-web/src/features/intake-orders/detail/`:

`intake-detail-header.tsx` · `intake-status-bar.tsx` · `intake-draft-bar.tsx` ·
`intake-removed-bar.tsx` · `intake-detail-tabs.tsx` · `tab-overview.tsx` · `tab-photos.tsx` ·
`tab-spec.tsx` · `tab-history.tsx` · `history-labels.ts`

Changed: `routes/_shell/prijem/$id.tsx` (loader + composition, replacing the placeholder) ·
`routes/_shell/prijem/novi.tsx` (the `?resume=` search param) ·
`features/intake-orders/intake-filter-bar.tsx` (the view select) ·
`apps/api/src/modules/intake-orders/{repository,service,controller,routes}.ts` ·
`packages/shared/src/schemas/intake-order.wire.schema.ts` (view param, detail search schema) ·
`packages/shared/src/queries/intake-orders.ts` (restore mutation) ·
`packages/i18n/src/messages/{sr,en}.json` (~60 keys).

**Reused, not rewritten:**

- `IntakeDamageMap` — already supports read-only (`onPlace` omitted; it was written with the detail
  in mind). One addition: a size prop, since it is fixed at 236×386 and the detail wants 152×248.
- `StepSpecification` — a controlled component already; the detail only changes what `onChange`
  does (§4.6).
- `intakeDamageMarkerColour`, `INTAKE_SILHOUETTES`, `buildPhotoCells` and the lightbox from
  `intake-photo-grid.tsx`
- `INTAKE_STATUS_TONES` / `INTAKE_STATUS_LABELS` / `formatIntakeReceivedAt` from `intake-status.ts`
- `IntakePanel`, `ConfirmDialog`, `showInternalToast`, `internalButtonClasses`
- `resumeServerOrder` in the wizard, unchanged

Colours go through the `mri-*` utility classes. **Never `var(--mri-warn)` and friends** — the
status hues exist only inside `@theme inline`, and an unresolved `var()` silently drops the
property to its initial value. That is how the fuel dial's amber arc was invisible for a day
(CLAUDE.md §5).

## 8. Verification

1. Full gate green at each pass: `pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration`.
2. **V-6-1a integration tests**, one per rule in §6: the history filter in both directions · an
   operator refused (403) on a serviser's draft while still able to delete it · `photos_expected`
   holding its difference across an amend add and an amend remove · restore, including the 409 when
   the number was taken · `view=deleted` refused without `delete`.
3. **V-6-1b component tests**: `history-labels.ts` including the unknown-transition fallback and the
   missing-actor case · the draft bar's owner-only continue button · the checklist's three states
   and the "nisu provereni" count · the spec tab's rollback when a `PATCH` fails.
4. In the browser on `pnpm dev:all`, both accounts:
   - operator: open a signed order, walk all four tabs, add and remove a service line, correct the
     status and watch the entry appear in Istorija, remove the order, find it under `Uklonjeni`,
     restore it;
   - serviser: open own order (advance works, no status bar, no remove, spec editable), open a
     colleague's id straight from the address bar and get the not-found screen, then try
     `/prijem/novi?resume=<colleague's draft>` and be turned away;
   - both: open an unfinished draft — the continue button appears only for its owner, and continuing
     lands on the right step.
5. Widths at **1180×820**, **820** and **430**: measure `scrollWidth` vs `clientWidth` on the page
   and audit each cell against its column's right edge. Nikola picks the viewport from DevTools'
   Dimensions menu; never resize his window.

## 9. Reported to Nikola, and decided by him

1. **The print button.** `Uputstvo Prijem Vozila` has a `ŠTAMPAJ` section with a picture of a
   printed work order. The button ships **disabled** until V-7 is specified — his call, over hiding
   it or wiring `window.print()` to something that is not the document he means.
2. **Three departures from the prototype**, all approved knowingly: the `ZATEČENO STANJE` card and
   the address as a ninth fact (§4.4), because the data otherwise has no reader; the editable
   Specifikacija (§4.6), because his own "stalno otvorene" decision had nowhere to live; and the
   restore path with its `Uklonjeni` view (§4.9, §4.11), because a one-way delete contradicts the
   manual's own *"greška se ispravlja, ali se ne krije"*.
3. **A bug waiting in the prototype's print, for V-7.** It computes the checklist as
   `yes ? '✓' : '✕'`, so an unchecked item prints as "NE" — a false statement on a signed document.
   Print must carry the third state (§4.4).
4. **`CLAUDE.md` §5 is stale:** it says two unresolved `var(--mri-warn)` / `--mri-archived` uses
   remain in `intake-damage-map.tsx`. V-4c-0 (`5dee824`) fixed them and the file's own comment now
   describes the bug in the past tense. The paragraph is corrected as part of V-6-1a.
