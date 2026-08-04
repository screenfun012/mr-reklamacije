# The tablet's intake draft buffer — one rule, in one place

Status: **approved by Nikola, 2026-08-04**, after a 18-agent adversarial audit that confirmed the
bug, corrected the first version of the fix, and found one new hole the first version opened.
Branch `feat/vehicle-intake`, last commit `2b7fe7c`. Not part of `docs/25`'s V-phases — a
pre-existing defect in shipped V-3 code, fixed on its own before Tasks 6-13 resume.

---

## 1. Why

A serviser can silently lose a started intake.

`apps/internal-web/src/features/intake-orders/wizard/intake-wizard.tsx` declares two mount effects
in this order:

- **Effect A** (`:90-95`) reads the tablet buffer and, if it carries an order number, lifts it into
  React state so the wizard can offer *"Nedovršen prijem RN-…, stao si na koraku N od 5"*.
- **Effect B** (`:100-110`) writes `{orderId, step, values}` to the same key. It has no guard, and
  on mount `values` is `emptyIntakeWizardValues()` (`:73`), `step` is 1 and `orderId` is `null`.

React flushes passive effects in hook-declaration order within one commit, so B overwrites the real
buffer with an empty one immediately after A read it. The offer the serviser sees lives only in
React state (`foundDraft`); `resumeBuffer` (`:160-168`) restores from that state, not from storage.
So the offer works for exactly as long as the component lives — and not one moment longer. On the
next mount `readIntakeDraft` returns the empty record, A's guard rejects it, and the intake is never
offered again.

**The scenario is the one the buffer exists for.** iPadOS discards background tabs, so a tablet that
sleeps and wakes remounts the page. The serviser is offered his draft, does not tap immediately
(he is talking to the customer), the tablet sleeps again — and the second wake reads an empty
buffer.

**What is actually lost.** The server row is created only on leaving step 1 (`:191-204`, the sole
`createIntakeOrder` call in the app), so with `orderId === null` the buffer is the only copy of the
whole step-1 form and its loss is total. Past that the server holds everything up to the last patch,
and a serviser can recover by retyping the number — the server answers `TakenDraftMine` and the note
offers *Nastavi* (`intake-wizard-note.tsx:90-108`). That route requires him to retype the exact
number, and it is the only other route: `/prijem/$id` is still a placeholder and the list row has no
resume action.

So: unrecoverable loss is bounded to step-1 typing; past step 1 the cost is retyping a number and
losing the delta since the last patch.

---

## 2. Scope

**In scope.** Close the hole so the writer can no longer destroy a draft the reader would offer.

**Out of scope, decided by Nikola 2026-08-04.** Creating the server row earlier (when a valid free
number is typed), several keyed buffers, and offering resume from the list screen. §7 records them.
Anything the audit found that this fix does not touch is recorded in §7 rather than fixed here.

---

## 3. Design

### 3.1 The rule moves into the buffer module, and it has two halves

The defect is not a missing check. It is that **the reader and the writer decide separately what a
buffer is**, and the writer does not decide at all. A third check in a third place would leave three
places to disagree. The rule moves down into `intake-wizard-state.ts`, beside the storage it
governs, and both functions call it.

The audit forced it into two named halves rather than one, because keeping and offering are not the
same question:

```ts
/**
 * The offer names the intake by its order number, so without one there is nothing to say —
 * and a buffer older than a shift is not an offer, it is a trap (§3.3).
 */
function isOfferable(draft: IntakeDraftBuffer): boolean

/** Worth keeping while the server backs it, even mid-edit with the number blank. */
function isWorthKeeping(draft: Omit<IntakeDraftBuffer, 'savedAt'>): boolean
```

- `writeIntakeDraft` returns early unless `isWorthKeeping` — `draft.orderId !== null` **or** the
  order number is non-empty.
- `readIntakeDraft` returns `null` unless `isOfferable` — a non-empty order number **and** a
  `savedAt` within `INTAKE_DRAFT_MAX_AGE_MS` (§3.3). One predicate, both clauses, so the reader has
  a single question to ask.
- `intake-wizard.tsx:92` loses its inline guard and becomes `if (draft !== null)`.

**Why the writer is wider than the reader.** The order-number input renders in the stepper strip on
every step (`intake-wizard.tsx:360-366` → `intake-stepper-strip.tsx:73`) and is never disabled,
while `forwardDisabled` (`:231`) only validates it on step 1. So blanking the number on step 3 is
reachable. Under a single number-only rule the writer would stop and the buffer would **freeze** at
the pre-clear snapshot while `saveDamages` (`:136-141`) kept writing to the server. Resuming that
frozen buffer and pressing DALJE sends a stale `damages` array, which
`intake-orders.repository.ts:466` writes wholesale and `:491-505` uses to null `intake_damage_id` on
photos of markers added after the clear. Backspacing character by character is worse: the buffer
freezes on a truncated prefix, and resuming renames the server order on the next DALJE
(`repository:446-448` rewrites `orderNumber` and `orderNumberKey`), with the note unable to warn
because it suppresses the server branch when `data.orderId === currentOrderId`
(`intake-wizard-note.tsx:90-94`).

