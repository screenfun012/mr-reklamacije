# Čet — korak 2: ekran „Razgovori" (lista, Opšti kanal, composer)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** the first screen a person can actually use — the conversation list, the general channel, and a composer that sends — plus the client half of the realtime contract, so a message never silently goes missing.

**Architecture:** a new route under the existing `_shell` layout. Three columns; the third (context panel) belongs to step 3 and is not built here. Reads go through query factories in `@mr/shared`; the SSE handler already invalidates `chatKeys` (step 1). Recovery and liveness are the two things this step adds to the transport.

**Spec:** `docs/superpowers/specs/2026-08-23-cet-razgovori-design.md` (§9 realtime) · **visual law:** `design_handoff_chat/cet-prototip.dc.html` — serve the folder over HTTP and READ the values; never eyeball. Acceptance list: `docs/superpowers/plans/2026-08-23-cet-prijemna-lista.md`.

## Global Constraints

- **The prototype wins over prose.** Every number below was read from the file; if the file disagrees with this plan, the file is right and the plan is the bug.
- Colours come from `--mri-*` tokens. ⚠ `var(--mri-<status hue>)` does **not** resolve — use the utility class (CLAUDE.md §5). `bg-mr-surface-raised` is not a utility either.
- **No red-filled primary buttons** (brandbook). POŠALJI is `--btn` (light fill), which is what the prototype draws.
- Every string through Paraglide, `sr` + `en`. After editing messages: `compile` for dev, **`build`** for the gate.
- Skeletons, not spinners; empty and error states on every list (CLAUDE.md §5).
- Optimistic send is allowed here (small action with rollback); claim create/edit optimism stays forbidden.
- Gate before every commit (tests in their own pass, `--concurrency=2` / `1`).

---

### Task 1: The connection notices when it dies

**Files:** `apps/api/src/modules/events/sse.controller.ts`; `apps/internal-web/src/lib/use-realtime-event-stream.ts`; their tests.

Today the heartbeat is `stream.write(':heartbeat\n\n')` — a comment line. `EventSource` ignores comments, and Hono's `write` **swallows the error on a dead socket**. When TCP dies without an RST (Wi-Fi→LTE, VPN drop, a laptop lid), neither side notices: the chat looks connected and stays silent.

- [ ] **Step 1: Failing tests** — server: the stream emits an event named `ping` every `SSE_HEARTBEAT_MS`. Client: after 45 s with no event of any kind, the stream is closed and reopened.
- [ ] **Step 2: Implement** — server: `stream.writeSSE({ data: '', event: 'ping' })`, same 20 s interval, **the 30-minute lifetime cap stays** (it is what re-validates a revoked session). Client: add `ping` to the handled types, keep a `lastEventAt` ref that every listener updates, and a 45 s interval that force-closes and lets the existing 1 s→30 s backoff reconnect.
- [ ] **Step 3: Mutation** — make the watchdog never fire; the client test goes red. Restore.
- [ ] **Step 4: Commit** — `fix(events): a dead stream is noticed instead of looking connected`

---

### Task 2: Query factories

**Files:** `packages/shared/src/queries/chat.ts` (extend); test.

**Produces:** `chatConversationsOptions()`, `chatMessagesOptions(conversationId)`, `fetchChatMessagesSince(conversationId, afterSeq)`, `sendChatMessage(conversationId, input)`, `markChatRead(conversationId, lastSeq)`.

- [ ] Keys already exist (`chatKeys`). Older pages use `beforeSeq`; the newest page is the initial fetch.
- [ ] `staleTime: 0` for messages (a chat is never stale) and `refetchOnWindowFocus: false` — **recovery is the mechanism, not refetch-on-focus**; leaving both on would double-fetch and hide a broken recovery.
- [ ] Commit — `feat(shared): the chat's reads, as query options`

---

### Task 3: The route, the menu entry, the three columns

**Files:** `apps/internal-web/src/routes/_shell/razgovori.tsx` (new); the sidebar and its nav item list; i18n.

Prototype values, read from the file:

- list column `width:252px; flex:none; border-right:1px solid var(--border); background:var(--surface)`
- message column `flex:1; min-width:0; background:var(--bg)`
- conversation header `height:52px; padding:0 16px; border-bottom:1px solid var(--border); background:var(--surface)`
- message pane `flex:1; min-height:0; overflow:auto; padding:16px 16px 10px; gap:14px`

- [ ] Menu entry „Razgovori" between „Reklamacije" and „Prijem vozila" (prototype: 04 Razgovori, 05 Prijem vozila), amber unread badge `font:600 10px mono; background:rgba(234,179,8,.13); color:var(--amb); padding:2px 7px; border-radius:20px`.
- [ ] ⚠ The badge count is `unreadTotal` from the conversations read — the ONE number. Do not add a second count.
- [ ] Route guard: `INTERNAL_APP_PERMISSIONS`, the same set the API gate uses.
- [ ] Loading = skeleton columns, not a spinner.
- [ ] Commit — `feat(internal): Razgovori has a screen`

---

### Task 4: The conversation list

**Files:** `apps/internal-web/src/features/chat/conversation-list.tsx` + tests.

Read from the prototype:

- header `padding:14px 12px 10px`, eyebrow „RAZGOVORI" `font:700 10px mono; letter-spacing:.22em; color:var(--red)`
- DND switch `font:700 8.5px mono; letter-spacing:.12em; padding:4px 9px; border-radius:7px` — off `--text2` + `--border2`; on `rgba(237,28,36,.13)` + `--redh` + red border `.5`
- search input `height:34px; border-radius:8px; background:var(--inbg); border:1px solid var(--border2); font:500 12px`
- section title `font:600 8.5px mono; letter-spacing:.18em; color:var(--text2)`; „+" button `20px; border-radius:6px; border:1px solid var(--border2)`
- channel row `height:36px; padding:0 10px; border-radius:9px; font-size:13px`; active `rgba(237,28,36,.11)` + `inset 2px 0 0 var(--red)` + w700
- thread row `height:40px`; kind dot `7px` (EMOTIVE `#2e90fa`, DOMAĆA `#a78bfa`); MR `font:600 11.5px mono`; subtitle `10.5px --text2` ellipsis; unread badge as above; MUTE badge `font:700 7.5px mono; border:1px solid var(--border2); border-radius:5px; opacity:.7`
- footer `padding:11px 12px; border-top`; italic `10.5px --text2`, text verbatim from the prototype

- [ ] Sorting: last activity first; unread above read. Muted-and-inactive at `opacity:.65`.
- [ ] **DND is per browser** (`useStoredFlag`), and its tooltip says so.
- [ ] The search input is drawn but does not search yet (step 7 owns it). Either disable it with a title that says so, or make it filter the list client-side — **pick one and say which in the handback**; leaving it looking broken is the one option that is not allowed.
- [ ] Commit — `feat(internal): the list of conversations`

---

### Task 5: Messages and the composer

**Files:** `apps/internal-web/src/features/chat/{message-list,message-row,composer}.tsx` + tests.

Read from the prototype:

- avatar `32px` circle, initials `11px w800`
- name `13px w800`, time `font:500 9.5px mono --text2`, „izmenjeno" italic mono `9px`
- body `font-size:13px; line-height:1.55; word-break:break-word`
- system pill `padding:6px 12px; border-radius:20px; background:var(--inbg); border:1px solid var(--border); font:500 10.5px mono; color:var(--text2)`, amber `↻`, time at `opacity:.6`
- NOVO separator: two `1px rgba(234,179,8,.4)` rules around `font:700 8.5px mono; letter-spacing:.18em; color:var(--amb)`
- quick replies row `padding:10px 16px 0`, „BRZO:" `font:600 8px mono; letter-spacing:.16em`, chips `11px w600; padding:5px 11px; border-radius:20px; border:1px solid var(--border2)`
- composer row `padding:10px 16px 12px; gap:9px`; attach/camera `36×40; border-radius:9px`; input `height:40px; border-radius:9px; background:var(--inbg); font:500 13px`; POŠALJI `height:40px; padding:0 18px; background:var(--btn); color:var(--btntx); font-size:11px; font-weight:700; letter-spacing:.06em`

- [ ] Attach and camera are **drawn but inert** here (step 4 owns them) — give them a title saying so; do not hide them, the prototype has them.
- [ ] Quick replies **insert into the field, never send**.
- [ ] Enter sends, Shift+Enter is a new line.
- [ ] **Optimistic send**: `clientMsgId` minted before the POST; the row renders greyed with no `seq`; success replaces it by `clientMsgId`; failure marks it and retries **with the same id**.
- [ ] Auto-scroll to the bottom **only when already within 80px of it**; otherwise a floating „↓ nove poruke" button.
- [ ] Time via `Intl` **with `timeZone: 'Europe/Belgrade'`** — the server is UTC and this repo has lost a day to that before.
- [ ] Commit — `feat(internal): reading and writing in a conversation`

---

### Task 6: Nothing is lost while the tab sleeps

**Files:** `apps/internal-web/src/features/chat/use-chat-stream.ts` (new) + test.

- [ ] On three triggers — SSE `open`, `visibilitychange` → visible, and the Task 1 watchdog — fetch `?afterSeq = maxSeen - CHAT_RECOVERY_OVERLAP` and merge, deduplicating by message id.
- [ ] **Test the overlap for real:** seed the cache with messages up to seq 42, have the fetch return 41 and 42, assert 41 appears exactly once and in order.
- [ ] **Mutation:** change the request to `afterSeq = maxSeen`; the recovery test goes red. This is the one number the whole design hangs on.
- [ ] Commit — `feat(internal): a message written while you were away still arrives`

---

### Task 7: i18n, gate, browser proof, acceptance list

- [ ] All strings in `sr` + `en`; `compile` and `build`.
- [ ] Full gate.
- [ ] **Browser proof** (Playwright from `apps/api/node_modules/playwright`, against the already-running dev servers — never start or kill them): open `/razgovori`, send a message, see it appear; a second browser context as another user watches it arrive live; cut the network for 10 s, restore, confirm the missed message appears.
- [ ] Update `docs/superpowers/plans/2026-08-23-cet-prijemna-lista.md` for every line this step touched.
- [ ] Commit and push.
