# docs/25 — Prijem vozila u servis (vehicle service intake)

> **Status: DESIGN, all decisions locked.** First pass 2026-07-26 (from Claude Design's original
> handoff). **Second pass 2026-07-26**, after prototype v2 + `dopuna-2` came back: the role model,
> the shell for a serviser, draft ownership and the list's treatment of unfinished intakes were all
> resolved with Nikola. **Implementation in progress on `feat/vehicle-intake`: V-0 through V-5 are
> done — V-0..V-4b pushed, V-4c and V-5 committed and awaiting Nikola's push (production untouched
> — Railway deploys `main`).** Next is V-6, the four-tab detail. Build only on Nikola's per-phase
> go. **V-7 (print) is not specified** — its premise was wrong, see §3.5.
>
> **Update 2026-08-10: the module is complete.** V-6-2 (režim izmene) and **V-7 (print)** are both
> built and on `feat/vehicle-intake`. The line above about V-7 being unspecified is history — its
> premise was settled by Nikola's own print spec, see §3.5.
>
> This is a **new subsystem, not a claim family.** It shares nothing with EMOTIVE/DOMACE except
> the app shell, the attachments pipeline, audit and SSE. No MR number, no faults, no warranty
> report, no outcome, no portal.

---

## 1. What it is

When a vehicle arrives at the service shop, a **serviser** fills a digital work order on a tablet,
replacing the paper "radni nalog za servis": vehicle + owner data, an intake checklist, **photos**,
a **damage map**, then **both the serviser and the owner sign on screen** and the document is
**printed**.

The point is **proof of the vehicle's condition at intake** — defence against false damage claims
("vi ste mi ogrebli auto"). That is why photos, the damage map and both signatures are mandatory
parts, not nice-to-haves.

**Users:** serviseri on a tablet (iPad landscape 1180×820, finger, often gloves, next to the
vehicle) and the office on a desktop. Internal only, Serbian UI. **Not** for clients — the portal
is untouched.

**Explicitly out of scope:** invoicing, prices, parts inventory, scheduling, saobraćajna reader,
any link to reklamacije, client portal. Services and materials are **plain string lists** — no
catalog, no quantities, no prices.

---

## 2. Source material