Widening the **reader** instead was considered and rejected: the offer text renders
`foundDraft.values.orderNumber` (`intake-wizard-note.tsx:147-150`), so an offer with a blank number
has nothing to name.

### 3.2 `isOfferable` must be called inside `readIntakeDraft`'s existing try

`readIntakeDraft` narrows only `typeof parsed === 'object' && parsed !== null && 'values' in parsed`
(`:191`) and then casts (`:194`). A stored `{"values":null}`, `{"values":{}}` or even `[]`
(`'values' in []` is true via `Array.prototype.values`) survives that check, so
`draft.values.orderNumber.trim()` throws on it.

Today that expression runs at `intake-wizard.tsx:92`, in a passive effect **outside any try**, and
the throw takes the whole `/prijem/novi` route to the router's error component — with the customer
standing at the car. Inside `readIntakeDraft`'s try (`:185-198`) the same throw lands in the catch at
`:195`, whose comment already promises *"A corrupt buffer must never block a new intake"*. Today
that comment is not true. After this change it is.

**So this fix removes an existing crash path rather than adding one.** The placement is not
optional: `parsed` is a `const` block-scoped to the try, so the natural drop-in (replacing the
`return parsed as IntakeDraftBuffer` at `:194`) is already inside it. §5 pins it with a test that
reds only if someone restructures the function to move it out.

### 3.3 The buffer gets a `savedAt` and expires after 12 hours

Today's unguarded mount write is wrong, but it is also **the only thing that ever clears a stale
buffer without an explicit tap**. After §3.1 the key is cleared only by `discardBuffer` (`:170-173`),
`discard` (`:222`) and `finish` (`:267`) — so a buffer that outlives its order survives until
someone types the next order number or taps *Odbaci*.

The worst concrete case the audit found: `finish` calls `clearIntakeDraft()` inside its try
(`:259-268`), so a WiFi drop that loses the *response* to a successful sign leaves a buffer pointing
at an order that is now signed. Post-§3.1 the serviser is offered *"nastavi RN-…, korak 5"*;
accepting it sends a post-signing patch, `assertPostSigningPatchAllowed` throws, and he gets the
generic `intake_save_failed` toast with *Odbaci* as the only exit. Today, retyping the number
instead gives him the clean red *"broj već pripada potpisanom nalogu"* note with an
*Otvori nalog →* link.

Removing an accidental cleanup obliges us to put back a deliberate one. `IntakeDraftBuffer` gains
`savedAt: number` (epoch ms), stamped by `writeIntakeDraft` itself so no caller can forget it, and
`readIntakeDraft` refuses anything older than `INTAKE_DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000`.

Twelve hours, chosen by Nikola: it covers a shift and the night between it and the next one. A
serviser picking the tablet up in the morning is not offered yesterday's intake, and — on a shared
tablet — not a colleague's from last night either.

`writeIntakeDraft` takes `Omit<IntakeDraftBuffer, 'savedAt'>` so the two existing call sites
(`:102`, `:104`) stay exactly as they are. A stored buffer with a missing or non-numeric `savedAt`
is treated as expired, not as fresh: the branch has never deployed, so no production tablet holds
one, and refusing an unknown-age buffer is the same answer the module already gives to a shape it
cannot read.

⚠ **The freshness check must assert the type before it does arithmetic.** Written the obvious way —
`Date.now() - draft.savedAt <= INTAKE_DRAFT_MAX_AGE_MS` — a `savedAt` that is `undefined` or a
string yields `NaN`, every comparison against `NaN` is `false`, and the draft is therefore treated
as **fresh**: the exact opposite of the paragraph above, silently. The check must start from
`typeof draft.savedAt === 'number'`. T6b in §5 pins it.

### 3.4 What this does not claim

The reader and the writer now agree on the predicate. They do **not** agree on lifetime, and the
spec should not pretend otherwise: the `visibilitychange` listener (`:103-108`) closes over a draft
snapshot and its cleanup runs only on unmount or a `[orderId, step, values]` change, so during the
`await navigate` that follows `finish` (`:267-269`) and `discard` (`:222-223`) a visibility change
can rewrite the key that was just cleared. Pre-existing, unchanged by this fix, recorded in §7.

---

## 4. Blast radius (measured, not assumed)

