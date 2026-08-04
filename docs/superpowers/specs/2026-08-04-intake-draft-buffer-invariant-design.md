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

Nikola widened this on 2026-08-04, after reading the first draft: *"uradi sve što treba i ovo što je
van domena uradi slobodno, samo uradi sve kako treba"*. So the audit's neighbouring findings are in,
where doing them now is genuinely better than deferring them.

**In scope.**

1. Close the hole so the writer can no longer destroy a draft the reader would offer (§3.1–§3.3).
2. Release the buffer properly when the wizard is done with it, so a sleeping tablet cannot write it
   back after it was cleared (§3.4).
3. Make ODUSTANI work when the server row is already gone, and stop it firing twice (§3.5).
4. Give the buffer an owner, so a shared tablet stops handing one serviser another's customer, and
   evict a draft once it is dead rather than leaving that customer's phone number lying there (§3.6).

**Out of scope, with reasons.** Four of the audit's findings are *worse* if taken now than if taken
deliberately later; §7 items 1–4 carry the argument. They are not deferred for effort — each would
either break a promise `docs/25` makes about working without WiFi, remove a safety net to fix a case
that already self-heals, or settle a question that Task 12 has to settle anyway and must not settle
twice differently.

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
/** Worth keeping while the server backs it, even mid-edit with the number blank. */
function isWorthKeeping(draft: Omit<IntakeDraftBuffer, 'savedAt'>): boolean

/** Within one shift of now, in either direction, from a stamp that is really a number (§3.3). */
function isFresh(draft: IntakeDraftBuffer): boolean

/** His, nameable, and fresh — the three things an offer needs to be true (§3.3, §3.6). */
function isOfferable(draft: IntakeDraftBuffer, reader: string): boolean
```

- `writeIntakeDraft` returns early unless `isWorthKeeping` — `draft.orderId !== null` **or** the
  order number is non-empty.
- `readIntakeDraft(reader)` returns `null` unless `isOfferable`, and **evicts** what is no longer
  fresh (§3.6).
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

**The window is symmetric: `Math.abs(Date.now() - savedAt) <= MAX`.** One-sided arithmetic reads a
stamp from the future as *negative* age, and negative is always inside the window — so a tablet whose
clock ran ahead and was later corrected would carry a draft that never expires at all. One token,
same positive phrasing, and it says what the rule actually is: within one shift of now, either way.

⚠ **The type assertion earns its place against exactly two shapes, and neither is the obvious one.**
A missing or unparseable stamp is already refused by the arithmetic, because `NaN <= x` is false.
What *survives* the arithmetic is a stamp written as a **numeric string** (subtraction coerces it)
and one that overflowed to **`Infinity`** — `JSON.parse` turns the literal `1e999` into exactly that,
and `Date.now() - Infinity` is `-Infinity`, comfortably "within the window". `localStorage` is
writable by whoever holds the tablet, so a stamp that is not a finite number is refused like every
other shape that is not ours.

*(Both corrections came out of the mutation runs in §5, not from reading. The first draft of this
spec said `NaN` would read as fresh — wrong, given the positive phrasing. The second said
`Number.isFinite` earned its place against one shape — one short. Note that phrasing the comparison
as an* is-expired *test WOULD invert `NaN` into "fresh"; the positive form is deliberate.)*

### 3.4 Releasing the buffer, not just clearing it

Clearing storage is not enough on its own. The `visibilitychange` listener (`:103-108`) closes over a
draft snapshot and its cleanup runs only on unmount or a `[orderId, step, values]` change — so during
the `await navigate` that follows `finish` (`:267-269`) and `discard` (`:222-223`), a tablet that
sleeps writes the buffer straight back over the clear. That is the same reader/writer disagreement
this spec exists to remove, so it is closed here rather than named as a limitation.

`clearIntakeDraft()` at those two sites becomes `releaseBuffer()`:

```ts
/**
 * The wizard is done with the tablet buffer — the intake was abandoned, or it is signed and we are
 * navigating away. A ref rather than state: the visibilitychange handler has to see this
 * immediately, and nothing renders differently because of it.
 */
