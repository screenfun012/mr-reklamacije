# Čet — korak 1: model, API i SSE (bez ijednog ekrana)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` for tracking.

**Goal:** the whole chat backend — seven tables, one module, one SSE event, and a port the claim services call — proven by integration tests against real Postgres, with no UI at all.

**Architecture:** a new `apps/api/src/modules/chat/` following the mandatory anatomy. Ordering and recovery ride a monotonic `seq bigserial`; sending is idempotent through a client-minted id; unread is one number computed from `chat_reads`. A `ChatPort` in `core/ports/` lets claim services post system messages without a module importing a sibling module.

**Tech Stack:** Drizzle + Postgres · Hono · Zod in `@mr/shared` · `PostgresEventBus` · Vitest + real-Postgres integration tests.

**Spec:** `docs/superpowers/specs/2026-08-23-cet-razgovori-design.md` (§4 model, §9 realtime contract). Visual law is `design_handoff_chat/` — **not used in this step**, there is no UI here.

## Global Constraints

- **No new permission** (spec N4). Chat is gated by `INTERNAL_APP_PERMISSIONS`; a claim thread additionally requires `INTERNAL_{EMOTIVE,DOMACE}_CLAIMS_VIEW_PERMISSIONS`. **No `db:seed` for permissions** — but the general channel IS seeded, see Task 8.
- **A module may not import a sibling module** (depcruise). Claim services reach chat only through `ChatPort` in `core/ports/`.
- **Controller never touches the DB; service/repository never import `hono`.** `process.env` only in `core/config/env.ts`.
- **Soft delete** for messages (`deleted_at`); repos filter it. Conversations too.
- **SSE carries `{ conversationId, messageId }` and nothing else** — signal only.
- **Ordering is `seq`, never `created_at`.** Recovery always uses an overlapping window; see Task 4.
- Errors are typed domain errors, never bare `Error`. 404 (not 403) when a row is out of the caller's scope.
- **Every guard ships a mutation proof:** break the line, watch the test go red, restore.
- Gate before every commit (this machine, tests in their own pass):
  ```bash
  pnpm format:check \
    && TZ=UTC pnpm exec turbo run build typecheck lint --force --concurrency=2 \
    && TZ=UTC pnpm exec turbo run test --force --concurrency=1 \
    && pnpm --filter api depcruise && TZ=UTC pnpm test:integration
  ```
- After `db:generate` **always** `db:migrate` into the dev DB, and **`pnpm --filter @mr/db build`** before api tests read `dist`.

---

## File Structure

**`packages/db`** — `src/schema/chat.ts` (new, exported from `schema/index.ts`), one generated migration, `src/seed/chat.ts` (general channel) wired into `run-system-seeds.ts`, `src/__tests__/integration/chat.integration.test.ts`.
**`packages/shared`** — `src/schemas/chat.schema.ts` (wire + Zod), `src/constants/chat.ts` (enums, limits), `src/constants/app-events.ts` + `chat-events.ts` (the SSE event), `src/queries/chat.ts` (keys + fetchers; used from step 2, declared here).
**`apps/api`** — `src/modules/chat/{chat.schema,chat.validators,chat.repository,chat.service,chat.controller,chat.routes,index}.ts` + `__tests__/`, `src/core/ports/chat-port.ts`, container + `app.ts` + `test-app.ts` wiring, `src/core/ports/event-bus-port.ts` + both buses + `NotifyMessageSchema`.

---

### Task 1: The tables

**Files:** create `packages/db/src/schema/chat.ts`; modify `packages/db/src/schema/index.ts`; create the generated migration; modify `packages/db/src/__tests__/integration/chat.integration.test.ts` (new).

**Interfaces produced:** `chatConversations`, `chatMembers`, `chatMessages`, `chatReads`, `chatPins`, `chatReactions`, `chatMutes`.

- [ ] **Step 1: Write the failing schema test**

New file `chat.integration.test.ts`, transaction-per-test like `claim-category-fields.integration.test.ts` (copy its `beforeAll/beforeEach/afterEach` block and its `expectConstraint` helper verbatim — it asserts on the constraint NAME, which is what pins which rule refused).

