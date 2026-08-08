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

**No migration and no new permission.** `IntakeOrderDetailSchema` already carries almost every
value the screen needs: `amendedAt`, `amendedByName`, `photosPending`, `photos`, both signatures,
`draftStep`, `technicianId`, `checklist`, `equipmentNote`, `ownerAddress`, `damages`, `services`,
`materials`. Restore reuses `intake_orders.delete` — whoever may remove may put back.

**One field is added to the wire: `deletedAt: string | null`.** The column exists
(`intake_orders.deleted_at`), so there is still no migration — but without it on the wire a removed
order and a live one deserialise identically, and §4.9's screen could neither draw its bar nor hide
the action row. It would have had to infer the state out of band, from which list the user happened
to arrive through. Mapped in `detailSelection`/`mapDetail` alongside the fields already there.

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
| DATUM PRIJEMA | `receivedAt` (set at creation, i.e. when the car actually arrived), date · time, mono — **with the year** (see below) |
| SERVISER | `technicianName` |
| KILOMETRAŽA | `mileage` + " km", `—` when null, mono |
| NAČIN DOLASKA | `arrivalMode`, translated |
| VIN | `vin` or `—`, mono |
| TELEFON | `ownerPhone`, mono |
| GORIVO | `fuelLevel` + "/8", mono 600 |
| NEDOSTACI | `damages.length` — **green when 0, red otherwise** |
| ADRESA | `ownerAddress` or `—` |

`formatIntakeReceivedAt` is the **list's** format (`25.07 · 09:14`) and must not be reused here: the
detail is the archival read of a document kept for years, reachable from `Uklonjeni`, from a direct
link and later from the print, where a year-less date on two intakes for the same plate is
ambiguous. A second helper `formatIntakeReceivedAtLong(iso, locale)` sits beside it in
`intake-status.ts`; the list keeps the short one.

**`ŠEMA` + `NEDOSTACI I PRIMEDBE`** in one card. The silhouette renders at **152×248** through the
existing `IntakeDamageMap` with `onPlace` omitted. Each damage is a numbered circle in its type's
colour plus its label; an empty list prints *"Nema uočenih nedostataka pri prijemu."* Below,
`PRIMEDBE VLASNIKA` in italic `--mri-text2` from `ownerRemarks`.

A size prop alone is **not** enough. The map draws a `POZADI`/`NAPRED` orientation group at
`fontSize="9"` in the 340×556 space (`intake-damage-map.tsx:93-107`); at the wizard's 236px that
renders around 6px, and at the detail's 152px around 4px — two illegible smudges. The prototype's
detail map (`prijem-prototip-v2.dc.html:494-504`) draws silhouette paths and markers only. So the
prop is `variant: 'wizard' | 'detail'`, and the detail variant sets the smaller box **and** omits
that group.

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

> **Superseded 2026-08-05.** This section used to put an amber "not every photo arrived" bar above
> the grid. That warning now lives once, page-level, under the header — it is the first thing the
> screen says after the wizard drops the serviser here, and it is readable from all four tabs
> instead of only this one. Do not build it again inside the tab; see
> `docs/superpowers/specs/2026-08-05-intake-open-questions-design.md` §2.
> `photos_expected` still exists for exactly this reason, and §6.3 is still what keeps it honest.

### 4.6 Specifikacija — **editable**

Two equal cards side by side, `USLUGE` and `MATERIJAL`, each a list of the stored strings with a
`+` input and a `✕` per row. No empty state — the wizard's step 4 has none either and the input's
own placeholder already instructs.

**This is not the amend mode.** `docs/25` §3.3.9 and §6 both record services and materials as the
only fields that stay free after signing: no `amend` permission, no `⚠ MENJANO POSLE POTPISA`
stamp, no amber banner. Anyone with `intake_orders.update` may edit them, including the serviser
who remembered the filter he fitted. Presenting this inside the edit mode would wrongly suggest it
marks the customer's paper as altered.

