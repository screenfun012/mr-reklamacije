# Čet — korak 3: niti reklamacija

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** a claim gets its conversation, reachable through all three doors the owner named — an MR number in any text, the „+" dialog, and the claim's own detail screen — and the thread carries the claim's context beside it.

**Architecture:** the backend is finished (step 1: `POST /api/chat/claims/:kind/:id/thread` is get-or-create, threads follow the INTERNAL claim-view sets). This step is the screen: linkification at render, the third column, one dialog, and a tab on the claim detail that mounts the same pane the chat screen mounts.

**Spec:** `docs/superpowers/specs/2026-08-23-cet-razgovori-design.md` §3.5 (MR shapes), §5 rows 14–16 · **visual law:** `design_handoff_chat/cet-prototip.dc.html` — serve it and READ the values. Acceptance list: `docs/superpowers/plans/2026-08-23-cet-prijemna-lista.md`.

## Global Constraints

- **The prototype wins over this plan.** Two previous steps found nine places where the plan was the bug; expect more and report them.
- **Linkification happens at RENDER, never in the database** (handoff §10) — the text is stored raw.
- ⚠ **The MR shapes are real production data, not the handoff's regex** (spec §3.5): `7167/25`, `MR1204/26`, `MR-7167` all exist, and `normalizeMrKey` does **not** strip the `MR` prefix, so the literal and the stripped form are different keys. Intake numbers (`RN-…`) must be **excluded**.
- No new permission. Threads are gated by the claim's INTERNAL view sets, already enforced server-side.
- Strings through Paraglide, `sr` + `en`; `compile` for dev, **`build`** for the gate.
- Gate before every commit.

---

### Task 1: An MR number in any text becomes a link

**Files:** `packages/shared/src/utils/linkify-mr.ts` (new) + test; `apps/internal-web/src/features/chat/message-body.tsx` (new) + test.

- [ ] **Pure function first**, in `@mr/shared`: `findMrCandidates(text): { start, end, raw, keys: string[] }[]`, where `keys` holds the literal normalised key **and** the prefix-stripped one, in that order.
  - Pattern: `MR?\s?-?\d{3,5}\s?/\s?\d{2}` plus the prefixed-no-slash shape the data shows (`MR-7167`). Write the tests from the real values in the spec before the regex.
  - ⚠ **`RN-0249/26` must NOT match.** Its own normaliser uppercases and it lives in a different registry; linking it to a claim would open the wrong thing. This deserves its own test.
- [ ] **Resolution**: `GET /api/mr-registry/lookup` is the only resolver and it is gated on the CREATE permissions — a viewer holds neither, so every chip would 403 for him (spec deviation D7). **Widen that route's permission list to the INTERNAL claim-view sets** and say so in the handback; it is a security-shaped change, so state it plainly rather than burying it.
- [ ] Render: a resolved number is the prototype's blue chip (L55: `font:600 11.5px mono; background:rgba(46,144,250,.13); color:#2e90fa; padding:2px 7px; border-radius:6px; white-space:nowrap`); an unresolved one stays plain text (§8.1).
- [ ] Click → open that claim's thread. **If no thread exists, offer to create one — never create silently** (§8.2).
- [ ] **Mutation:** make `RN-` match; its test goes red.
- [ ] Commit — `feat(chat): an MR number in a message opens its thread`

---

### Task 2: „Nova nit" dialog

**Files:** `apps/internal-web/src/features/chat/new-thread-dialog.tsx` + test.

Read from the prototype (L185–201): card `width:430px; max-height:520px; background:var(--surface); border:1px solid var(--border2); border-radius:14px; box-shadow:0 28px 70px rgba(0,0,0,.6); animation:fadeUp .25s`; eyebrow „NOVA NIT" `font:700 10px mono; letter-spacing:.22em; color:var(--red)`; explanation `12px --text2`; search input `height:38px; border-radius:9px`; row `height:44px; padding:0 10px; border-radius:9px` with a `7px` kind dot, MR `font:600 12px mono`, partner `10.5px --text2`, and a right-hand badge — **„NIT POSTOJI →"** (`--border2` outline, `--text2`) or **„NAPRAVI +"** (`rgba(31,169,113,.1)` fill, `.4` border).

- [ ] The list is the existing claims search — reuse the claims query factory, do not invent an endpoint.
- [ ] Choosing an existing thread opens it; choosing a new one creates it (the server writes the `thread_created` system message), then a toast, then opens it.
- [ ] Commit — `feat(chat): a thread can be started from the list`

---

### Task 3: The context panel (the third column)

**Files:** `apps/internal-web/src/features/chat/thread-context-panel.tsx` + test; the route.

Read from the prototype (L159–177): `width:250px; flex:none; border-left:1px solid var(--border); background:var(--surface); overflow:auto; animation:fadeUp .3s`. Sections: REKLAMACIJA (`padding:14px 14px 12px`, eyebrow `font:600 8.5px mono; letter-spacing:.18em`, MR `font:700 15px mono`, kind pill, outcome pill, `11.5px --text2; line-height:1.5` for partner + „Zadužen: …", button „OTVORI REKLAMACIJU →" `height:32px; border-radius:8px; background:var(--raised); border:1px solid var(--border2); font-size:10.5px; font-weight:700; letter-spacing:.06em`) · PRIKAČENO · N (only when there are pins) · PRILOZI IZ RAZGOVORA · N (grid `repeat(3,1fr)`, `gap:6px`, squares `aspect-ratio:1; border-radius:7px`) · italic footer at `margin-top:auto`, text verbatim.

- [ ] **Only in a thread**, and toggled by the ⓘ button in the conversation header (L90) — on: red tint `.13` + red border `.5`.
- [ ] Attachments are step 4; draw the section with its empty state and say so in the handback rather than faking squares.
- [ ] Commit — `feat(chat): the thread carries its claim beside it`

---

### Task 4: The „Razgovor" tab on the claim detail

**Files:** the EMOTIVE and DOMACE detail screens, `ClaimDetailTab`, the tab list; test.

- [ ] Same thread, same composer, **no context panel** — the detail IS the context (§8.5).
- [ ] **A claim with no thread yet shows an empty state with a „Napravi nit" button** — opening the tab must not create one (§5 row 15).
- [ ] The tab carries an unread count like Prilozi does (§5 row 16).
- [ ] `?tab=razgovor` must survive the route's Zod search schema.
- [ ] Commit — `feat(internal): a claim's detail opens its conversation`

---

### Task 5: Gate, browser proof, acceptance list

- [ ] Full gate.
- [ ] **Browser proof:** write a message containing a real MR number, click the chip, land in that claim's thread; open the same thread from the claim's detail and see the same messages; toggle the context panel.
- [ ] Update the acceptance list for every line this step touched.
- [ ] Commit and push.