```ts
it('keeps one thread per claim, and refuses a conversation that is both kinds at once', async () => {
  const [claim] = await db.select({ id: schema.emotiveClaims.id }).from(schema.emotiveClaims).limit(1)
  await db.insert(schema.chatConversations).values({ type: 'claim', emotiveClaimId: claim?.id, createdBy: TEST_USER })
  // 1 reklamacija = 1 nit (spec §8.3) — expressible only as a PARTIAL unique index
  await expectConstraint(
    db.insert(schema.chatConversations).values({ type: 'claim', emotiveClaimId: claim?.id, createdBy: TEST_USER }),
    'uq_chat_conversations_emotive_claim',
  )
})

it('refuses a claim conversation with no claim, and a channel with no name', async () => { … two tests, one deliberate failure each … })

it('gives every message a monotonic seq, and refuses the same client id twice from one author', async () => {
  // seq is what ordering, "how far have I read", paging and recovery all hang on
  const a = await insertMessage({ body: 'prva' })
  const b = await insertMessage({ body: 'druga' })
  expect(Number(b.seq)).toBeGreaterThan(Number(a.seq))
  await expectConstraint(insertMessage({ clientMsgId: a.clientMsgId }), 'uq_chat_messages_author_client_msg')
})

it('keeps a message when its author is deleted — the messages are evidence', async () => {
  // ON DELETE SET NULL, never CASCADE (spec §4)
})
```

- [ ] **Step 2: Run it, watch it fail**

`cd packages/db && TZ=UTC pnpm run test:integration` → FAIL, `chatConversations` is not a known export.

- [ ] **Step 3: The schema**

`packages/db/src/schema/chat.ts`. Follow `catalogs.ts` for style — explicit index and constraint names, `timestamp(..., { withTimezone: true, mode: 'date' })`, `$onUpdate` on `updatedAt`.