A repo-wide grep for `readIntakeDraft`, `writeIntakeDraft`, `clearIntakeDraft`,
`INTAKE_DRAFT_STORAGE_KEY`, `IntakeDraftBuffer` and the literal `mrr:internal:intake-draft` returns:

- definitions in `intake-wizard-state.ts:181,201,212`
- uses in `intake-wizard.tsx:27,29,34,91,102,104,171,222,267`
- a **type-only** import in `intake-wizard-note.tsx:8,40`

No barrel, no package export, no other app, no test. `IntakeWizard` is mounted from exactly one
route (`routes/_shell/prijem/novi.tsx:12`).

The writer guard can never drop a server-backed intake: `orderId` is only set after
`createIntakeOrder` in `goForward` (`:196-198`), gated by `step1Complete`, which requires a non-empty
number (`intake-wizard-state.ts:64-72`); the wire schema pins `min(1)` on create and update
(`packages/shared/src/schemas/intake-order.wire.schema.ts:19,27,51`) and the column is `notNull`
(`packages/db/src/schema/intake-orders.ts:45`), so `valuesFromOrder` cannot produce an empty number
either.

The proposed code passes the repo's actual gate: `tooling/eslint/index.js` is
`js.recommended + tseslint.recommended + prettier` with no `explicit-module-boundary-types` and no
`max-lines-per-function`; the helpers are non-exported, have explicit return types, no `any` and no
non-null assertion.

---

## 5. Tests

The buffer has **zero coverage today** and no test in the repo renders `<IntakeWizard />`. There is
no canary in either direction — nothing in the gate would notice this fix being reverted. Every test
below names the specific way of breaking the fix that reds it, so none of them can pass vacuously.

Appended to `apps/internal-web/src/features/intake-orders/wizard/__tests__/intake-wizard-state.test.ts`:

| # | Test | Reds when you break |
|---|------|---------------------|
| T1 | a buffer with no order number is not offered back | delete the number clause of `isOfferable` |
| T2 | **the regression test** — writing the empty draft Effect B builds does not replace a real one | delete the `isWorthKeeping` guard in `writeIntakeDraft` (**red on today's code**) |
| T3 | writing continues while the intake is still worth keeping (step 1 → step 3) | over-apply the guard: an unconditional return, or write-once |
| T4 | a shape it cannot read is treated as no draft, and does not throw (`{"values":null}`, `{"values":{}}`) | move `isOfferable` outside the try — TypeError |
| T5 | the number cleared after the server row exists keeps buffering (pins §3.1's two halves) | delete the `orderId !== null` half of `isWorthKeeping` |
| T6a | a buffer older than 12 h is not offered; one at 11 h 59 m is | delete the freshness clause of `isOfferable` |
| T6b | a buffer whose `savedAt` is missing or a string is not offered | drop the `typeof === 'number'` assertion — the `NaN` trap in §3.3 |

New file `__tests__/intake-wizard-draft-offer.test.tsx`:

| # | Test | Reds when you delete |
|---|------|----------------------|
| T7 | an offer the serviser neither took nor waved away is still there after a reload — seed, render, assert the note, `unmount()`, render again, assert the note | the write guard (**red on today's code, at the second assertion**) |

T2 and T7 both red on today's code, so neither fails uniquely; that is stated here rather than
discovered in review. T7 is the only test that would notice a future edit bypassing the module and
writing `localStorage` directly from the component — which is the class of bug being fixed.

**Four traps the audit found, all of which silently produce a passing-but-worthless test:**

1. **StrictMode is on in dev** (TanStack Start's default client entry wraps `<StartClient />`).
   Its double-invoke does **not** reproduce this bug — the second read fails A's guard, but the else
   branch is a no-op so `foundDraft` keeps what the first run set. T7 must do a real
   `unmount()` + re-render.
2. **`vitest.setup.ts` does not clear `localStorage`** (it registers only `cleanup()`), and jsdom
   shares it across a file. Every test above needs `window.localStorage.clear()` in `beforeEach`.
   Template: `features/claims/__tests__/remembered-page-size.test.ts:11-13`.
3. **internal-web's typecheck cannot see test files** — `tsconfig.json:10-15` excludes
   `src/**/__tests__/**`, and both `typecheck` and `build` use that config. A hand-written
   `IntakeWizardValues` literal will rot silently, exactly as `emptyQueue()` in
   `step-damage-photos.test.tsx:11-20` already does (annotated `IntakePhotoQueue`, missing three
   required fields). Build fixtures as `{ ...emptyIntakeWizardValues(), orderNumber: '…' }`, the
   pattern `filledValues()` already uses at `intake-wizard-state.test.ts:14-24`.
4. **T6a must mock time** (`vi.setSystemTime`), per CLAUDE.md §6 rule 03. The window is computed in
   JS, not in Postgres, so the clamp-the-fixtures exception does not apply here.

T7's harness is smaller than it looks: all three queries in the mount path are disabled at empty
state (number check `enabled: trimmed.length > 0`, plate lookup `>= 2`, order detail
`orderId !== null`), so it needs no fetch mock and no `RouterProvider` — a `QueryClientProvider` with
`retry: false`, `setLocale('sr', { reload: false })`, and two `vi.mock`s: `~/lib/use-internal-auth-user`
(mock the hook, not `~/lib/auth-client` — the hook imports the client without the `.js` extension the
existing mocks use) and `@tanstack/react-router` spread-with-`importOriginal` for `useNavigate`,
the pattern at `domace-claim-detail-orchestrated-edit.test.tsx:48-60`.

---

## 6. Files

| File | Change |
|------|--------|
| `…/wizard/intake-wizard-state.ts` | `isOfferable`, `isWorthKeeping`, `INTAKE_DRAFT_MAX_AGE_MS`, `savedAt` on `IntakeDraftBuffer`, guards in `readIntakeDraft` (inside the try) and `writeIntakeDraft` |
| `…/wizard/intake-wizard.tsx` | `:92` loses its inline guard |
| `…/wizard/__tests__/intake-wizard-state.test.ts` | T1–T6 |
| `…/wizard/__tests__/intake-wizard-draft-offer.test.tsx` | new, T7 |

No migration, no API change, no new permission, no i18n key, no dependency.

---

## 7. Recorded, deliberately not fixed here

For the review pass Nikola plans once the intake module is finished.

1. **`docs/25` §3.3.2 promises something the code does not do.** It says the local buffer "is
   flushed upwards when the network returns or the tablet wakes (`visibilitychange`)". The
   `visibilitychange` handler (`:103-105`) only rewrites `localStorage`; nothing is sent to the
   server. Either the doc or the code is wrong, and it is Nikola's call which.
2. **`resumeBuffer` trusts `localStorage`'s `orderId` blindly** (`:160-168`) while `resumeServerOrder`
   always refetches (`:175-189`). A resumed buffer can name a hard-deleted draft or a signed order;
   all failures surface as the same `intake_save_failed` toast. **Plan Task 12 Step 5** is where the
   ownership/`signedAt` guards belong. This fix extends how long such a buffer survives; it does not
   create it.
3. **`ODUSTANI` cannot clear a buffer whose order is already gone** — `discard` (`:215-228`) awaits
   the delete inside the try, so a 404 throws before `clearIntakeDraft()` at `:222`. One-line
   question, separate.
4. **A failed `finish` leaves a buffer pointing at a signed order** (`clearIntakeDraft` is inside the
   try, `:259-268`). §3.3's expiry bounds it to 12 h; moving the clear into a `finally` would close
   it properly.
5. **The buffer is tablet-scoped, not user-scoped.** It carries no user id
   (`intake-wizard-state.ts:175-179`) and sign-out does not clear `localStorage`
   (`internal-shell.tsx:59-68`), so a colleague's draft can be offered to whoever mounts the wizard
   next. Pre-existing and already named in the V-6 spec (`2026-07-29-…-design.md:309-316`); §3.3
   bounds it to 12 h rather than closing it.
6. **Plan Task 12's buffer test becomes vacuous under this fix.** `docs/superpowers/plans/2026-07-29-intake-detail-v6.md:1434-1439`
   asserts `readIntakeDraft()?.orderId` is unchanged after a mount, to prove a `resuming` guard on
   Effect B. With the writer guarded, the mount write is a no-op regardless, so the assertion holds
   even if that guard is never implemented. **Re-point it when Task 12 runs.**
7. **One tablet holds one buffer**, while `docs/25` §3.3.3 allows several unfinished intakes per
   serviser. Not a contradiction — the server holds the many, the tablet holds the last mile — but it
   reads like one until said out loud. Starting a different intake replaces the buffered one; that is
   existing behaviour, not introduced here.
8. **A V-3-era buffer whose `values` predate `damages`/`services`/`materials`** passes `isOfferable`
   and fails later at `toUpdateInput` as a 422. §3.3's expiry makes it unreachable in practice.
9. **The bigger idea, raised and deferred 2026-08-04:** create the server row as soon as a valid free
   number is typed, rather than on leaving step 1. The buffer would stop being anyone's only copy and
   "nedovršeni" would catch everything. Rejected *for now* because it changes the number-check state
   machine — the most intricate part of step 1, already shipped and reviewed — and doing that inside
   a bug fix is how a hundred things go wrong at once. Worth deciding deliberately, with time.