| What | Where | Note |
| --- | --- | --- |
| Design handoff (original, still binding where unchanged) | `Downloads/handoff 3/2026-07-26-prijem-vozila-handoff.md` | **not in the repo** — Nikola holds it |
| **Addendum 1** (14 items we sent to Claude Design) | `docs/design-handoffs/2026-07-26-prijem-vozila-dopuna.md` | in the repo |
| **Addendum 2** (Design's answer, after prototype v2) | `Downloads/handoff 3/2026-07-26-prijem-dopuna-2.md` | **authoritative where it differs from the original** |
| **Clickable prototype v2** | `Downloads/handoff 3/prijem-prototip-v2.dc.html` | **the source of truth for behaviour**; UI phases are built against this |
| Static screens / variants | `Downloads/handoff 3/prijem-ekrani.dc.html` | 1a chosen for UI, 2b for print |
| Printed manual for serviseri | `Downloads/handoff 3/Uputstvo Prijem Vozila.dc.html` | goes to the workers — see §9 |

The prototype ships the four vehicle silhouettes (`SIL`) and the per-type zone function
(`zoneOf(type, x, y)`). **Both are transferred 1:1 — never redrawn**, or markers, defect list and
print stop agreeing.

---

## 3. Locked decisions

### 3.0 The rule that outranks the rest: the screen leads, the worker rides

**Nikola, 2026-08-10, and it binds the whole module:** the people using this are not computer
literate. They will find every hole. Every moment where the screen does not say what happens next
becomes *"komplikovano je, ne razumem, ne znam šta da radim"* — and then the tablet gets put down
and the job goes back onto paper. So the module **leads them**; they are along for the ride.

In practice, and these are testable, not decorative:

1. **No screen ever ends without a next action.** If the worker finished something, the thing he
   does next is on the screen, and it is the loudest thing on it. He never has to know where to go.
2. **What can be decided for him, is.** A choice only exists when he is the only one who can
   answer it. Every other setting has a default and lives out of his way — in admin (§3.9), not in
   his flow.
3. **An error says what to DO, not what failed.** "Zaključivanje naloga nije uspelo" is a dead end
   with a customer standing at the car. "Nema mreže — sačuvano na tabletu, pošalji kad se vrati
   signal" is an instruction.
4. **Nothing that looks tappable is a dead end.** A control that cannot succeed is not shown. This
   is the same rule that killed eight "Pokušaj ponovo" buttons on 2026-08-06.
5. **He is never asked for something he was not given.** No field whose answer lives in another
   program, no jargon, no abbreviation he does not use out loud in the shop.

⚠️ **Known dead ends this rule condemns, not yet fixed** — they are scheduled, not forgotten:
finishing an intake without a network fails with `intake_sign_failed` and the order stays unsigned
(§3.6, A3); a photo that fails to upload shows a red cell and no instruction (A4).

### 3.0.1 The intake ends at the signatures (2026-08-10)

The wizard is **four steps**: `Vozilo i vlasnik · Ček-lista · Stanje i fotke · Potpisi`.

**Specifikacija left it.** Services and materials are the SERVISER's work, done later from the
detail's Specifikacija tab — the receiving worker never sees the field, so there is no step to
misread and no "do I fill this in?" to answer (Nikola, 2026-08-10). The list component survived the
step and lives in `wizard/intake-spec-list.tsx`.

**The printed order opens itself** the moment both signatures are in: the wizard hops to the detail
with `?stampa`, and the detail opens the preview and clears the flag so a reload does not print it
again (`detail/use-consume-print-flag.ts`). Handing the paper over is the next thing that has to
happen, so it is not behind a button somebody has to find.

**And the signatures FREEZE the record (H, 2026-08-11).** The owner walks out holding that printed
sheet, so anything that can still move on our side is a conflict with a document he signed — and
grounds for a complaint against his own evidence. Two freezes, each on its own pair of signatures:

| Moment | Frozen | Still live |
| --- | --- | --- |
| **Intake signatures** (worker + owner) → `signed_at` | vehicle, owner, the signed phone, checklist, fuel, damages, equipment note, intake photos | **Specifikacija** (`services`, `materials`) — adding **and removing** · the status ladder · discarding a **draft** (hard delete, as today) · the added contact number (§5) |
| **Handover signatures** (serviser + owner, status Preuzeto) | **everything, Specifikacija included** — a signed handover does not go backwards, status least of all | nothing |

The second freeze lands physically with part F, when handover signatures first exist; the rule is
written now so F is not a third time the same thing gets decided.

- `FREE_AFTER_SIGNING` in `intake-orders.service.ts` is the WHOLE list, and the refusal is on the
  field's **name**, never on its value — "send it again with the same value" must not be a way past
  the freeze.
- **No exception for admin.** A freeze with an exception is not a freeze, and the server judges it —
  `assertPostSigningPatchAllowed` has no permission branch at all.
- A signed order **cannot be removed**: if a signed record may be destroyed, freezing its fields is
  weaker than deleting the whole document. Only an unfinished draft is discarded.
- A photo after signing is accepted **only from the order's own serviser and only while
  `photosPending > 0`** — that is the tablet delivering what it already held at signing (§3.6), and
  the door is exactly as wide as the record admits something is missing. **Removing** a photo after
  signing is refused to everyone.

⚠️ **The amend mode (V-6-2, built 10.08. — the "menjano posle potpisa" stamp, permission
`intake_orders.amend`, columns `amended_at`/`amended_by`) is RETIRED. Do not bring it back.** It
answered the same risk with "allow it, but say so loudly"; the announcement WAS the divergence.

⚠️ **Step numbers are named, not typed** — `INTAKE_WIZARD_STEPS` in `wizard/intake-wizard-state.ts`,
and the totals in the copy are the `{total}` parameter fed from `INTAKE_WIZARD_STEP_COUNT`. Both
were bare literals until this change, and removing one step meant hunting `step === 4` and `od 5`
through six files. Renumbering is now one edit.

⚠️ **`draft_step` still holds 5 on orders parked on the old signatures step, and the CHECK
constraint still allows 1..5.** Deliberate: narrowing it would need a migration that also rewrites
existing rows, for nothing but a tighter bound on a column the app no longer fills with a five.
Resuming clamps into range, and the read schema has no upper bound, so nothing breaks.

### 3.1 UI, shell and who does what

- **The design does not change.** Nikola: *"tako mora da izgleda ui"* — and, after V-2/V-3,
  sharply: build the UI from the prototype's own values, do not eyeball it, do not invent
  affordances it lacks and do not skip elements it has. Where the handoff prose and
  `prijem-prototip-v2` disagree, **the prototype wins** (its table is `min-width: 1080px`; the
  prose says 1060).
- **One approved deviation from the prototype, and only one so far:** the fuel needle **animates**
  (280 ms, `prefers-reduced-motion` honoured). Nikola asked for it 2026-07-27 — a dial that sweeps
  reads as an instrument, one that snaps reads as a number field. It is implemented by rotating the
  needle rather than moving its tip, because only a transform can transition, and a test proves the
  rotation lands the tip exactly where the handoff's `(125 + 78·cos θ, 132 − 78·sin θ)` does. The
  needle's colour stays white as drawn: the coloured arc already says where the reserve is.
  ⚠️ **The rotation must be the CSS property, never the SVG `transform` attribute.** Measured in
  both engines (Playwright, 2026-07-27): Chromium transitions the attribute, **WebKit does not** —
  its computed transform stays `none` for the whole 280 ms. The tablet is an iPad, so the attribute
  form would have swept on every desktop we test on and snapped on the only device that matters.
  Both forms render identically (checked at 0/45/90/135/180°), so this costs nothing but the
  `transform-box: view-box` + `transform-origin` pair that gives the CSS rotation the same pivot.
  **The same trap applies to every animated SVG in this module** — the damage map's markers next.
- **Zero new tokens.** Verified in code: `InternalPill` tones already carry the handoff's status
  colours — `Primljeno` = `--color-mri-info` `#2e90fa` (identical) · `U radu` = `--color-mri-warn`
  `#f5a623` · `Gotovo` = `--color-mri-ok` `#1fa971` (identical) · `Preuzeto` =
  `--color-mri-archived`. Damage-marker colours map to `--mri-red` / `--mri-warn` /
  `--mri-archived`.
- **The operator never fills an intake in.** Confirmed 2026-07-26: the office **oversees and
  corrects** — it does not stand in for the customer. Consequence: **there is no desktop wizard**,
  and the "who signs when the operator creates it" problem does not exist.
- **The wizard is the serviser's, tablet-first.** On a desktop it is only centred
  (`max-width ≈ 980px`); no second layout, because a second layout for the same flow diverges on
  the first change. The **list and the detail** are the operator's surface and must read well on a
  desktop. An operator who walks into the shop with a tablet gets the same tablet layout — that
  costs nothing extra.
- **A serviser has no sidebar at all.** His name + role chip and **"Odjavi se" move up into the
  topbar** for that case (today they live in the sidebar, so without this he would have no way to
  log out). Seeing his own name matters on a shared tablet: the order is bound to him
  (`technician_id`) and he signs the document.
- **The rule is driven by permissions, not by a role name:** the sidebar is not rendered when the
  user has nothing else to see. Give a serviser access to claims tomorrow from the admin app and
  the sidebar appears on its own, with no code change.
- **Done in V-2:** `navigation.ts` gated neither **Početna** nor **Statistika**, so a serviser
  would have seen both. Statistika now carries `STATISTICS_VIEW_PERMISSIONS` and Početna the
  claims-list set (the dashboard is claim-shaped). The ⌘K palette reads the same list, so it
  follows automatically.
- **The prototype's role switcher is a demo device and is not built.** It exists only so Nikola
  could compare the two perspectives.
- **"Kancelarija" is not a role and not a label.** It is `operator` with more permissions. The list
  subtitle Design drew ("Kancelarija — svi nalozi…") must not use the word as if it were a role.
- **Existing app shell** (`_shell`: topbar + collapsible sidebar) for operator/admin, sidebar
  collapsed to the icon rail on tablet. **No second shell** — the prototype's slim breadcrumb bar
  is not adopted.
- **Sidebar entry is "Servis"**, between "Mašinska obrada" and "Statistika", `Car` icon (lucide).
  **Routes stay `/prijem`, `/prijem/novi`, `/prijem/$id`** — "Servis" is the word Nikola and the
  workers use and it sits among job names; the URL describes what happens on the page and nobody
  reads it.
- **A serviser lands on `/prijem` after login** — the dashboard is claims-shaped and would be
  empty for them. The intake list's four KPI cards already are their dashboard.
- Serbian + English key parity (CI-enforced), as everywhere else. **No ICU plurals** — the
  Paraglide compiler in this repo rejects them (verified: the build fails, and there is not one
  plural message in the codebase, so `CLAUDE.md`'s "ICU plurals" rule is drift). Count strings
  are phrased so no grammatical form depends on the number ("Ukupno: 12", not "12 naloga").
- **A user whose only visible entry is Servis is redirected from `/` to `/prijem`**, in the home
  route's guard rather than the login form, so sign-in, a bookmark and the logo all obey one
  rule. Without it a serviser lands on the dashboard, whose loader calls
  `/api/dashboard/summary` — a permission he does not hold — and every login ends on a 403.

### 3.1a Approved deviations from the prototype (2026-07-27)

The prototype is the source of truth and every departure from it is Nikola's call, taken
knowingly. There are three, all in the wizard:

- **The fuel dial moves.** The prototype's needle jumps and its arc is three permanently lit
  segments (grey track, red E→¼, amber ¼→½) with a white number at every level. Ours sweeps, and
  the dial is now **one empty track plus one filled arc** that grows from E to the needle, coloured
  by band — **red 0–1/8, amber 2–3/8, green 4–8/8** — with the big digit taking the same colour and
  a 180 ms nudge as it changes. At E the fill is hidden outright (`opacity: 0`), because a
  zero-length round cap still paints a red dot on E that reads as a fault light. The painted
  reserve zone is deliberately gone: on an empty tank it left exactly that red shadow.
  ⚠ The design note that introduced this said the animation could be transferred from the
  prototype. It cannot — the prototype has **no** `requestAnimationFrame`, no
  `stroke-dasharray`/`-dashoffset` and not one CSS `transition` anywhere in the file. This is new
  work, not a transfer.
- **No animation frame loop.** The note specified a per-frame exponential (0.19 needle / 0.15
  arc). CSS transitions give the same feel, retarget from wherever the value currently is (which
  is the "five fast taps must stay one movement" requirement), cost no re-render, and honour
  `prefers-reduced-motion` through a media query. `stroke-dashoffset` was measured transitioning
  in **both Chromium and WebKit** before it was used — WebKit is the iPad, and it is the engine
  that refuses to transition the SVG `transform` **attribute**, so the needle rotates through the
  CSS property instead. Anything animated on this dial must keep to `transform` and
  `stroke-dashoffset`.
- **One note bar, not two.** The prototype has a single `mrNote` bar under the stepper strip whose
  four states are mutually exclusive by construction. Ours had grown two independent ones — a
  localStorage banner plus notes nested inside the stepper strip's trailing slot — so a serviser
  could be shown two `NASTAVI →` buttons for the same intake. They are merged into
  `IntakeWizardNote`: the strip carries only the label and the input, and the buffer offer is
  gated to step 1. The offer is also suppressed when the number resolves to the intake **already
  open on screen** — the server answers "taken by you" for your own draft.

Two colour tokens were added for this: `--mri-amb` and `--mri-grn`, transferred verbatim from the
prototype's `--amb`/`--grn` including their **per-theme** values. They exist as runtime variables,
not only as `@theme inline` entries like the other status hues — the dial reads them from `var()`,
and an undefined one silently drops `stroke` to `none`. That is exactly how the amber arc stayed
invisible from the day it was drawn until 2026-07-27: `var(--mri-warn)` never resolved, and
nothing anywhere reported an error.

### 3.2 Identity and lookup

- **Order number is typed by the serviser**, not generated — it comes from a printed pad. Field
  sits exactly where the number already appears (top-right of the stepper strip); no new field, no
  new card. Required for leaving step 1.
- **Format is free text** — pads vary, so only "non-empty" is validated. Normalized for the
  uniqueness check by trim + uppercase.
- **The check runs on the server** (debounced ~400 ms) against signed orders **and** other users'
  unfinished ones: `GET /api/intake-orders/check-number?number=…`. Three outcomes:

  | Taken by | Result |
  | --- | --- |
  | the serviser's own unfinished order | **resume** that intake where it stopped |
  | a signed order | red, `DALJE` locked, link to that order |
  | a colleague's unfinished order | amber, `DALJE` locked, **the colleague's name is shown** (internal app — naming them is how the collision actually gets resolved), no link to the order itself |

  This is stricter than the first pass, which only warned: a taken number now **blocks `DALJE`**,
  matching the unique index. A hard check on save stays as the second layer.
- **Owner and vehicle are plain columns on the order — no new tables.** Rejected: a `vehicles`
  registry (typo'd plates create ghost vehicles that someone has to merge by hand) and linking to
  `customers` (that table carries portal links and claim visibility; walk-in private individuals
  must not land in it).
- **Plate lookup:** the plate is stored as typed and normalized separately (uppercase, non-alnum
  stripped) for search. On a match, the server offers the owner/vehicle data from the most recent
  order for that plate; accepting it fills vehicle, vehicle type, VIN, owner, address, phone, and
  the banner turns green so it is not offered in a loop. Changing the plate resets the state.

### 3.3 Flow, drafts and the unfinished list

1. **The order row is created on the server after step 1** (number, plate, owner, phone known) and
   is **not part of the office's working list while `signed_at IS NULL`**. Reason: photos need a
   parent to attach to, and the tablet dying no longer costs the intake.
2. **The server is the source of truth for how far the intake got; `localStorage` is only a buffer
   for the current device.** Each step transition sends a small `PATCH` (text and JSON only, no
   photos). The local buffer holds what has not reached the server yet, and it is rewritten on
   `visibilitychange` so that a tablet iPadOS puts to sleep without warning does not lose it.
   ⚠ **The buffered VALUES are not flushed upwards on their own.** An earlier version of this line
   said they were; nothing ever sent them, so the sentence described an intention rather than the
   code (found by the buffer audit, 2026-08-04). What reaches the server is only what a step
   transition patches. **Photos are the exception and do work as described** — `useIntakePhotoQueue`
   resumes its uploads when the network returns. Whether the values should follow is open: it needs
   its own answers for what is sent, when, and what happens when it disagrees with the server.
   **This is forced by the drawn UI, not a preference:** Design drew "stao si na koraku 3 od 5" and
   a colleague-collision warning, and a `localStorage` draft on someone else's tablet can know
   neither. Hence the new **`draft_step`** column (§4.1).
3. **Several unfinished intakes per serviser are allowed.** A "only one" limit hits a person at the
   worst moment and its only escape is paper. The amber `NEDOVRŠEN PRIJEM` banner shows **the most
   recent** one (plus a count when there are more).
4. **Resuming on another tablet works** — the order hangs off the account, not the device. A dead
   battery mid-intake does not mean re-typing everything with the customer standing there.
5. **Unfinished intakes in the list:** a serviser **sees his own** in his table, clearly marked
   ("Nedovršen", no finish date), and a click returns him to the wizard. The **operator** does not
   get them in the normal view but reaches them through a **"Nedovršeni" filter** — the office's
   table is a work list of real intakes, but if drafts were invisible forever nobody could clean up
   after a serviser who left the firm.
6. **KPI cards count signed orders only.** A draft defaults to status `primljeno`, so without this
   rule "Primljeno: 7" would include half-entered intakes nobody handed over.
7. **`ODUSTANI` really deletes** the unfinished order. A signed order **cannot be removed at all**
   since H (2026-08-11, §3.0.1): it is the shop's half of a document the owner is holding, and if it
   may be destroyed then freezing its fields is weaker than deleting the whole thing. ⚠️ **Removed
   entirely (2026-08-11):** `intake_orders` never had a writer for soft delete, `restore` or an
   "Uklonjeni" view — Nikola approved dropping the unused `deleted_at` column outright rather than
   leaving dead code behind it. There is no removed-order view: a draft is hard-deleted, a signed
   order cannot be deleted at all, full stop.
8. **Status is one-way for the serviser** (single next-status button, as designed). Office/admin
   can set any status to fix a mis-tap. Every change lands in the Istorija tab with name and time.
9. **After signing:** services, materials and status remain editable — **confirmed by Nikola
   2026-07-27, "stalno otvorene"**, in any status including `gotovo` and `preuzeto`. The handoff's
   note ("while the order is U radu") is the outlier and is NOT the rule: during intake nobody knows
   yet which materials went in, and a car can be finished before someone remembers the filter they
   actually fitted. Closing the list would mean phoning the office over one line.
   **Everything else is frozen — see §3.0.1 for the rule and `FREE_AFTER_SIGNING` for the whole
   list.** The intake condition (checklist, fuel, damages, equipment note, photos), the vehicle, the
   owner and the signed phone can no longer be corrected by anybody, admin included; a wrong phone
   is answered by writing a SECOND number beside it (§5), never over it.
   ⚠️ **Superseded (H, 2026-08-11):** the office used to be able to correct the condition and the
   owner's phone, which stamped `amended_at`/`amended_by` and printed `⚠ MENJANO POSLE POTPISA`
   (V-6-2 decision ①, 2026-08-08). That whole mode is retired — the announcement of the divergence
   WAS the divergence — and this paragraph is kept only so the reversal does not read as an
   oversight in half a year.

### 3.4 Damage map

- **Four vehicle shapes:** auto, kombi, kamionet, džip. Silhouettes and the per-type zone map come
  **from the prototype (`SIL`, `zoneOf`) unchanged** — same `viewBox="0 0 340 556"`, top view,
  front at the bottom. Shape is chosen in step 1 with four buttons below "Način dolaska"; default
  `auto`. Trucks and buses are deliberately out of scope (their zones match none of the four).
- Zones differ per type and the words must be the ones a serviser would use — a kombi has no
  "gepek", a kamionet splits into kabina/sanduk. The zone is stored on the damage and printed.
- Coordinates are stored **in the drawing's space, never screen pixels**, so a marker sits in the
  same place on tablet, desktop and paper.
- **List order is the numbering ①②③** — that keeps map, defect list and print from ever
  disagreeing. Each damage additionally carries a hidden `id` so a photo can point at it stably.
- **Photos link to a specific damage:** a `◉ SLIKAJ` affordance on each damage row; the photo
  carries that damage's number and shows it on the thumbnail, in the detail, in the Fotografije tab
  and on the print. Several photos per damage allowed; the button shows the count once there are
  any. General whole-vehicle photos stay as they are.
- **Deleting a damage keeps its photos** — they only lose the number (`damageId → null`). Deleting
  a marker must not destroy evidence.
- **The photo reminder never blocks.** An amber footer hint ("2 od 3 oštećenja bez fotke"), the
  same mechanism steps 1 and 5 already use. Blocking would teach a serviser under pressure to
  **skip marking damages** so as not to get stuck — fewer recorded damages, not more.

### 3.5 Print — TWO DOCUMENTS, and the second one contains the first (Nikola, 2026-08-11)

There are **two** printed documents in a vehicle's life here, and the rule between them is Nikola's:

| | Contains | Signed by |
| --- | --- | --- |
| **1 — intake** (BUILT, V-7) | everything up to the moment of signing: basic data, the condition (checklist), fuel, the damage map with its defect list, remarks | receiving worker + owner |
| **2 — handover** (part **F**, NOT built) | **everything document 1 carries, PLUS everything that happened after it** — the specification of works, materials, the whole account of what the shop did to the vehicle | serviser + owner |

Nikola, verbatim: *„drugi dokument […] treba da sadrzi podatke iz prvog dokumenta kao i podatke nakon
toga, znaci celukupnost o vozilu […] sve mora da bude na tom dokumentu da vlasnik je upoznat sa svime i
potpisao da je saglasan i da uzima vozilo."* The reason is a dispute he expects: a car that fails after
pickup and an owner who says *„ja ne znam šta ste radili na njemu"* — the answer is the specification of
works on the paper he signed. Or an owner who says at pickup *„ja nemam to i to"* when he does, and
signed for it before taking the vehicle back.

⚠️ **Document 2 therefore CANNOT be capped at one page, and nothing on it may be truncated.** Document 1
already only just fits one A4 — V-7 measured that 12 defects in a single column push the footer with
both signatures onto a second sheet — and document 2 carries strictly more. **Nikola, 2026-08-11: one
page when it fits, and when the lists are longer it flows onto a second, a third, as long as it takes.**
No "…and N more — see order" line on this document: the whole purpose is that nothing is missing, so an
omission is the first thing a dissatisfied owner reaches for. Signatures go **last**, after everything,
because what is being signed is the totality.

⚠️ This reverses nothing about document 1: it stays exactly one page, with its existing caps and its
"…i još N" overflow line. The two documents have different jobs and therefore different rules.

---

#### Document 1 — as built (V-7, 2026-08-10)

**Browser print**, A4 portrait, `794×1123` @96dpi, **exactly one page**, from
`features/intake-orders/print/`. "Save as PDF" lives in the same print dialog on every device
including iPad, so PDF export is free.

**The server-side Chromium renderer is deliberately not used**: 1–3 s per render (a cold start is
likely, since the shared browser releases itself after 10 min idle) and memory is ~93 % of the
hosting bill. The evidence is the record — row, photos, both signatures — which can be re-printed
any time; no archived PDF is needed.

**The two questions this section used to leave open are answered** (Nikola, 2026-08-10, in
`docs/superpowers/specs/2026-08-10-intake-print-v7-design.md`):

1. **The intake IS printed, at the moment it is signed, and the paper goes to the owner.** The
   earlier note here — that the document is produced when the car is finished — described a
   different document, not this one.
2. **"Obaveze kupca" IS the house reference after all**, for how the paper LOOKS: it carries a
   black header band with the emblem and solid red section bands, and so does this. The point is
   that two papers from the same firm must look like it. That is a visual reference, not the
   blocker it was once mistaken for.

**Layout:** black band (emblem `public/internal/logo-emblem-white.png`, title, order number, date)
→ owner and vehicle → red band **ZATEČENO STANJE** (8 checklist rows in 4 columns, then fuel,
defect count, photo count, owner remarks) → red band **ŠEMA I NEDOSTACI** (silhouette of the
order's own vehicle type with the same numbered markers, defect rows, services and materials) →
red band **FOTODOKUMENTACIJA** → the legal sentence and both signatures, pinned to the bottom.

**Both languages, chosen in front of the paper.** The preview carries an `SR`/`EN` segment and the
sheet renders through Paraglide's per-call `{ locale }` — a foreign customer signs an English work
order while the office keeps working in Serbian, and the app's own language never moves. ⚠️ Damage
**zones stay in Serbian** on an English sheet: the zone is derived by the server at marking time
and stored as data, not as a translatable string.

**One page is a hard rule, and these are the cuts** (`intake-print-data.ts`, all covered by tests):
at most **6 photos** plus "Prikazano prvih 6 od N fotografija — sve se čuvaju uz digitalni nalog",
services and materials **capped at 5** each, defects **capped at 12** plus "…i još N — vidi
digitalni nalog", owner remarks clipped at **180 characters**.
⚠️ **The defect list flows in TWO columns past six rows.** Measured in the browser 2026-08-10: a
defect row is 30px, and twelve in one column push the sheet to 1247px against the fixed 1123 — the
footer with both signatures walks onto a second page. Two columns fit the same twelve. Cutting the
cap to the seven that fit was the alternative, and defects are the one thing on this paper that
must not be silently left off it.

⚠️ **The sheet no longer prints an amendment marker** (H, 2026-08-11): nothing can change a signed
order any more, so `⚠ NALOG JE MENJAN POSLE POTPISA` could only ever have printed a falsehood. It
was built in V-6-2 and removed with the rest of the amend mode (§3.0.1). Every printed order is now
a clean document by construction.

**Two things that are easy to break and were built on purpose:**
- The **print button waits for the thumbnails**. `window.print()` does not wait for images: fired
  early it prints six empty frames onto the page the customer is about to sign.
- `print-color-adjust: exact` on the sheet. Without it the printer drops the red bands and the
  markers, and the page loses the two things a reader navigates by.

### 3.6 Photo upload and finishing without a network

Photos are compressed **on the tablet** (~1920 px, JPEG ~0.8 → ~400 KB from a 6–10 MB phone photo,
~20× less over the hall's WiFi) and uploaded **in the background from step 3 while the serviser
works through steps 4 and 5**. The camera is the **native file input**
(`<input type="file" accept="image/*" capture="environment">`) — not `getUserMedia`, which would
demand HTTPS and make plain-`http` LAN testing impossible. Server side reuses the existing
`apps/api/src/modules/attachments/attachment-upload-pipeline.ts` (magic-byte check,
`optimizeAttachmentImage`, thumbnails, ETag caching, streaming) — nothing re-implemented.

Four states per thumbnail: **šalje se** (progress) · **poslato** · **čeka mrežu** (amber, resumes
by itself) · **nije uspelo** (tap = retry). The stepper strip carries a quiet chip on steps 4–5
with how many are still going.

**Finishing rules, which must not be got wrong:**

- Both signatures are required; without them the button does nothing.
- Photos still uploading **while the network is fine** → button becomes `⏳ Čeka se poslednja fotka`
  and waits. That is a matter of seconds.
- **No network, or failed photos → the button works.** The order is saved and the photos go later.
  **A serviser must never stand waiting for WiFi with the customer next to him.**
- An order saved with photos outstanding shows a visible indicator on the list and the detail
  (§4.1, `photos_expected`).
- **Photos that never arrive:** no retention job, no cleanup, no automatic deletion. The order
  carries the indicator, the office can see something is missing, and that is the whole mechanism.
  If it ever becomes a real problem it gets solved then.

### 3.6a What building step 3 actually turned up (2026-07-27)

Three things were already broken in what V-4a/V-4b had shipped, and none of them was visible,
because `IntakeDamageMap` had been written and then imported by nothing. They were fixed before
any screen went on top of them:

- **`var(--mri-warn)` / `var(--mri-archived)` do not exist.** `fill` is an inherited property, so
  an invalid `var()` does not fall back to black — it inherits the svg's own `fill="none"` and the
  marker simply is not drawn. The dent and rust markers would have been invisible with nothing in
  the console. Same family of trap as the fuel dial's amber arc; see CLAUDE.md §5.
- **The photo route was on the 2 MB default body limit**, not the 130 MB upload window. It would
  have passed testing — a compressed photo is ~400 KB — and failed only on the HEIC that
  `compressImage` hands back untouched when it cannot decode it, which is the iPad camera's normal
  output at 6–10 MB.
- **Nothing cleared `attachments.intake_damage_id` when a damage was removed**, so the row pointed
  at an id no longer in the jsonb array. Now done in the same transaction as the damage write.

Two decisions where the prototype, the printed worker instruction and the house rules disagreed,
both Nikola's, both **divergences from the instruction already in the workers' hands** and so
reported rather than quietly taken:

- **Tapping a healthy photo opens it; deleting is a button inside that view.** The prototype and
  the instruction delete on the first tap. One gloved finger on the wrong cell would destroy
  evidence of damage the customer has not yet signed for.
- **✕ on a defect row goes through `ConfirmDialog`.** Nothing is lost either way — the photos
  survive and only lose their number — but the two destructive controls now behave alike.

Implementation notes worth keeping:

- The upload queue lives in the **wizard**, not in step 3. The stepper chip on the last steps reads
  it, and a photo taken just before the signature has to keep uploading after the serviser moves on —
  the server accepts a late arrival as part of the intake, rather than refusing it, only while it
  comes from the order's own technician and only up to `photos_expected` (§3.0.1).
- **`crypto.randomUUID()` is unusable here** — it is gated to secure contexts and the tablet
  reaches the dev server over plain `http` on the LAN.
- **`◉ SLIKAJ` saves the markers first.** The server validates `damageId` against the markers it
  already holds, so a photo for a marker tapped a moment ago is refused.
- A rejected upload and an unreachable server are told apart by the XHR itself (`error` event vs a
  non-2xx status), not by `navigator.onLine` — hall WiFi answers DHCP and routes nowhere, and the
  browser calls that online.

### 3.7 Speed on the hall's WiFi

The office is on cable, the hall is on varying WiFi. What actually makes this fast, in order of
impact: **client-side photo compression** (the only genuinely heavy operation) · **the wizard
touches the network only for small step patches, the plate lookup and the number check** ·
**localStorage buffer** · route preloading, already in the stack · indexes on the searched columns ·
thumbnails rather than full images in grids (already exists).

**Redis is deliberately NOT used for this module.** Told to Nikola plainly and accepted. Redis
today serves exactly two services — statistics and dashboard summaries — both heavy aggregations
over all claims. An intake list is one indexed read over a small table (~3 ms) while a Redis
round-trip is ~1 ms, so caching buys nothing measurable and adds an invalidation surface on a table
servicers write to constantly. If a query is ever measured slow, cache it then, at that one place.

**Storage weight, for the record:** text is negligible (~1.5 KB per order → ~4 MB/year at 10
orders/day; the whole prod DB is 12.6 MB today). The real volume is photos in MinIO: ~3 MB per
order → **~8 GB/year**. That is a cost item, not a speed item; a retention policy is the answer if
it ever matters, not fewer photos.

### 3.8 Where it is built

**Locally, on `pnpm dev:all`** — no staging environment. `docs/01` and `docs/11` describe a
`staging` environment that **has never been created**; Railway holds one environment with four
services + Postgres. Staging exists on paper only, and if it is ever built it will be built for its
real reason (rehearsing restores and migrations), not as a playground for one module. A real tablet
reaches the dev server over the LAN (`http://192.168.x.x:3002`) — the native camera works over
plain `http`.

Because Nikola expects the model to change during the build: while it is still moving, the
migration stays **uncommitted**, the local DB is dropped and re-created from zero as often as
needed, and only once the UI has proved the model correct does it become **one clean migration**,
then the full gate, then a push.

---

## 4. Proposed data model

### 4.1 `intake_orders`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | `defaultRandom()` (repo reality is v4, see CLAUDE.md §8) |
| `order_number` | text NOT NULL | as typed, e.g. `RN-0249/26` |
| `order_number_key` | text NOT NULL | normalized; unique among non-deleted rows |
| `status` | text NOT NULL | CHECK `('primljeno','u_radu','gotovo','preuzeto')`, default `primljeno` |
| `received_at` | timestamptz NOT NULL | default `now()` — datum prijema |
| `technician_id` | uuid NOT NULL → `users.id` | the serviser; drives the own-only scope and the signature label |
| `vehicle_type` | text NOT NULL | CHECK `('auto','kombi','kamionet','dzip')`, default `auto` |
| `plate` | text NOT NULL | as typed |
| `plate_key` | text NOT NULL | normalized, indexed — the lookup key |
| `vehicle` | text NOT NULL | marka i model |
| `vin` | text | |
| `mileage` | integer | km |
| `arrival_mode` | text NOT NULL | CHECK `('dovezeno','doslepano','dovuceno')` |
| `owner_name` | text NOT NULL | person or firm |
| `owner_address` | text | |
| `owner_phone` | text NOT NULL | |
| `owner_remarks` | text | primedbe vlasnika |
| `fuel_level` | integer NOT NULL | CHECK `0..8` (eighths), default 4 |
| `checklist` | jsonb NOT NULL | 8 fixed keys → `true｜false｜null` (null = untouched) |
| `equipment_note` | text | napomena uz opremu |
| `damages` | jsonb NOT NULL | `[{ id, type, x, y, zone, note? }]`; **array order = the ①②③ numbering** |
| `services` | jsonb NOT NULL | `string[]` |
| `materials` | jsonb NOT NULL | `string[]` |
| **`draft_step`** | **integer** | **1–5, how far the wizard got; NULL once signed.** Without it the banner "stao si na koraku 3 od 5" and the colleague-collision warning cannot be told honestly |
| **`photos_expected`** | **integer** | **how many photos the tablet held at signing.** The indicator "not all photos arrived" is `count(attachments) < photos_expected`; the server cannot otherwise tell "3 photos, that's all" from "3 of 7 arrived" |
| `technician_signature` | text | SVG path, normalized to a 460×200 space |
| `owner_signature` | text | idem |
| `signed_at` | timestamptz | **NULL = draft: not in the office's working list, in the serviser's own** |
| `contact_phone` | text | the second number the shop may write down beside the signed one, on a SIGNED order only; never printed, internal only (§5). NULL = none written |
| ~~`amended_at`~~ / ~~`amended_by`~~ | timestamptz / uuid | ⚠️ **RETIRED (H, 2026-08-11).** Nothing writes or reads them any more; the columns themselves are dropped by H-4 with Nikola's explicit approval, so until then a `NOT NULL`-free pair of unused columns is what the table holds |
| `created_at` / `updated_at` | timestamptz | ~~`deleted_at`~~ **DROPPED (2026-08-11, migration `0040`):** the column never had a writer — an unfinished draft is hard-deleted and a signed order can never be deleted — so it always held 0 soft-deleted rows; Nikola approved removing it rather than leaving dead schema behind |

Checklist keys, exactly these eight in this order: `rezervna · dizalica · komplet · saobracajna ·
vozacka · prvaPomoc · prsluk · lanci`.

Damage types: `ogrebotina · udubljenje · puknuto · rdja`.

**Indexes:** unique, unconditional, on `order_number_key` (2026-08-11: no `deleted_at` predicate
left to carve out — a number is taken by any existing row, and hard-deleting a draft releases it)
· `plate_key` · `status` · partial on `received_at DESC` where `signed_at IS NOT NULL` (the office
list's read shape) · `technician_id` (the serviser's own list, drafts included).

**Search** (the list searches order number, plate, owner, vehicle): start with plain matching on
the indexed columns. Only add the FTS-index pattern used by claims if it is measured slow — the
table is small and expression indexes must stay textually identical to the repository, which is a
real maintenance cost.

### 4.2 `attachments` — extension (touches a shared table)

Photos reuse the existing polymorphic `attachments` table rather than getting their own, so the
whole upload/download pipeline comes for free. The migration must:

- add `intake_order_id uuid` nullable + FK → `intake_orders.id` `ON DELETE CASCADE`, partial index
- add `intake_damage_id text` nullable — points at a damage's `id` inside `damages`; CHECK that it
  is only ever set when `intake_order_id` is set. **Nullable on purpose**: deleting a damage sets it
  back to NULL and the photo survives as a general one
- **extend the `attachments_one_of_claim_check` constraint with a fourth branch**
  (`claim_kind IS NULL AND intake_order_id IS NOT NULL` and the other three parents NULL)

No new `purpose` value — `intake_order_id IS NOT NULL` already identifies an intake photo, so
extending that CHECK too would be redundant.

Signatures are **not** attachments: they are SVG path text on the order row.

---

## 5. Permissions and roles

| Permission | Serviser | Operator | Admin |
| --- | --- | --- | --- |
| `intake_orders.view` (all orders) | — | ✓ | bypass |
| `intake_orders.view_own` | ✓ | ✓ | bypass |
| `intake_orders.create` | ✓ | ✓ | bypass |
| `intake_orders.update` | ✓ | ✓ | bypass |
| `intake_orders.advance` (next status only) | ✓ | ✓ | bypass |
| `intake_orders.change_status` (any status — correction) | — | ✓ | bypass |
| `intake_orders.delete` | — | ✓ | bypass |

⚠️ **`intake_orders.amend` is GONE (H, 2026-08-11)** — removed from `PERMISSIONS` and from
`OPERATOR_PERMISSIONS` with the amend mode itself (§3.0.1). It was never seeded in production. In
the dev and test databases its `role_permissions` row is left as an orphan on purpose: the string
simply stops being checked.

- **One new role: `serviser`.** The office are the same people who already process claims, so
  `operator` simply gains the intake permissions. `viewer` is granted nothing here on purpose.
  There is **no "kancelarija" role** — that word only ever described the operator.
- **Badge colour: `mr-warning` (amber)**, approved by Nikola 2026-07-26. The other five hues
  were taken (admin `mr-brand`, operator `mr-info`, viewer `mr-neutral`, client `mr-accent`),
  and the reasoning is the one the brandbook already uses for admin-red beside rejected-red: a
  role badge only exists once the account is approved, so amber-role and the amber "pending"
  status badge can never share a row. `mr-success` was rejected — every approved serviser
  would have shown a green role beside a green status.
- **A serviser deliberately holds no `attachments.*` and no `notifications.view_own`** (see
  §6 for the photo route, and §7 for notifications).
- **Naming stays as above.** `dopuna-2` proposed `intake_orders.read.own` / `.correct` / `.archive`;
  rejected, because every permission in `@mr/shared` is two segments (`emotive_claims.view_own_customer`)
  and one module must not invent a third.
- A serviser sees **no** reklamacije, statistika or pristiglo — and no sidebar at all (§3.1).
- **Row-level scope:** a non-own order returns **404, not 403** (house rule — never leak
  existence). This is the most bug-prone area in the codebase and has leaked once before
  (`/api/dashboard/summary`), so it ships with its own regression tests.
- **Enforcement point for the freeze:** the service rejects **every** field outside
  `FREE_AFTER_SIGNING` on a signed order (`assertPostSigningPatchAllowed`), with no permission
  branch — a serviser holding `update` must not be able to route around it, and neither may an
  admin. `ValidationError` (422) for the freeze; `ForbiddenError` (403) stays for missing rights.
- **The added contact number (H, 2026-08-11).** A phone typed wrong at intake would otherwise stay
  wrong forever, and the walk-in owner is deliberately not written into `customers`, so the number
  lives only on this order. The signed `owner_phone` is **never overwritten**; the shop writes a
  second one beside it — `intake_orders.contact_phone`, **no new permission** (it joins
  `FREE_AFTER_SIGNING`), only on a signed order, never printed, internal only, and the Istorija line
  is `contact_added`. ⚠️ This is **not** `amend_contact_after_signing` renamed: that one recorded the
  signed number being overwritten, this one records a second number written beside it — which is
  why one left and the other arrived. The signed number must stay visible on screen and labelled as
  the signed one, or the added one quietly takes its place and the divergence is back.
- Deploy note: a new permission + role means **`pnpm --filter @mr/db run db:seed` once after
  deploy** (additive, prod-safe; admin gets it via the `ALL_PERMISSIONS` bypass already).

---

## 6. API surface

Module `apps/api/src/modules/intake-orders/` per the mandatory anatomy.

| Method + path | Purpose |
| --- | --- |
| `GET /api/intake-orders` | list — status filter, search, page; scoped by `view` vs `view_own`; drafts included for own, behind `?unfinished=true` for `view` |
| `GET /api/intake-orders/summary` | the four KPI cards; **signed orders only** |
| `GET /api/intake-orders/check-number` | `?number=…` → `free` / `taken_order` / `taken_draft_other` / `taken_draft_mine` (+ `orderId`, `draftStep`, `takenByName`) |
| `POST /api/intake-orders` | create after step 1 → 201 |
| `GET /api/intake-orders/:id` | detail — **includes the photo list**, one aggregate fetch per the claims rule |
| `PATCH /api/intake-orders/:id` | step patches (incl. `draft_step`); on a signed order only `FREE_AFTER_SIGNING` — everything else is 422 |
| `POST /api/intake-orders/:id/sign` | both signatures + finish → sets `signed_at`, clears `draft_step`, records `photos_expected` |
| `POST /api/intake-orders/:id/advance` | next status |
| `POST /api/intake-orders/:id/change-status` | set any status (correction) |
| `DELETE /api/intake-orders/:id` | discard an unfinished draft (hard, releases the number) → 204; a signed order is 422 |
| `GET /api/intake-orders/:id/photos/:attachmentId` | serve a photo (`?variant=thumbnail`); falls back to the full photo when none was generated |
| `POST /api/intake-orders/:id/photos` | upload one photo, optional `damageId` |
| `DELETE /api/intake-orders/:id/photos/:attachmentId` | remove a photo (see the two rules below) |
| `GET /api/intake-orders/lookup` | `?plate=…` → owner/vehicle prefill from previous **signed** orders |

**Two photo rules Nikola set on 2026-07-27:**

1. **A photo may arrive AFTER signing and is accepted**, because the tablet uploads in the
   background while the serviser works through the last steps — the picture was taken before the
   signature, and refusing it would lose the evidence the module exists for just because the hall's
   WiFi stalled. **Tightened by H (2026-08-11):** accepted only from the order's OWN serviser and
   only while `photosPending > 0`. The old gate asked who, never how many, so the same serviser
   could hang a photo of damage done in the shop onto a frozen record a week later.
2. **The serviser deletes photos freely while filling the intake in** — he may have taken a
   blurred one and step 3 is where he notices — **and not one minute after signing**. Chosen over
   "until the car goes into work": the customer signed for the condition those photos show. Since H
   that removal is refused to **everyone** (422), the office included. Deleting a draft's photo is a
   soft delete; the stored bytes stay, since a database-only restore must not point at files the
   bucket no longer holds.

**Photos are served by this module, never by `/api/attachments`.** That route is gated by
`attachments.view_internal`, and giving a serviser that permission would also let him read a
claim's files. The intake routes gate on `intake_orders.view`/`view_own` with the same
row-level scope as the order itself. Upload/delete land in V-4, alongside the tablet-side
compression and the four upload states they belong with; reading is in V-1 so the detail is
not half a screen.

Audit in the **service** layer (every state change: actor, IP, UA, diff), as everywhere.
`queryOptions` factories in `@mr/shared/src/queries`.

**Realtime reuses `resource_changed`** with a new `intakeOrders` key rather than a new event
type: the requirement is identical, the payload stays signal-only, and the key flows through
the existing Zod-validated LISTEN/NOTIFY transport and the frontend's invalidation map with
no new transport code.

**The post-signing freeze is enforced in the service, not on the route.** A serviser holds
`update`, so a route gate alone would let him patch a signed order — and there is no second gate
left to catch him, since the freeze has no permission of its own. `assertPostSigningPatchAllowed`
refuses every field outside `FREE_AFTER_SIGNING` (`services`, `materials`, `contactPhone`) with a
`ValidationError`, naming the fields the caller actually sent.

The refusal is decided on the field's **NAME**, never on its value — otherwise "send it again with
the same value" would be a way past the freeze. It is asserted on the RAW patch, before the server
derives damage zones, because a `vehicleType` patch pulls `damages` in and the message must name
what was sent. The Istorija line is `spec_updated`, or `contact_added` when the patch carries the
added number.

---

## 7. Scope

**In v1:** the core module + **live list refresh (SSE)** so the office sees a car marked "Gotovo"
without pressing refresh.

**Approved but deferred to their own phases after the core ships** — Nikola chose core-first so the
specs can be written knowing how the module is actually used:

1. **In-app notifications** for intake events (needs its own decisions: who receives, snooze,
   never notify the actor).
2. **Intake statistics** (vehicles per month, average Primljeno→Preuzeto time). The existing
   statistics module is built around claim outcomes and amounts; intake has neither.
3. **Excel export** of orders (needs columns and a consumer).

Not cancelled — just not now.

**Ordering against other pending design work:** the **glass ⌘K palette + Notification Center**
handoff (`Downloads/handoff 3/2026-07-21-glass-final-handoff.md`) comes **after** this module.
They do not collide — glass is confined to overlay layers and explicitly must not touch cards,
forms or tables — so the order is purely priority: intake replaces paper, glass is the same thing
prettier. Keeping them apart also avoids two hands in `globals.css` in the same week.

---

## 8. Phases

| Phase | Content | Gate |
| --- | --- | --- |
| **V-0** ✅ | Migration: `intake_orders` + indexes + the `attachments` extension (new columns, FK, **CHECK constraint change on a shared table**) | **DONE** 2026-07-26 — migration `0036_youthful_lightspeed`, `drizzle-kit` generated, clean migrate-from-zero proven (37 migrations on an empty DB). Safe on live data: the three pre-existing CHECK branches only gained `AND intake_order_id IS NULL`, true for every row the moment the nullable column is added, so for old rows the constraint is identical to the one production already enforces — and drizzle applies every statement in one transaction, so a failure can never leave `attachments` unguarded |
| **V-1** ✅ | `@mr/shared` (Zod, constants, permissions, query factories) · api module · new role + seed · the role's admin-web surface | **DONE** 2026-07-26, gate green (595/595 integration) |
| **V-2** ✅ | List screen (KPI cards — signed only, filter + search in URL params, table incl. own drafts, "Nedovršeni" filter for the office) · sidebar "Servis" + the no-sidebar rule + gating Početna/Statistika | **DONE** 2026-07-26, gate green. The wizard and detail got placeholder routes so rows stay clickable |
| **V-3** ✅ | Wizard steps 1–2 (number field with the server check, vehicle type, plate lookup, resume banner; checklist + fuel gauge) | **DONE** 2026-07-27, gate green. Verified in the browser at 1180×820: create → patch → resume → back all persist. Creating an order must be followed by a step patch — create stamps `draft_step = 1`, so without it the resume offer sends the serviser a step backwards. **Reworked the same day** (§3.1a): the dial animates and recolours, the two resume affordances became one bar, step 2 moved onto `IntakePanel` (it had been using the list/detail card, whose header added 55.5 px and left the two cards ending at different heights), the gauge card went 340 → **330 px**, the order-number input 48 → **40 px**, the checklist labels went back to the prototype's full names, and `::placeholder` moved off `currentColor` — at 0.38 of the control's near-black it was invisible in the light theme, which reads as "the field has no hint" |
| **V-4a** ✅ | `zoneOf` + the four silhouettes, transferred not redrawn; the server derives the zone and re-zones markers when the vehicle type changes | **DONE** 2026-07-27 |
| **V-4b** ✅ | Photo endpoints (upload / serve / delete) under the intake permissions — never `/api/attachments`, since a serviser must not hold `attachments.view_internal` | **DONE** 2026-07-27 |
| **V-4c** ✅ | Step 3 in the UI: tap-to-mark damage map, defect list, photo grid with tablet-side compression and the four upload states | **DONE** 2026-07-27, gate green, driven end to end in a browser. Built in three passes — **V-4c-0** fixed three bugs already shipped in V-4a/V-4b before putting a screen on top of them (see §3.6a), **V-4c-1** the map and the defect list, **V-4c-2** the photos. Not verified because it needs the real device: a network drop mid-upload (`wait` → `online` → resume) and a HEIC straight off an iPad |
| **V-5** ✅ | Step 4 + signature pad (step 5) + save/sign incl. the offline finish rules | **DONE** 2026-07-27, gate green, driven end to end in a browser (create → damage + photo → services and materials → both signatures → finish). Three decisions taken with Nikola that session: the confirmation sentence prints its counts on their own line (`Nedostataka: 1 · Fotografija: 2`) because Serbian declines them and this repo cannot use ICU plurals; the step-4 note drops the prototype's „dok je nalog U radu" clause, which described a restriction the server deliberately does not enforce; and the two spec lists get no empty state, as the prototype has none and the input's own placeholder already instructs. ⚠ The signature pad has NO prototype reference — its pads are empty divs and it cannot sign — so the capture is ours: pointer strokes normalized into the 460×200 space of §4.1, serialized to one `M…L…` run per stroke. `photos_expected` is sent as arrived + outstanding INCLUDING failures; counting only what is still in flight would silence the indicator for exactly the photos most likely lost |
| **V-6** ✅ | Detail with 4 tabs, status correction — its amend affordances and soft delete are RETIRED by H (§3.0.1) | **DONE** 2026-07-29, spec `specs/2026-07-29-intake-detail-v6-design.md` |
| **V-7** ✅ | Print (A4, one page, per-type drawing, 6-photo cap; the amended marker is RETIRED by H) | **DONE** 2026-08-10, spec `specs/2026-08-10-intake-print-v7-design.md`. The blocker in the old note ("needs Obaveze kupaca first") was resolved in §3.5 — Nikola described the document he meant, and it is TWO sheets, the second containing the first |

### After V-7 — the lettered parts

The phases above were the build order the module was specified with. What followed came in
conversation and was tracked by letter, so the letters are recorded here rather than left in chat.
Each has its own spec under `docs/superpowers/specs/`; those specs, not this table, are the detail.

| Part | What | Status |
| --- | --- | --- |
| Admin catalogs (G) | The intake lists (checklist, damage types, arrival modes) move out of code into admin-managed catalogs | ✅ 2026-08-11 |
| Freeze after signing (H) | Signatures close the record; only `services`, `materials`, `contactPhone` stay open. The amend mode (V-6-2) is RETIRED — do not reintroduce it | ✅ 2026-08-11 |
| Extra items (C) | The two `+` affordances: rows the serviser writes in himself, on the checklist and on the damage list | ✅ 2026-08-12 |
| Owner identity | Person vs. company, and the document number that goes with each | ✅ 2026-08-12 |
| Condition is required | An order cannot be signed until something is recorded about the vehicle's state | ✅ 2026-08-12 |
| Document to the owner | The signed sheet becomes ONE sealed bilingual PDF, stored with its SHA-256 and emailed to the owner | ✅ 2026-08-14 |
| Handover (F) | The vehicle goes back only through Primopredaja: a second freeze, a second document, and "released without signatures" as a recorded outcome rather than a hidden one | ✅ 2026-08-14 |
| **Roles (D)** | Overlapping roles — intake vs. claims — composed from the admin panel | **DEFERRED by Nikola**, see `docs/03-permissions.md` §OPEN |
| **Quote on the order (E)** | The serviser attaches a quote produced in another program; it is a file, never line items — prices stay out of this module (Nikola, 2026-08-17) | **NOT BUILT** — two questions still open: who sees it, and whether it precedes or follows the work |

Then, separately: notifications → statistics → Excel.

Per phase: `pnpm --filter internal-web build` + typecheck; full CI gate before any commit; commit
only when asked; Nikola pushes.

---

## 9. Open items

1. **What gets printed, and when** — see the warning in §3.5. Nikola: the document is generated
   when the car is finished, and "Obaveze kupaca" is something else entirely. V-7 cannot be
   specified until he describes the document he means. This replaces the earlier item, which asked
   him for a template on a premise that turned out to be wrong.
2. **The printed manual for serviseri** (`Uputstvo Prijem Vozila`) goes to the workers, so it must
   match the application. **Every place where the built app behaves differently from the manual gets
   reported to Nikola** rather than quietly diverging.
3. Placement of the vehicle-type buttons (step 1, below "Način dolaska") and of the order-number
   field (in the stepper strip, unchanged look) are **Nikola's decisions**, not suggestions — but
   Claude Design may report back if they break the composition, and then Nikola decides what gives.
4. **An engine arriving without a car (raised by Nikola, 2026-08-12) — DEFERRED, direction recorded.**
   He asked for it to be kept in mind, not designed: _„daj da završimo za auto pa ćemo posle o
   motoru… suština je da ga vežemo za reklamacije, što nije loše jer kada dodamo reklamacije za
   mašinsku obradu onda ćemo sve da imamo, sve će biti povezano u jedno."_ So the direction is
   **tie it to the claim families, not to this module's vehicle shape**, and let machining claims
   (`docs/16`) join the same structure. Nothing is designed yet, and this note deliberately adds no
   decisions of its own. What makes it non-trivial when it is picked up: this table requires
   `plate`, `vehicle` and `arrival_mode` NOT NULL, `fuel_level` and the damage map assume a car
   silhouette, and the checklist catalog is car equipment — so an engine cannot simply be a fifth
   `vehicle_type`. One thing already helps it: part C's second list, defects with no place on the
   drawing, is exactly the shape an engine needs.