The reusable part is **not** `StepSpecification`: its props are `values: IntakeWizardValues` plus
`onPatch` (`step-specification.tsx:8-11`), a 17-field wizard form struct the detail neither has nor
wants. The component that actually takes `items` + `onChange(items)` is `SpecList`
(`step-specification.tsx:40-57`) and it is **module-private**. It is exported as `IntakeSpecList`
and rendered by both `StepSpecification` and the detail's `tab-spec.tsx`, which puts
`step-specification.tsx` on the changed list rather than the reused one.

Two details the extraction has to carry:

- The materials card hard-codes an info note (`:34`, "Usluge i materijal mogu da se dopunjuju i
  kasnije"). The prototype's Spec tab has no note (`prijem-prototip-v2.dc.html:616-631`), so `note`
  becomes an optional prop the detail leaves unset.
- The typed line must survive a failed `PATCH`. **As built, `IntakeSpecList` already does this** —
  `add()` clears its draft only once `onChange` resolves, and keeps it when the promise rejects. So
  there is nothing to restore from `tab-spec.tsx`; its only obligation is to return a promise that
  actually rejects, which means `mutateAsync`, not `mutate`. (Earlier drafts of this section
  described the pre-extraction component, which cleared unconditionally.)

Deleting is by **position**, since two identical service lines are legitimate.

**Every add and every remove commits immediately** with a `PATCH`. The list is optimistic through
React Query's `onMutate` + `setQueryData`, so `useSuspenseQuery` re-renders with the row already
there and the extracted component needs no loading state of its own; a failure rolls the cache
back and toasts. No save button, no dirty state, nothing to forget to press — the same behaviour as
step 4, where `✕` also removes at once. One rule for one piece of data, whichever screen it is seen
on.

**This edit is audited under its own transition** so it reaches the Istorija tab — see §6.1, which
would otherwise drop exactly these rows.

### 4.7 Istorija

One card. Each row: time (130px, mono, `--mri-text2`) · what happened · who did it, separated by a
1px bottom border. Newest first — the endpoint already orders that way. The list is short by
construction after §6.1, so it needs no pagination.

Labels are built in the frontend from `action` + `transition` + `fromStatus`/`toStatus`, through a
lookup map (never a nested ternary) and Paraglide messages in sr and en:

> **Reconciled with what shipped, 2026-08-08.** Three strings below are not what the first draft
> wrote. `create` reads "Nalog otvoren", not "Nalog kreiran" — the shop opens a nalog, it does not
> create a record. `amend_after_signing` reads "menjano", not "ispravljeno", because the existing
> `intake_signature_note_amended` already says "je menjano" about the same event and "ispravljeno"
> asserts the earlier record was WRONG, which nothing in the system knows. The fallback is a full
> clause ("Nalog izmenjen"), not the bare noun "Izmena", so it reads like its nine neighbours.

| transition / action | Serbian | key |
| --- | --- | --- |
| `create` | Nalog otvoren | `intake_history_created` |
| `sign` | Nalog potpisan | `intake_history_signed` |
| `advance` / `change_status` | Status: {from} → {to} | `intake_history_status` |
| `amend_after_signing` | Zatečeno stanje menjano posle potpisa | `intake_history_amended` |
| `amend_photo_added` | Fotografija dodata posle potpisa | `intake_history_photo_added` |
| `amend_photo_removed` | Fotografija uklonjena posle potpisa | `intake_history_photo_removed` |
| `spec_updated` | Usluge i materijal izmenjeni | `intake_history_spec_updated` |
| `soft_delete` | Nalog uklonjen sa liste | `intake_history_removed` |
| `restore` | Nalog vraćen na listu | `intake_history_restored` |

`discard_draft` deliberately has **no** label. Discarding an unfinished intake hard-deletes the row
(`docs/25` §3.3.7), so `GET /:id/history` 404s before the projection ever runs — a label for it
would be dead the day it was written. The audit row is still written; it is the admin audit log's
only trace of the discard.

An unrecognised transition falls back to a neutral "Nalog izmenjen" rather than rendering the raw key — new
transitions arrive with later phases and must not leak an English identifier onto a Serbian screen.
A missing `actorName` (a deleted user) renders as `—`, never blank.

### 4.8 An unfinished intake

`signedAt === null`. The prototype has no such screen — its detail assumes a signed order — so this
is ours, kept deliberately thin.

In place of the status bar, an **amber bar**: *"Nedovršen prijem · korak 3 od 5"*, with

- `NASTAVI PRIJEM →` — **only when `technicianId` is the current user**. It navigates to
  `/prijem/novi?resume=<id>`, a new Zod-validated search param on the wizard route. The wizard's
  existing `resumeServerOrder(id)` does the fetching and adopting, which is what makes resuming on
  another tablet work — but consuming the param is **not** free, and `intake-wizard.tsx` is a
  changed file, not a reused one:

  - **The param must be read before both existing mount effects, not after.** The buffer effect
    writes `mrr:internal:intake-draft` from the wizard's state on mount, so by the time the fetch
    resolves it has already overwritten another intake's buffer with empty values — and with the
    offer suppressed there is no in-memory copy to restore from. A `resuming` flag derived from the
    search param gates both: the offer effect does not raise, and the buffer effect does not write
    until `adoptOrder` has run or the attempt has failed.
  - **Two guards, then adopt:** the order must be unsigned and must be the caller's. Either failing
    redirects to the detail with a toast rather than silently starting an empty wizard.

- **The same two guards go on the buffer path**, not only on `?resume=`. Shop tablets are shared: a
  serviser leaves a draft in `localStorage`, a colleague or an operator signs in on that tablet and
  is offered "Nastavi" on step 1. Today the resulting `PATCH` quietly succeeds — that is the hole
  §6.2 closes — and after §6.2 it would 403 on every single action with a generic save error and no
  way out. So `resumeBuffer` fetches the order and adopts it only when `technicianId` matches and
  `signedAt` is null; otherwise it clears the buffer and starts clean.

- **The list's own banner uses the same param.** `routes/_shell/prijem/index.tsx` already renders a
  `NASTAVI PRIJEM` link for the most recent draft; leaving it on a bare `/prijem/novi` would ship
  two buttons with the same label and different behaviour, the more prominent one being the one that
  only works on the tablet holding the buffer. It gets `search={{ resume: draft.id }}`.
- `ODUSTANI` — for the owner or anyone holding `delete`. Behind `<ConfirmDialog>`, worded for what
  actually happens: the draft is **really deleted** and the order number is released.

Tabs reduce to **Pregled and Fotografije**, showing whatever has been entered. No POTPISI card, no
advance button, no status-correction bar, no `UKLONI NALOG` — that dialog is about a signed
document and would be a lie here.

### 4.9 A removed order

Reachable only by someone holding `intake_orders.delete`, through the list's new `Uklonjeni` view
(§4.11) or a direct link. The detail renders exactly as a signed order does, minus every action
button and minus the editable spec inputs, plus a bar at the top: the order is removed from the
list, and `VRATI NA LISTU`. All of it keys on the wire's `deletedAt` (§2) — there is no other way
for the screen to know.

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
- Mutations (advance, change status, delete, restore) invalidate the detail, the list and the
  summary. **No optimistic updates** except the spec list's own rollback-on-failure — `docs/04`
  reserves optimism for small actions, and this is one.
- **A spec edit is the exception, and deliberately narrow** (corrected 2026-08-08, as built): it
  writes the server's answer straight into the detail key and invalidates ONLY
  `intakeOrderKeys.history(id)`. Not the list — it carries no services column, so a refetch would
  cost a request to redraw identical rows. Not the detail either: an invalidation there races the
  optimistic write it just made, which is the bug the `cancelQueries` in `onMutate` exists to
  prevent. History is invalidated because the PATCH writes a `spec_updated` row AND because
  `resource_changed` never reaches a serviser's channel, so nothing else would ever refresh it.
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

**A new transition has to be written for this filter to be correct.** `IntakeOrdersService.update`
audits a non-amendment patch as `action = 'update'` with **no** transition
(`intake-orders.service.ts:258-260`) — and §4.6's always-open Specifikacija goes through exactly
that path. So the filter as first written would have deleted the only edit V-6-1 newly allows on a
signed order: an operator adds "zamena filtera" to a customer-facing work order and Istorija shows
nothing, while §4.2 prints *"Svaka ispravka se upisuje u Istoriju"* right above it.

The fix is to tag the row, not to widen the filter — widening it would drag every wizard step patch
back in. In `update`, when `before.signedAt !== null` and the patch is not an amendment, audit with
`transition: 'spec_updated'`. `isAmendment` stays false, so `amended_at` is not stamped and no
`⚠ MENJANO POSLE POTPISA` pill appears: this is a free field, not an alteration of the signed
condition.

Kept, by construction: `create`, `sign`, `advance`, `change_status`, `amend_after_signing`,
`amend_photo_added`, `amend_photo_removed`, `spec_updated`, `soft_delete`, `restore`. Not listed:
`discard_draft`, for the reason in §4.7 — the row it belongs to no longer exists.

Tests pin three directions: filling an order in produces no history rows beyond creation, an
amendment after signing produces exactly one, and **a post-signing services edit produces exactly
one** — the case the first draft of this filter silently swallowed.

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

**No existing test exercises a non-owner mutating a draft** — the hole ships with no prior coverage
at all, which is why it survived V-3 and V-5. So nothing here licenses "aligning" a red test: if a
test goes red during this task it is a finding, not a chore. (The one deliberate inversion in this
phase is in §6.4, and it is named there.)

The rule ships with its own four cases plus the exemption, listed in §8.2.

### 6.3 `photos_expected` moves with an amendment

`photosPending = photos_expected − arrived`, computed live. While the intake is being filled in
that is exact. The moment V-6-2 lets the office touch photos it starts lying in both directions:
removing a bad photo makes the order claim photos never arrived, and adding one silences the
warning for a tablet photo that is still lost.

So an **amendment shifts the expectation with it**: `photos_expected += 1` when the office adds a
photo after signing, `−= 1` when it removes one. The difference is untouched, and the number keeps
meaning exactly one thing — how many of the serviser's photos never made it off the tablet. Both
call sites already branch on `isAmendment`. It lands here rather than in V-6-2 because it is server
work and this is the server pass; no migration and no new field.

**The shift must be floored in SQL, not written as a bare `− 1`.** The column is nullable
(`integer('photos_expected')`) and carries a CHECK (`intake_orders_photos_expected_check`,
`photos_expected >= 0`, `packages/db/src/schema/intake-orders.ts:119`). `photos_expected` can
legitimately sit below the arrived count — a retry that lands twice, or a stale count at signing —
and `pendingPhotoCount` clamps that to zero so nobody ever notices. A naive decrement then walks
the column under zero and Postgres answers with a raw constraint violation the office sees as an
unexplained failure. The update is therefore
`GREATEST(0, COALESCE(photos_expected, 0) + delta)`, and an integration test removes more photos
than were expected.

### 6.4 A removed order can be restored

`POST /api/intake-orders/:id/restore`, gated by `intake_orders.delete` — whoever may remove may put
back, so no new permission. It clears `deleted_at`, audits with `transition: 'restore'`, and signals
the change.

It **refuses with 409 when the order's number has meanwhile been taken**, naming the conflicting
order in the error envelope's `details` the way the MR-number conflict already does. Removal
releases the number for reuse — the uniqueness index is **partial**
(`uq_intake_orders_order_number_key … WHERE deleted_at IS NULL`,
`packages/db/src/schema/intake-orders.ts:133`) — which is the point, since the usual reason to
remove an order is that it was a duplicate. That also means the check must happen **before** the
`UPDATE`: left to the database, restore fails with a raw 23505 instead of the 409 this promises.

Carrying the conflicting order in `details` is not free either: `ConflictError` has no payload
today, so it needs a typed subclass plus a branch in `core/middleware/error-handler.ts`. Both files
are budgeted in §7.

Reading a removed order needs a matching opening: `findById` gains `includeDeleted`, and the
service passes it only when the caller holds `intake_orders.delete`. A serviser keeps getting a 404.

**One existing test inverts deliberately, and it is the only one in this phase that may go red on
purpose.** Today an office actor reading a soft-deleted order gets a 404; after this change the
office is precisely the actor that must see it, so the assertion moves to an actor *without*
`intake_orders.delete`. Anything else that turns red is a finding.

Mutating paths call `assertNotDeleted` and answer `ConflictError` ("restore it first") rather than
the bare 404 the SQL filters would otherwise produce, which is confusing when the office is looking
straight at the order. The paths are named, not implied: `update`, `sign`, `advance`,
`changeStatus`, `uploadPhoto`, `deletePhoto` **and `delete` itself** — without the last one a
double removal from a stale tab writes a second "Nalog uklonjen sa liste" line into the record for
a removal that never happened, and answers with a success toast. Exempt: `restore`, `findById` and
`listHistory`, the reads §4.9 is built on.

### 6.5 The list takes a view instead of a flag

`unfinished: boolean` becomes `view: 'active' | 'unfinished' | 'deleted'` in
`IntakeOrderListQuerySchema` and `IntakeOrdersSearch`, matching §4.11. The service **refuses**
`view=deleted` without `intake_orders.delete` rather than quietly falling back, so a hand-typed
query cannot silently return a different list than it asked for. Nothing is deployed from this
branch, so no URL needs migrating.

**Only the office branch becomes three-way. The serviser's exemption stays exactly as it is.**
`scopeCondition` (`intake-orders.repository.ts:250-257`) already forks: an `own` scope returns
**every live row of the caller, drafts included**, and never looks at the flag; only the `all`
scope applies it. Written as one flat three-way predicate — which is how the first draft of this
section read — `active` would mean `signed_at IS NOT NULL` for everyone, and since a serviser never
sends the param (the control is office-only) he would get the default and **lose every draft from
his list**: the row he resumes from, the amber "Nedovršen prijem · korak N od 5" banner, and with
them the only path the shop floor has back into an unfinished intake. So the change is confined to
the `all` branch, plus the new `deleted` case, and a test pins that a serviser's draft still comes
back under the default view.

The rename is a compile break wherever the flag is built, which is more places than the shape of
the change suggests: the list route's search state, the filter bar, and the query helpers in
`packages/shared/src/queries/intake-orders.ts` that exist precisely so the route and the loader
cannot drift apart. All of them are named in §7.

The KPI summary is untouched — it already counts live, signed orders only.

## 7. Files

**New**, under `apps/internal-web/src/features/intake-orders/`:

- `detail/intake-detail-header.tsx` · `detail/intake-status-bar.tsx` · `detail/intake-draft-bar.tsx`
  · `detail/intake-removed-bar.tsx` · `detail/intake-detail-tabs.tsx` · `detail/tab-overview.tsx` ·
  `detail/tab-photos.tsx` · `detail/tab-spec.tsx` · `detail/tab-history.tsx` ·
  `detail/history-labels.ts`
- `wizard/intake-photo-lightbox.tsx` — the overlay currently inlined in
  `step-damage-photos.tsx:268-315`, lifted out so the detail's two photo surfaces do not each grow
  their own copy. Its delete button moves behind an optional `onDelete`, left unset in V-6-1 (§2
  defers post-signing photo deletion to V-6-2).
- `intake-labels.ts` — the label maps the detail needs that today live private inside wizard
  components: the eight checklist names (`intake-checklist-grid.tsx`), the vehicle-type names and
  the arrival-mode names. Copying them into `tab-overview.tsx` and `intake-detail-header.tsx` would
  be the third copy of each, and a rename would then silently update the wizard and not the detail.

**Changed:**

| File | Why |
| --- | --- |
| `routes/_shell/prijem/$id.tsx` | loader + composition, replacing the placeholder |
| `routes/_shell/prijem/novi.tsx` | the `?resume=` search param |
| `routes/_shell/prijem/index.tsx` | reads `search.unfinished` at `:114,:117`, so the view rename is a compile break here; and its draft banner's `NASTAVI PRIJEM` at `:165` gains `search={{ resume }}` (§4.8) |
| `features/intake-orders/intake-filter-bar.tsx` | the view select replaces the checkbox |
| `features/intake-orders/wizard/intake-wizard.tsx` | `resumeOrderId` prop, the mount-effect resume, the two guards, the buffer-effect gating, and the same guards on `resumeBuffer` (§4.8) |
| `features/intake-orders/wizard/step-specification.tsx` | export `SpecList` as `IntakeSpecList` with an optional `note` (§4.6) |
| `features/intake-orders/wizard/step-damage-photos.tsx` | render the extracted lightbox instead of its inline copy |
| `features/intake-orders/wizard/intake-checklist-grid.tsx` | read its labels from `intake-labels.ts` |
| `features/intake-orders/wizard/intake-damage-map.tsx` | the `variant` prop (§4.4) |
| `features/intake-orders/intake-status.ts` | add `formatIntakeReceivedAtLong` (§4.4) |
| `apps/api/src/modules/intake-orders/{repository,service,controller,routes}.ts` | §6.1–§6.5 |
| `apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts` | the new cases in §8.2, and the one deliberate inversion in §6.4 |
| `apps/api/src/core/errors/domain-errors.ts` + `core/middleware/error-handler.ts` | the typed conflict that carries the clashing order in `details` (§6.4) |
| `packages/shared/src/schemas/intake-order.wire.schema.ts` | `deletedAt` on the detail, the `view` param, `IntakeDetailSearchSchema` |
| `packages/shared/src/queries/intake-orders.ts` | `IntakeOrderListFilters` + `intakeFiltersFromSearch` + the query-string builder all carry `unfinished` today (`:35,:44,:74`); plus `restoreIntakeOrder`, following the existing plain-function shape of `deleteIntakeOrder` |
| `packages/i18n/src/messages/{sr,en}.json` | ~40 new keys; `intake_filter_unfinished` is replaced by the view-select labels |

**Reused, and verified to fit:**

- `IntakeDamageMap` — already supports read-only (`onPlace` omitted; it was written with the detail
  in mind). It needs the `variant` prop of §4.4, which is more than the size.
- `buildPhotoCells` from `intake-photo-grid.tsx`; `intakeDamageMarkerColour` from
  `intake-damage-map.tsx`; `INTAKE_SILHOUETTES` from `intake-silhouettes.ts`; `buildIntakePhotoUrl`
  from the shared queries — the detail must never build an `/api/attachments` URL.
- `INTAKE_STATUS_TONES` / `INTAKE_STATUS_LABELS` / `INTAKE_STATUS_ORDER` from `intake-status.ts`
- `resumeServerOrder`, `adoptOrder` and `valuesFromOrder` — the resume machinery itself is sound;
  what changes is only when and under what guards it is called.
- `IntakePanel`, `ConfirmDialog` (the caller owns `open`), `showInternalToast`,
  `internalButtonClasses`, `ListPagination`
- i18n already carries `intake_card_condition`, all eight `intake_checklist_*` labels,
  `intake_field_equipment_note`, `intake_field_owner_address`, `intake_status_*` and
  `intake_detail_title` — which is why the key estimate is ~40 and not ~60.

Colours go through the `mri-*` utility classes. **Never `var(--mri-warn)` and friends** — the
status hues exist only inside `@theme inline`, and an unresolved `var()` silently drops the
property to its initial value. That is how the fuel dial's amber arc was invisible for a day
(CLAUDE.md §5).

## 8. Verification

1. Full gate green at each pass: `pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration`.
2. **V-6-1a integration tests.** The existing suite already provides `floorActor`, `officeActor`,
   `signedOrder`, `createInput` and `uniqueNumber`; these slot into its `describe` blocks:
   - _history_ — filling an order in adds no rows beyond creation · an amendment adds exactly one ·
     **a post-signing services edit adds exactly one** (`spec_updated`) · a discarded draft is
     unreachable rather than labelled
   - _the freeze after signing / ownership_ — an operator refused (403) on a serviser's draft for
     each of `update`, `sign`, `uploadPhoto`, `deletePhoto` · the same operator still able to
     `delete` it · the owner still able to do all four
   - _photos_ — `photos_expected` holds its difference across an amend add and an amend remove ·
     removing more photos than were expected does **not** violate the CHECK constraint
   - _removal_ — restore returns the order to the list · restore answers 409, with the clashing
     order in `details`, when the number was taken meanwhile · a second `delete` on an already
     removed order is refused instead of writing a second audit row
   - _row-level scope_ — the office reads a removed order (the deliberate inversion, §6.4) while an
     actor without `intake_orders.delete` still gets 404 · `view=deleted` refused without the
     permission · **a serviser's draft still comes back under the default view** (§6.5)
3. **V-6-1b component tests**: `history-labels.ts` including the unknown-transition fallback and the
   missing-actor case · the draft bar's owner-only continue button · the checklist's three states
   and the "nisu provereni" count · the spec tab's rollback when a `PATCH` fails, **including that
   the typed line is restored into the input** (§4.6) · the detail map rendering without the
   orientation group.
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

---

## 10. What the verification pass changed

Before this spec became a plan it was read back against the code by five independent adversarial
passes whose brief was to break it. Twenty-nine findings survived a second, skeptical review; the
five that changed the design rather than the file list are worth keeping in the record, because
each one would have shipped a broken feature that looked finished:

1. **The history filter deleted the feature the same spec introduces.** A post-signing services
   edit is audited as `action = 'update'` with no transition — precisely the shape §6.1 drops. The
   Istorija tab, whose stated purpose is "who changed this after the customer signed", would have
   shown nothing for the only edit that is possible after signing. Fixed with the `spec_updated`
   transition (§4.7, §6.1).
2. **The list's view rename would have hidden every serviser's drafts.** `scopeCondition` forks on
   the scope and the office branch alone reads the flag; written as one flat three-way it takes the
   shop floor's drafts — and its only route back into an unfinished intake — off the screen (§6.5).
3. **The screen could not tell a removed order from a live one.** `IntakeOrderDetailSchema` has no
   `deletedAt`, so §4.9's whole restore surface was unbuildable as written (§2).
4. **`photos_expected` sits under a CHECK constraint** and is nullable; the bare `− 1` in §6.3
   would have answered an ordinary office action with a raw Postgres error (§6.3).
5. **Two of the three "reused, not rewritten" components were not reusable.** The spec list is
   module-private behind a wizard-shaped wrapper, and the lightbox does not exist as a component at
   all — it is inlined in a shipped V-4c file, with a delete action this phase defers (§4.6, §7).

The pass also corrected the file list from eight entries to sixteen. That gap is the reason the
phase is split server-first: costed off the original list, V-6-1a could not have been gate-green on
its own, because the shared type change breaks internal-web's typecheck in the same commit.