const released = useRef(false)
```

`releaseBuffer` sets the ref and clears storage; Effect B and its `onHide` handler both return early
when it is set.

**Which sites release, and which deliberately do not.**

- `discard` (ODUSTANI) — releases. He is leaving.
- `finish`, **on the success path only** — releases. The intake is signed.
- `discardBuffer` (waving away the offer) — does **not** release, and needs nothing: he is still
  working, and the listener's snapshot at that moment is the empty mount state, which §3.1's writer
  guard already refuses.
- `finish`, on the failure path — does **not** release. See §7 item 2: keeping his safety net while
  he is still standing at the car matters more than the stale buffer, which self-heals.

### 3.5 ODUSTANI must work when the order is already gone

`discard` (`:215-228`) awaits `deleteIntakeOrder` **inside** the try that also contains
`clearIntakeDraft()` and the navigation. So when the delete fails — a lost connection, or a row a
colleague already removed — the throw skips both: the buffer keeps offering a dead order, the
serviser stays on the wizard, and ODUSTANI becomes a button that does nothing but show an error.

Abandoning is a local decision, so the tablet must let go either way. The delete moves into its own
try, and the release and the navigation move out of it:

```
if (orderId !== null) { try { delete; invalidate } catch { toast } }
releaseBuffer()
await navigate({ to: '/prijem' })
```

A server row that survives is not lost — it stays in his unfinished list and is recoverable by its
number — so the toast must stop saying *"Odustajanje nije uspelo. Probaj ponovo."*, which after this
change is false on both counts. so the toast must stop saying
*"Odustajanje nije uspelo. Probaj ponovo."* — false on both counts after this change.

The replacement has to be true in **both** branches, and the client cannot tell them apart: a request
that never arrived leaves the row alive, while one that committed and lost its response leaves it
gone. So it claims neither — *"Nalog možda nije obrisan sa servera. Proveri među nedovršenima."* An
earlier wording asserted the row survived, which sends him to look for something that is not there
whenever the second branch is what happened. Key kept, text corrected in both message files;
`pnpm --filter @mr/i18n run compile` is required before the change is visible in dev.

**And the confirm button gets `pending`.** `discard` awaits the delete before it releases and
navigates, `ConfirmDialog` never self-closes, and its confirm is a plain `Button` — so on a WiFi that
is associated but has no backhaul, a serviser who taps again fires a second DELETE and collects a
second toast. `ConfirmDialog` already supports `pending` (`packages/ui/src/components/confirm-dialog.tsx:24`);
it was simply never passed. The existing `saving` flag drives it.

### 3.6 The buffer belongs to a person, and dies when it is dead

Two holes the review found, both made reachable-for-longer by §3.3's expiry replacing the accidental
cleanup:

**It had no owner.** `docs/25` §1 says the tablet is shared and that seeing his own name matters
*"na deljenom tabletu"*. The buffer carried no identity, so the next serviser to open the wizard was
offered his colleague's intake — customer name, address and phone included, which is precisely what
the API refuses him (`assertDraftOwner` 404s a foreign draft rather than 403, so as not to leak even
its existence). The first draft of this spec deferred this, claiming the only client-side identity
was `authClient.useSession()?.user?.id` and that its hydration race would reject a man his own
resume. **That claim was wrong**, and the review said so: `useInternalAuthUser()` is already called
two lines above, reads the root route context, is synchronous and SSR-stable, and returns
`userEmail`. So `IntakeDraftBuffer` gains `savedBy`, `readIntakeDraft` takes the reader's email, and
a draft is offered only to the person who left it.

An empty reader matches nothing — including an empty `savedBy`. "Nobody equals nobody" would hand a
customer to whoever is holding the tablet, and an equality check alone cannot see that.

**Nothing deleted it any more.** Once the writer stops overwriting blindly, the only paths that clear
the key are ODUSTANI, a signed intake, and waving the offer away — so an expired draft, with the
customer's name, phone, address and plate, would sit in a shared tablet's `localStorage` forever.
Reading now evicts what is no longer fresh. A draft belonging to **someone else is refused but never
evicted** — it may be the only copy of his step 1, and deleting a colleague's work to tidy up would
be the very bug this document exists to fix.

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
| T1 | a draft with no order number is not offered back | delete the number clause of `isOfferable` |
| T2 | **the regression test** — writing the empty draft Effect B builds does not replace a real one | delete the `isWorthKeeping` guard in `writeIntakeDraft` (**red on the code before this change**) |
| T3 | writing continues while the intake is still worth keeping | over-apply the guard: an unconditional return, or write-once |
| T4 | a shape it cannot read is no draft at all and does not throw (`{"values":null}`, `{"values":{}}`, `[]`, a bare string) | make the reader's `catch` rethrow — TypeError escapes into the mount effect |
| T5 | the number blanked after the server row exists keeps buffering | delete the `orderId !== null` half of `isWorthKeeping` |
| T6 | **the twelve-hour policy is twelve hours** — asserted against the literal, not the constant | change `INTAKE_DRAFT_MAX_AGE_MS`; nothing else in the suite notices |
| T7 | a draft from earlier in the shift is offered; one older than a shift is not | delete the comparison in `isFresh` |
| T8 | an expired draft is thrown away, not left on the tablet | drop the eviction branch in `readIntakeDraft` |
| T9 | a stamp from the future is refused rather than trusted forever | make the window one-sided again |
| T10 | a `savedAt` that is missing, a date string or `NaN` is refused | (pins the POSITIVE phrasing — an is-expired form inverts `NaN` into "fresh") |
| T11 | a `savedAt` that is a numeric string, or `1e999` → `Infinity`, is refused | delete `Number.isFinite` — these two are the only shapes that reach it |
| T12 | one serviser is not shown the other's customer | delete the `savedBy === reader` clause |
| T13 | a colleague's draft is left where it is — it may be his only copy | widen eviction to cover a non-offerable draft |
| T14 | an unnamed session is offered nothing, and two unnamed sessions are not the same person | delete `reader.length > 0` |

Every mutation above was run, not reasoned about. The run also showed one thing worth keeping:
rewriting the freshness comparison as an inverted *is-expired* test reddens **nothing**, because
`Number.isFinite` already refuses the shapes that phrasing would let through. That is defence in
depth working, not a gap.

New file `__tests__/intake-wizard-draft-offer.test.tsx`:

| # | Test | Reds when you break |
|---|------|---------------------|
| T15 | an offer the serviser neither took nor waved away is still there after a reload — seed, render, assert the note, `unmount()`, render again, assert the note | delete the write guard (**red on the code before this change**) |
| T16 | ODUSTANI lets go of the intake even when the server delete fails, **and says so** | put the delete back inside the outer try (§3.5) |
| T17 | a tablet that sleeps right after ODUSTANI does not write the buffer back | delete the `released` guard from `onHide` (§3.4) |

T2 and T15 both red on the pre-change's code, so neither fails uniquely; that is stated here rather than
discovered in review. T15 is the only test that would notice a future edit bypassing the module and
writing `localStorage` directly from the component — which is the class of bug being fixed.

⚠ **One site is deliberately left uncovered: the `releaseBuffer()` on `finish`'s success path.**
Reaching it in a component test means signing both pads, and the signature pad is a canvas driven by
pointer events that jsdom does not deliver meaningfully — the test would assert on a harness rather
than on the wizard. What the gap actually leaves untested is a one-word substitution
(`clearIntakeDraft` → `releaseBuffer`) at a single call site; `releaseBuffer` itself is proven by T9,
and the release-only-on-success rule is visible in the code beside its reason. Recorded so the review
pass can decide whether an e2e (none exists in this repo today) is worth standing up for it.

**Four traps the audit found, all of which silently produce a passing-but-worthless test:**

1. **StrictMode is on in dev** (TanStack Start's default client entry wraps `<StartClient />`).
   Its double-invoke does **not** reproduce this bug — the second read fails A's guard, but the else
   branch is a no-op so `foundDraft` keeps what the first run set. T15 must do a real
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
4. **T7/T8/T9/T10/T11 must mock time** (`vi.setSystemTime`), per CLAUDE.md §6 rule 03. The window is computed in
   JS, not in Postgres, so the clamp-the-fixtures exception does not apply here.

T15's harness is smaller than it looks: all three queries in the mount path are disabled at empty
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
| `…/wizard/intake-wizard-state.ts` | `isWorthKeeping`, `isFresh`, `isOfferable`, `INTAKE_DRAFT_MAX_AGE_MS`, `savedAt` + `savedBy` on `IntakeDraftBuffer`, the reader parameter, the eviction branch |
| `…/wizard/intake-wizard.tsx` | `:92` loses its inline guard · `userEmail` stamps and reads the buffer · `released` ref + `releaseBuffer` · Effect B and `onHide` respect it · `discard` restructured and `pending` wired |
| `packages/i18n/src/messages/{sr,en}.json` | `intake_discard_failed` reworded (§3.5) |
| `…/wizard/__tests__/intake-wizard-state.test.ts` | T1–T14 |
| `…/wizard/__tests__/intake-wizard-draft-offer.test.tsx` | new, T15–T17 |

No migration, no API change, no new permission, **no new** i18n key, no dependency. One existing
message's text changes, so `pnpm --filter @mr/i18n run compile` runs before the browser check.

---

## 7. Deliberately not done, with the argument

Nikola widened the scope to "everything, including what is out of scope". Four things are still left
out — not for effort, but because taking them now makes the system worse. Each one names what it
would cost.

1. **`resumeBuffer` trusts `localStorage`'s `orderId` blindly** (`:160-168`) while `resumeServerOrder`
   always refetches (`:175-189`), so a resumed buffer can name a hard-deleted draft or a signed
   order. The obvious fix — validate against the server before adopting — **breaks a promise
   `docs/25` makes explicitly**: a serviser must never stand in front of the customer waiting for the
   hall's WiFi (the reasoning is written into `intake-wizard.tsx:234-238`). A hard validation gate
   means no resume at all when the network is down, which is exactly when the buffer matters most.
   The soft version — adopt now, reconcile when the network answers — is a real design, and it is
   **Task 12 Step 5's** design. Doing a rushed version here and a proper one there is the duplication
   this whole spec exists to avoid.
2. **A failed `finish` leaves a buffer pointing at a signed order** (`clearIntakeDraft` is inside the
   try, `:259-268`), so a WiFi drop that loses the *response* to a successful sign keeps the buffer.
   Moving the clear into a `finally` was in the first draft of this spec and is **withdrawn**: it
   would also clear the buffer when signing genuinely failed and the serviser is still at the car,
   removing his safety net to fix a case that already self-heals. It self-heals because accepting
   the stale offer fills the number field, the server answers `TakenOrder`, and the note replaces the
   offer with the red *"broj već pripada potpisanom nalogu"* plus an *Otvori nalog →* link
   (`intake-wizard-note.tsx:111-131`). ⚠ **That self-heal needs the network whose loss created the
   case** — the note is driven by a server check — so it heals on the next attempt with signal, not
   necessarily the same one. §3.3's 12-hour expiry bounds the rest.
3. **~~The buffer is tablet-scoped, not user-scoped.~~ BUILT — see §3.6.** This item was deferred in
   the first draft on the argument that the only client-side identity was
   `authClient.useSession()?.user?.id` and that its hydration race would reject a serviser his own
   resume. The review refuted it: `useInternalAuthUser()` is already called two lines from the code
   in question, is synchronous and SSR-stable, and returns `userEmail`. The argument was wrong, so
   the deferral went with it. Kept here, struck through rather than deleted, because a spec that
   quietly removes its own bad reasoning teaches nobody anything.

4. **Creating the server row as soon as a valid free number is typed**, rather than on leaving step 1.
   The buffer would stop being anyone's only copy and "nedovršeni" would catch everything. Deferred
   by Nikola on 2026-08-04 and still the right call: it rewrites the number-check state machine — the
   most intricate part of step 1, already shipped, browser-verified and reviewed — and doing that
   inside a bug fix is how a hundred things go wrong at once. Worth deciding deliberately, with time.

**Recorded for the review pass Nikola plans once the intake module is finished.**

4b. **When the 12-hour expiry does bite, the intake disappears with no message.** At step 1 there is
   no server copy behind it, so the tablet silently throws away work the serviser never finished.
   Deliberate: he was never told the buffer existed, the draft is over twelve hours old and
   unfinished, and a toast on mount about something he has forgotten is noise. But it *is* silent
   disposal, which is the same family as the bug this document fixes — worth a deliberate look
   rather than an accident.

4c. **The `released` guard in Effect B's body has no test**; only the one inside `onHide` does (T17).
   It became reachable when `userEmail` joined the effect's dependencies: a session that resolves
   after release would re-run the effect. Driving that from a test means controlling the auth hook
   mid-render, which costs more harness than the two lines are worth. Named rather than hidden.

5. **Plan Task 12's buffer test becomes vacuous under this fix.**
   `docs/superpowers/plans/2026-07-29-intake-detail-v6.md:1434-1439` asserts
   `readIntakeDraft()?.orderId` is unchanged after a mount, to prove a `resuming` guard on Effect B.
   With the writer guarded, the mount write is a no-op regardless, so the assertion holds even if
   that guard is never implemented. A ⚠ note is added at that line in the plan; re-point it when
   Task 12 runs.
6. **`docs/25` §3.3.2 described something that was never built.** It said the local buffer "is flushed
   upwards when the network returns or the tablet wakes (`visibilitychange`)". The handler
   (`:103-105`) only rewrites `localStorage`. The doc is corrected to say what exists; **whether the
   upward flush should be built is left open**, because it is a feature with its own questions (what
   is sent, when, and what happens when it conflicts with the server) and not a wording fix.
7. **One tablet holds one buffer**, while `docs/25` §3.3.3 allows several unfinished intakes per
   serviser. Not a contradiction — the server holds the many, the tablet holds the last mile — but it
   reads like one until said out loud. Starting a different intake replaces the buffered one; that is
   existing behaviour, not introduced here.
8. **A V-3-era buffer whose `values` predate `damages`/`services`/`materials`** passes `isOfferable`
   and fails later at `toUpdateInput` as a 422. §3.3's expiry makes it unreachable in practice.

---

## 8. What the two agent runs actually changed

Recorded because the value was in the corrections, not in the confirmations.

**Run 1 — 18 agents, before any code.** Confirmed the mechanism and then took the first design apart
twice. It forced `isWorthKeeping` and `isOfferable` into separate predicates (§3.1) by finding that a
single number-only rule freezes the buffer when the number is blanked mid-intake. And it established
that the read guard belongs inside the existing try (§3.2), which turned the change from "adds a
check" into "removes a crash path".

**Run 2 — 10 agents, against the committed diff.** Three findings survived refutation and two of the
loudest did not. Refuted: that this change *created* the shared-tablet exposure (it did not — it
pre-existed, and §3.6 now closes it), and that the reworded ODUSTANI toast points at a tab the order
is never in (the narrower, true version became §3.5's two-branch wording). Confirmed and taken: the
one-sided window, the missing eviction, the double-tap on ODUSTANI. And it caught this spec
contradicting itself — §7 item 3's stated blocker did not exist, two paragraphs from the code that
disproves it.

**What the mutation runs caught that no reviewer did.** Deleting `Number.isFinite` reddened nothing
until a numeric-string case existed; deleting `reader.length > 0` reddened nothing until an
unnamed-owner case existed. Both clauses were real and both were untested, which is the failure mode
a passing suite hides best. One mutation script also reported "nothing went red" for a mutation that
had simply failed to compile — the harness now separates *the suite ran and nobody cared* from *the
suite never ran*, because those look identical and only one of them is good news.