```ts
export const chatConversations = pgTable('chat_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull().$type<ChatConversationType>(),
  name: text('name'),
  emotiveClaimId: uuid('emotive_claim_id'),
  domaceClaimId: uuid('domace_claim_id'),
  createdBy: uuid('created_by'),
  createdAt: …, updatedAt: …, deletedAt: …,
}, (t) => [
  check('chat_conversations_type_check', sql`${t.type} IN ('general','channel','claim')`),
  // A claim is not one table and has no shared id space — the repo's own answer to this exact
  // question is mr_registry: nullable pair + one-of CHECK + two partial unique indexes.
  check('chat_conversations_one_of_claim_check', sql`
    (${t.type} = 'claim' AND (
      (${t.emotiveClaimId} IS NOT NULL AND ${t.domaceClaimId} IS NULL) OR
      (${t.emotiveClaimId} IS NULL AND ${t.domaceClaimId} IS NOT NULL)))
    OR (${t.type} <> 'claim' AND ${t.emotiveClaimId} IS NULL AND ${t.domaceClaimId} IS NULL)`),
  check('chat_conversations_channel_name_check', sql`${t.type} <> 'channel' OR ${t.name} IS NOT NULL`),
  uniqueIndex('uq_chat_conversations_emotive_claim').on(t.emotiveClaimId).where(sql`${t.emotiveClaimId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
  uniqueIndex('uq_chat_conversations_domace_claim').on(t.domaceClaimId).where(sql`${t.domaceClaimId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
  uniqueIndex('uq_chat_conversations_general').on(t.type).where(sql`${t.type} = 'general'`),
  foreignKey({ name: 'chat_conversations_emotive_claim_id_fkey', columns: [t.emotiveClaimId], foreignColumns: [emotiveClaims.id] }).onDelete('restrict'),
  foreignKey({ name: 'chat_conversations_domace_claim_id_fkey', columns: [t.domaceClaimId], foreignColumns: [domaceClaims.id] }).onDelete('restrict'),
  foreignKey({ name: 'chat_conversations_created_by_fkey', columns: [t.createdBy], foreignColumns: [users.id] }).onDelete('set null'),
])
```

`chatMessages` — the load-bearing one:

```ts
  seq: bigserial('seq', { mode: 'bigint' }).notNull(),   // ⚠ ordering hangs on this, never created_at
  clientMsgId: uuid('client_msg_id').notNull(),          // minted by the sender, makes a retry safe
  authorId: uuid('author_id'),                           // NULL = system message, or a deleted account
  body: text('body').notNull(),
  quoteOf: uuid('quote_of'),
  systemKind: text('system_kind'),
  systemMeta: jsonb('system_meta').$type<Record<string, string>>(),
  editedAt, deletedAt, createdAt
```
indexes: `index('idx_chat_messages_conversation_seq').on(t.conversationId, t.seq)` (the only index the read path needs — keyset by conversation), `uniqueIndex('uq_chat_messages_author_client_msg').on(t.authorId, t.clientMsgId).where(sql\`${t.authorId} IS NOT NULL\`)`, FK author → users **SET NULL**, FK conversation → conversations **CASCADE** (a conversation genuinely owns its messages), FK quoteOf → self SET NULL.

`chatReads(conversationId, userId, lastSeq bigint, updatedAt)` PK both · `chatMembers(conversationId, userId, createdAt)` PK both · `chatPins(conversationId, messageId, pinnedBy, createdAt)` PK first two · `chatReactions(messageId, userId, createdAt)` PK both · `chatMutes(conversationId, userId)` PK both. All FKs CASCADE on the conversation/message, SET NULL or CASCADE on the user as the repo's precedent dictates (`user_roles.assigned_by` is RESTRICT; a read row may CASCADE — it is not evidence).

Export from `schema/index.ts`.

- [ ] **Step 4: Generate, read, apply**

```bash
pnpm --filter @mr/db run db:generate
```
**Read the generated SQL before applying.** It must contain only these seven `CREATE TABLE`s plus their constraints and indexes — nothing about any other table. If it carries an unrelated statement, stop and report. Then `pnpm --filter @mr/db run db:migrate` and `pnpm --filter @mr/db build`.

- [ ] **Step 5: Green + mutation proof**

`cd packages/db && TZ=UTC pnpm run test:integration` → PASS. Then drop `WHERE … deleted_at IS NULL` from `uq_chat_conversations_emotive_claim` in the schema, regenerate **into a scratch file** (do not apply), and confirm the one-thread test would fail — or simpler: delete the whole unique index line, `db:generate`, apply to a scratch DB, run the test, watch it go red, then restore and re-apply. Report which you did.

- [ ] **Step 6: Commit**

```bash
git add packages/db
git commit -m "feat(db): the chat, and one thread per claim"
```

---

### Task 2: The wire

**Files:** create `packages/shared/src/constants/chat.ts`, `packages/shared/src/schemas/chat.schema.ts`; modify `packages/shared/src/index.ts`; create `packages/shared/src/schemas/__tests__/chat.schema.test.ts`.

**Produces:** `ChatConversationType`, `CHAT_MESSAGE_MAX_LENGTH = 4000`, `CHAT_MESSAGES_PAGE_SIZE = 50`, `CHAT_RECOVERY_OVERLAP = 20`, `CHAT_EDIT_WINDOW_MS = 15 * 60_000`, `ChatMessageSchema`, `ChatConversationListItemSchema`, `ChatMessagesPageSchema`, `ChatSendInputSchema`, `ChatMessagesQuerySchema`.

- [ ] **Step 1: Failing schema test**

```ts
it('refuses both cursors at once — a page is either older or newer, never both', () => {
  expect(() => ChatMessagesQuerySchema.parse({ afterSeq: 10, beforeSeq: 20 })).toThrow()
  expect(ChatMessagesQuerySchema.parse({ afterSeq: 10 }).limit).toBe(CHAT_MESSAGES_PAGE_SIZE)
})
it('takes a client id and refuses an empty or oversized body', () => { … })
it('carries seq as a string on the wire', () => {
  // bigint does not survive JSON; the client compares numerically after Number()
  expect(ChatMessageSchema.parse({ ...base, seq: '42' }).seq).toBe('42')
})
```

- [ ] **Step 2: Run, fail, implement, green.** `TZ=UTC pnpm --filter @mr/shared test -- chat.schema`, then `pnpm --filter @mr/shared build`.

- [ ] **Step 3: Commit** — `feat(shared): what a chat message looks like on the wire`

---

### Task 3: Reading — conversations and a page of messages

**Files:** create the seven module files under `apps/api/src/modules/chat/` + `__tests__/chat.integration.test.ts`; modify `apps/api/src/core/container.ts`, `apps/api/src/app.ts`, `apps/api/src/test-helpers/test-app.ts`.

**Interfaces produced:** `GET /api/chat/conversations`, `GET /api/chat/conversations/:id/messages?afterSeq|beforeSeq&limit`.

- [ ] **Step 1: Failing integration tests**

```ts
it('lists the general channel for anyone who may enter the internal app', async () => { … })
it('does not list a claim thread to someone who may not read that claim', async () => {
  // spec §3.3: threads follow the INTERNAL claim-view sets, never view_own_customer
})
it('404s a portal client on a claim thread, and never 403 — existence is not leaked', async () => { … })
it('pages backwards by seq and forwards by seq, and never uses offset', async () => {
  const older = await service.listMessages(conv, { beforeSeq: mid }, ACTOR)
  expect(older.items.map((m) => Number(m.seq))).toEqual([…descending window…])
  expect(older.hasMore).toBe(true)
})
```

- [ ] **Step 2: Run, watch fail, implement**

Repository: one query per read, `WHERE conversation_id = $1 AND deleted_at IS NULL AND seq > $2 ORDER BY seq ASC LIMIT $3` (and the mirror for `beforeSeq` with `DESC` then reverse in TS). Envelope `{ items, nextCursor, hasMore }` — **not** `{items,total,page,pageSize}`: an infinite scroll has no page number and `COUNT(*)` per scroll is waste. Follow `audit-log.repository.ts` for the cursor shape.

Service: resolves the actor's visible conversation set once (general + channels he is a member of + claim threads whose claim he may read), and every read is scoped by it.

Routes: `requirePermissions(...INTERNAL_APP_PERMISSIONS)` on the whole router.

- [ ] **Step 3: Green + mutation proof** — delete the claim-scope condition in the service; the "does not list a claim thread" test must go red. Restore.

- [ ] **Step 4: Commit** — `feat(api): the chat can be read, and only by the people who may read it`

---

### Task 4: Sending — idempotent, and the recovery window

**Files:** modify the chat repository/service/controller/routes; modify `apps/api/src/core/ports/event-bus-port.ts`, `in-process-event-bus.ts`, `postgres-event-bus.ts`, `packages/shared/src/constants/app-events.ts` (+ a new `chat-events.ts`).

- [ ] **Step 1: Failing tests**

```ts
it('accepts the same client id twice and stores one message', async () => {
  const a = await service.send(conv, { clientMsgId: id, body: 'zdravo' }, ACTOR)
  const b = await service.send(conv, { clientMsgId: id, body: 'zdravo' }, ACTOR)
  expect(b.id).toBe(a.id)
  expect((await service.listMessages(conv, {}, ACTOR)).items).toHaveLength(1)
})

it('recovers a message that was committed out of order — the window overlaps on purpose', async () => {
  // Two senders: B commits before A. A reader who saw B's seq must still receive A's.
  // This is the test the overlap exists for; without it the reader loses A forever.
})

it('publishes one signal carrying no message text', async () => {
  expect(bus.published).toEqual([{ kind: 'chat_message_created', conversationId: conv, messageId: expect.any(String) }])
})
```

- [ ] **Step 2: Implement**

Insert `ON CONFLICT (author_id, client_msg_id) DO NOTHING RETURNING *`; empty return → re-select by that key and answer **200** instead of 201. Publish after commit, best-effort in try/catch — like `fanOut()` in the notifications service, which never rejects.

The new event goes in **five places or it silently does nothing**: `event-bus-port.ts`, `in-process-event-bus.ts`, `postgres-event-bus.ts`'s `NotifyMessageSchema`, `packages/shared` app-events union, and the client handler (step 2 of the feature, not here). Write a test that asserts the Postgres bus **validates and replays** the new kind — that is the one that catches a missed place.

- [ ] **Step 3: Green + mutation proof** — remove the `ON CONFLICT` clause; the idempotency test goes red. Then remove the new kind from `NotifyMessageSchema`; the replay test goes red. Restore both.

- [ ] **Step 4: Commit** — `feat(api): sending a message twice sends it once`

---

### Task 5: Unread — one number, from `chat_reads`

**Files:** chat repository/service/controller/routes; `packages/shared/src/schemas/chat.schema.ts`.

- [ ] **Step 1: Failing tests**

```ts
it('counts unread per conversation and sums it, and never counts my own messages', async () => { … })
it('never moves a read marker backwards', async () => {
  await service.markRead(conv, 90, ACTOR)
  await service.markRead(conv, 40, ACTOR)   // a late, out-of-order request
  expect(await service.unreadFor(conv, ACTOR)).toBe(…the count from 90…)
})
it('excludes a muted conversation from the sum but not from its own badge', async () => { … })
```

- [ ] **Step 2: Implement** — `POST /api/chat/conversations/:id/read { lastSeq }`, upsert with **`GREATEST(chat_reads.last_seq, EXCLUDED.last_seq)`**. Unread = `COUNT(*) WHERE seq > last_seq AND author_id <> me AND deleted_at IS NULL`.

- [ ] **Step 3: Green + mutation proof** — replace `GREATEST` with a plain assignment; the backwards test goes red. Restore.

- [ ] **Step 4: Commit** — `feat(api): unread is one number, and it never walks backwards`

---

### Task 6: Claim threads and the port

**Files:** create `apps/api/src/core/ports/chat-port.ts`; modify the chat service (implements it), `container.ts` (inject into both claim services), `emotive-claims.service.ts` / `domace-claims.service.ts` (emit system messages), and their integration tests.

- [ ] **Step 1: Failing tests**

```ts
it('opens the same thread whatever door you come through', async () => {
  const a = await service.threadForClaim(ClaimKind.Emotive, claimId, ACTOR)
  const b = await service.threadForClaim(ClaimKind.Emotive, claimId, ACTOR)
  expect(b.id).toBe(a.id)
})
it('writes a system message when the outcome changes — but only if a thread exists', async () => {
  // spec §5.9: a system event NEVER creates a thread silently
})
it('refuses to open a thread for a claim the actor may not read', async () => { … 404 … })
```

- [ ] **Step 2: Implement** — `ChatPort { postSystemMessage(target, kind, meta): Promise<void> }`, best-effort, never throws into the claim's transaction. Claim services call it after their own commit, beside the existing audit + SSE + notification calls.

- [ ] **Step 3: Green + mutation proof** — make `postSystemMessage` create the thread when missing; the "only if a thread exists" test goes red. Restore.

- [ ] **Step 4: Commit** — `feat(api): a claim has one thread, and the shop's events land in it`

---

### Task 7: Edit, delete, mute, pin, reaction

**Files:** chat repository/service/controller/routes + tests.

- [ ] **Step 1: Failing tests** — edit only my own, only within 15 minutes, sets `editedAt` · delete only my own, soft, body no longer served · mute/unmute · pin capped at 20 per conversation · one reaction per person per message, toggling off removes it.

- [ ] **Step 2: Implement, green, and mutation-prove the edit window** (widen it to Infinity → the "too late" test goes red).

- [ ] **Step 3: Commit** — `feat(api): a message can be corrected, taken back, pinned and ticked`

---

### Task 8: The general channel exists everywhere

**Files:** create `packages/db/src/seed/chat.ts`; modify `run-system-seeds.ts`; modify the seed's integration test.

- [ ] **Step 1: Failing test** — `runSystemSeeds` twice leaves exactly one `type='general'` row; its name is „Opšti kanal"; it is not deletable through the service.

- [ ] **Step 2: Implement** — `seedGeneralChannel(tx)` with `onConflictDoNothing`, added to the transaction **after** roles (no FK need, but keep the file's topological habit). Idempotent, prod-safe.

- [ ] **Step 3: Green.** ⚠ This is a system seed, so **production needs one `db:seed` after deploy** — note it in the handback even though no permission changed.

- [ ] **Step 4: Commit** — `feat(db): every shop starts with one general channel`

---

### Task 9: Full gate and handback

- [ ] **Step 1: The gate** (the Global Constraints block, all of it, green).
- [ ] **Step 2: Update `CLAUDE.md`** — §2 gets the chat invariants (seq is the order key; one thread per claim as two partial unique indexes; the client id makes a retry safe; unread comes from `chat_reads`, the bell only from mentions; chat attachments are their own purpose and never reach the client).
- [ ] **Step 3: Handback** — walk the handoff's §12 checklist and say, item by item, which are done (in step 1 almost none are — they are UI) and which step owns each. **The point of writing it now is that nothing can quietly fall between steps.**
- [ ] **Step 4: Commit and push.**
