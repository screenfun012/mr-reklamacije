# Čet: niti reklamacija i upravljanje kanalima — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ukloniti lažno kreiranje niti na zatvorenim reklamacijama, sačuvati zatvorene niti kao read-only istoriju i omogućiti tvorcu/adminu potpuno, bezbedno upravljanje članovima i brisanjem kanala.

**Architecture:** Postojeći `chat` modul ostaje jedini vlasnik razgovora, poruka, članstva i priloga. Read-only lookup niti i metadata-management kanala dobijaju uske REST ugovore, dok postojeći `chat_message_created` ostaje signal-only događaj; PostgreSQL advisory lock kratko serijalizuje samo send/delete iste konverzacije da hard-delete ne ostavi fajl ili mention red. Frontend koristi TanStack Query ključeve i postojeće komponente, bez globalnog store-a, novog reda poslova ili novih zavisnosti.

**Tech Stack:** TypeScript, Hono, Drizzle/PostgreSQL, React 19, TanStack Query/Router, Zod, Vitest, postojeći `@mr/shared`, `@mr/i18n` i `@mr/ui`.

**Spec:** `docs/superpowers/specs/2026-08-25-cet-niti-i-upravljanje-kanalima-design.md`

## Global Constraints

- Nema migracije, nove dozvole, seeda, dependency-ja, Redis queue-a, worker-a niti novog realtime event tipa.
- Server je sudija: zatvorena reklamacija nikada ne dobija novu nit; zaključana nit odbija send/edit/withdraw/pin/unpin/react/unreact sa 422.
- Zatvorena postojeća nit ostaje dostupna samo kroz reklamaciju, read-only; ne pojavljuje se na glavnoj listi Razgovora ni u dijalogu „Napravi nit“.
- Kanal može da upravlja samo njegov tvorac ili admin; sadržaj kanala uvek zahteva članstvo, čak i adminu i tvorcu.
- Pri kreiranju i naknadnom dodavanju članova svi izabrani nalozi moraju biti aktivni, odobreni, neobrisani i imati najmanje jednu stvarnu `INTERNAL_APP_PERMISSIONS` dozvolu ili admin bypass; nema provere po fiksnom kodu uloge.
- Kreiranje i batch dodavanje su all-or-nothing; maksimalno je 200 prosleđenih `memberIds`, kroz imenovani deljeni ugovor.
- General kanal se ne preimenuje, ne menja mu se roster i ne briše se; claim thread briše samo admin; običan kanal briše tvorac ili admin.
- Hard-delete ostavlja tačno jedan audit red i uklanja DB redove, mention notifikacije i bajtove priloga; create/rename/roster ne pišu audit.
- Svaka channel-metadata promena koristi postojeći `chat_message_created` sa `messageId === conversationId`; obična i claim sistemska poruka koriste stvarni message id.
- Jedan uspešan create/rename/roster/delete zahtev objavljuje najviše jedan signal, posle commita; nikada signal po članu.
- Koristiti postojeće UI/query/storage/audit/notification slojeve; bez paralelnih apstrakcija i bez hardkodovanih uloga, ishoda, dozvola, ruta ili page-size vrednosti po komponentama.
- Svaka promena ponašanja ide RED → GREEN → REFACTOR; produkcioni kod se ne piše pre potvrđenog očekivanog pada testa.

---

### Task 1: Deljeni chat ugovori, query ključevi i precizna invalidacija

**Files:**
- Modify: `packages/shared/src/schemas/chat.schema.ts`
- Modify: `packages/shared/src/schemas/__tests__/chat.schema.test.ts`
- Modify: `packages/shared/src/constants/chat.ts`
- Modify: `packages/shared/src/queries/chat.ts`
- Modify: `packages/shared/src/queries/index.ts`
- Modify: `packages/shared/src/queries/__tests__/chat.test.ts`
- Modify: `packages/shared/src/queries/invalidate-internal-claim-queries.ts`
- Modify: `packages/shared/src/queries/__tests__/invalidate-internal-claim-queries.test.ts`

**Interfaces:**
- Consumes: postojeće `ChatConversationListItemSchema`, `ChatPersonSchema`, `ChatChannelCreateInputSchema`, `ClaimKind`, `ClaimOutcome`, `apiFetch`, `fetchNoContent` i `chatKeys`.
- Produces:

```ts
export const CHAT_CHANNEL_MANAGEMENT_PAGE_SIZE = 50

export type ChatClaimThreadLookup = {
  conversation: ChatConversationListItem | null
  canCreateThread: boolean
}

export type ChatMembersResponse = {
  members: ChatPerson[]
  addable: ChatPerson[]
  canManage: boolean
}

export type ChatChannelManagementQuery = {
  search?: string
  page: number
  pageSize: number
}

export type ChatChannelManagementItem = {
  id: string
  name: string
  creatorName: string | null
  memberCount: number
}

export type ChatChannelManagementListResponse = {
  items: ChatChannelManagementItem[]
  total: number
  page: number
  pageSize: number
}

chatKeys.claimThreads(): readonly unknown[]
chatKeys.claimThread(kind: ClaimKind, claimId: string): readonly unknown[]
chatKeys.channelManagement(): readonly unknown[]
chatKeys.channelManagementList(query: ChatChannelManagementQuery): readonly unknown[]

chatClaimThreadOptions(kind: ClaimKind, claimId: string)
chatChannelManagementOptions(query: ChatChannelManagementQuery)
createChatChannel(input: ChatChannelCreateInput): Promise<ChatConversationListItem>
renameChatChannel(conversationId: string, name: string): Promise<void>
invalidateChatConversationMetadataQueries(
  queryClient: QueryClient,
  conversationId: string,
): void
```

- [ ] **Step 1: Napisati crvene schema testove**

Dodati testove koji parsiraju oba legalna `ChatClaimThreadLookup` oblika, odbijaju response bez `canManage`, ograničavaju management `pageSize` na `1..50`, i prihvataju `creatorName: null`.

```ts
expect(ChatClaimThreadLookupSchema.parse({
  conversation: null,
  canCreateThread: true,
})).toEqual({ conversation: null, canCreateThread: true })

expect(() => ChatChannelManagementQuerySchema.parse({ page: 1, pageSize: 51 }))
  .toThrow()
```

- [ ] **Step 2: Potvrditi očekivani RED za schema testove**

Run: `pnpm --filter @mr/shared exec vitest run src/schemas/__tests__/chat.schema.test.ts`

Expected: FAIL jer novi schema exporti još ne postoje.

- [ ] **Step 3: Dodati minimalne Zod ugovore i imenovani page-size**

`ChatChannelManagementQuerySchema` mora trimovati opcionu pretragu, podrazumevati `page=1` i `pageSize=CHAT_CHANNEL_MANAGEMENT_PAGE_SIZE`, a `ChatChannelCreateInputSchema` ostaje postojeći autoritet za `memberIds` i granicu 200.

- [ ] **Step 4: Napisati crvene query/fetch/invalidation testove**

Dokazati tačan GET i ključ za oba claim parametra, URL-enkodovan management query, create body sa `memberIds`, rename 204, i invalidaciju samo lookup-a čiji `conversation.id` odgovara ID-u.

```ts
expect(chatKeys.claimThread('emotive', claimId)).not.toEqual(
  chatKeys.claimThread('domace', claimId),
)
expect(fetchMock).toHaveBeenCalledWith('/api/chat/channels', {
  method: 'POST',
  body: JSON.stringify({ name: 'Servis', memberIds: [userId] }),
})
```

Claim invalidator za svaki claim event mora poništiti i:

```ts
queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
queryClient.invalidateQueries({
  queryKey: chatKeys.claimThread(payload.kind, payload.id),
})
```

- [ ] **Step 5: Potvrditi očekivani RED za query testove**

Run: `pnpm --filter @mr/shared exec vitest run src/queries/__tests__/chat.test.ts src/queries/__tests__/invalidate-internal-claim-queries.test.ts`

Expected: FAIL zbog nepostojećih ključeva/fetchera i starih create/rename ugovora.

- [ ] **Step 6: Implementirati minimalni query sloj**

GET lookup parsira `ChatClaimThreadLookupSchema`; management serializuje samo normalizovane `search/page/pageSize`; rename koristi `fetchNoContent`. Metadata invalidator poništava conversations, members, people i management, zatim prolazi samo keširane `claimThreads()` upite i poništava one čiji je parsirani `conversation.id === conversationId`.

- [ ] **Step 7: Pokrenuti fokusirane testove i typecheck**

Run:

```bash
pnpm --filter @mr/shared exec vitest run \
  src/schemas/__tests__/chat.schema.test.ts \
  src/queries/__tests__/chat.test.ts \
  src/queries/__tests__/invalidate-internal-claim-queries.test.ts
pnpm --filter @mr/shared typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/schemas/chat.schema.ts \
  packages/shared/src/schemas/__tests__/chat.schema.test.ts \
  packages/shared/src/constants/chat.ts \
  packages/shared/src/queries/chat.ts \
  packages/shared/src/queries/index.ts \
  packages/shared/src/queries/__tests__/chat.test.ts \
  packages/shared/src/queries/invalidate-internal-claim-queries.ts \
  packages/shared/src/queries/__tests__/invalidate-internal-claim-queries.test.ts
git commit -m "feat(chat): define thread and channel management contracts"
```

### Task 2: Pending-only claim thread API i zaključane mutacije

**Files:**
- Modify: `packages/shared/src/queries/chat.ts` (correct the Task 1 management GET URL to the binding spec)
- Modify: `packages/shared/src/queries/__tests__/chat.test.ts`
- Modify: `apps/api/src/modules/chat/chat.validators.ts`
- Modify: `apps/api/src/modules/chat/chat.repository.ts`
- Modify: `apps/api/src/modules/chat/chat.service.ts`
- Modify: `apps/api/src/modules/chat/chat.controller.ts`
- Modify: `apps/api/src/modules/chat/chat.routes.ts`
- Modify: `apps/api/src/modules/chat/__tests__/chat-claim-threads.integration.test.ts`
- Modify: `apps/api/src/modules/chat/__tests__/chat-attachments.integration.test.ts`

**Interfaces:**
- Consumes: Task 1 `ChatClaimThreadLookup`; postojeći `ChatClaimThreadParamSchema`, claim partial-unique indeksi, `ChatSystemKind.ThreadCreated`, `requireOpen` i chat signal.
- Produces:

```ts
findThreadForClaim(
  kind: ClaimKind,
  claimId: string,
  actor: ChatActor,
): Promise<ChatClaimThreadLookup>

type ChatClaimThreadOpenResult =
  | { status: 'not_found' }
  | { status: 'closed' }
  | { status: 'opened'; created: false; conversationId: string; messageId: null }
  | { status: 'opened'; created: true; conversationId: string; messageId: string }

GET /api/chat/claims/:kind/:id/thread
POST /api/chat/claims/:kind/:id/thread
```

- [ ] **Step 1: Napisati crvene read-lookup integracione testove**

Pokriti pending bez niti (`null/true`, bez upisa/eventa), sva tri zatvorena ishoda bez niti (`null/false`), zatvorenu postojeću nit (`isLocked=true`), i 404 za nedostupnu, nepostojeću ili soft-deleted reklamaciju.

- [ ] **Step 2: Potvrditi očekivani RED za GET**

Run: `TZ=UTC pnpm --filter api test:integration -- src/modules/chat/__tests__/chat-claim-threads.integration.test.ts`

Expected: FAIL sa 404/route-not-found jer GET ruta još ne postoji.

- [ ] **Step 3: Implementirati čisti GET**

Repository dobija `findClaimOutcome(kind,id)` i `findVisibleClaimThread(kind,id,scope)`. Service prvo proverava odgovarajući INTERNAL claim-read scope; ako nit postoji vraća je sa `canCreateThread:false`, inače vraća `canCreateThread: outcome === 'pending'`. GET ne poziva insert, audit ni event.

- [ ] **Step 4: Napisati crvene atomic-create i race testove**

Pokriti 422 za zatvorenu reklamaciju sa i bez postojeće niti; konkurentna dva POST-a moraju dati `[200,201]`, jednu nit i jednu `thread_created` poruku. Deterministički close-vs-create test koristi dve committed konekcije: update drži claim row lock, POST počinje, update commit-uje zatvaranje, POST vraća 422 i ne upisuje ništa.

- [ ] **Step 5: Potvrditi očekivani RED za atomic create**

Run: `TZ=UTC pnpm --filter api test:integration -- src/modules/chat/__tests__/chat-claim-threads.integration.test.ts`

Expected: FAIL jer trenutni POST otvara zatvorenu nit i system message piše van transakcije.

- [ ] **Step 6: Implementirati jedan transactional open**

U `this.db.transaction`:

```ts
const [claim] = await tx.select({ outcome: claimTable.outcome })
  .from(claimTable)
  .where(and(eq(claimTable.id, claimId), isNull(claimTable.deletedAt)))
  .for('update')

if (!claim) return { status: 'not_found' }
if (claim.outcome !== ClaimOutcome.Pending) return { status: 'closed' }
```

Zatim insert conversation sa postojećim conflict pravilom; samo stvarni insert u istoj transakciji piše tačno jednu `thread_created` poruku. Service mapira `not_found→404`, `closed→422`, postojeću `→200`, novu `→201`, a signal šalje tek posle commita i samo za nov `messageId`.

- [ ] **Step 7: Napisati crvenu locked-action matricu**

Na zatvorenoj postojećoj niti send/edit/withdraw/pin/unpin/react/unreact moraju vratiti 422 i ostaviti stanje nepromenjeno; read/download/mark-read/mute/unmute ostaju uspešni; ponovno postavljanje outcome-a na pending automatski otključava istu nit.
Poseban assertion potvrđuje da claim servis i dalje može da upiše outcome sistemsku poruku u zatvorenu postojeću nit.

- [ ] **Step 8: Implementirati nedostajuće `requireOpen` pozive**

Pozvati `requireOpen(conversation)` odmah posle visibility resolution u `deleteMessage`, `pin`, `unpin`, `react`, `unreact`. Ne dodavati ga u read, attachment, mark-read, mute ili claim-system-message putanje.

- [ ] **Step 9: Pokrenuti fokusirane API provere**

Run:

```bash
TZ=UTC pnpm --filter api test:integration -- \
  src/modules/chat/__tests__/chat-claim-threads.integration.test.ts \
  src/modules/chat/__tests__/chat-attachments.integration.test.ts
pnpm --filter api typecheck
pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/chat
git commit -m "fix(chat): enforce pending claim threads"
```

### Task 3: Claim detail istorija, MR prečice i create-race frontend

**Files:**
- Modify: `apps/internal-web/src/features/chat/new-thread-dialog.tsx`
- Modify: `apps/internal-web/src/features/chat/open-claim-thread.tsx`
- Modify: `apps/internal-web/src/features/chat/claim-conversation-tab.tsx`
- Modify: `apps/internal-web/src/features/chat/composer-mr-suggestion.tsx`
- Modify: `apps/internal-web/src/features/chat/composer.tsx`
- Modify: `apps/internal-web/src/features/chat/conversation-pane.tsx`
- Modify: `apps/internal-web/src/features/chat/new-channel-dialog.tsx` (compile-only create-contract adapter pulled forward from Task 6)
- Create: `apps/internal-web/src/features/chat/__tests__/new-channel-dialog.test.tsx` (exact empty-member body regression; Task 6 extends it)
- Modify: `apps/internal-web/src/features/emotive-claims/detail/emotive-claim-detail.tsx`
- Modify: `apps/internal-web/src/features/domace-claims/detail/domace-claim-detail.tsx`
- Modify: `apps/internal-web/src/routes/_shell/razgovori.tsx`
- Modify: `apps/internal-web/src/features/chat/__tests__/new-thread-dialog.test.tsx`
- Modify: `apps/internal-web/src/features/chat/__tests__/open-claim-thread.test.tsx`
- Modify: `apps/internal-web/src/features/chat/__tests__/claim-conversation-tab.test.tsx`
- Modify: `apps/internal-web/src/features/chat/__tests__/claim-detail-conversation-tab.test.tsx`
- Modify: `apps/internal-web/src/features/chat/__tests__/composer-mr-suggestion.test.tsx`
- Modify: `apps/internal-web/src/features/chat/__tests__/message-body.test.tsx`
- Modify: `apps/internal-web/src/features/chat/__tests__/conversation-pane.test.tsx`
- Modify: `packages/i18n/src/messages/sr.json`
- Modify: `packages/i18n/src/messages/en.json`

**Interfaces:**
- Consumes: Task 1 `chatClaimThreadOptions` i keys; Task 2 GET/POST semantics; postojeći immutable MR registry `{kind, claimId}`.
- Produces:

```ts
useClaimThread(kind: ClaimKind, claimId: string, outcome: ClaimOutcome): {
  thread: ChatConversationListItem | null
  isPending: boolean
  canCreateThread: boolean
}

useCreateClaimThread({
  onOpened: (conversationId: string) => void
  onClosed: (claim: MrRegistryExistingClaim) => void
})

useResolveClaimThread({ onActive, onMissing, onClosed })
```

- [ ] **Step 1: Napisati crvene pending-dialog i claim-tab testove**

Dokazati da list URL nosi `outcome=pending`, zatvoreni fixture-i nisu ponuđeni, pending detail čita aktivnu conversation listu, a accepted/rejected/archived detail koristi tačan GET lookup. Pokriti zatvorenu nit kao vidljivu istoriju bez create dugmeta i zatvorenu bez niti kao mirno prazno stanje.

- [ ] **Step 2: Potvrditi očekivani RED**

Run: `TZ=UTC pnpm --filter internal-web test -- src/features/chat/__tests__/new-thread-dialog.test.tsx src/features/chat/__tests__/claim-conversation-tab.test.tsx src/features/chat/__tests__/claim-detail-conversation-tab.test.tsx`

Expected: FAIL jer trenutni UI ne filtrira outcome i oslanja se samo na aktivnu listu.

- [ ] **Step 3: Implementirati hibridni claim-tab tok**

Proslediti stvarni `claim.outcome` iz oba odvojena detail ekrana. Pending koristi aktivnu listu; ostali ishodi koriste lookup. Ne uvoditi zajednički ClaimDetail niti grananje po shape-u.

- [ ] **Step 4: Napisati crvene create-race i MR testove**

Dokazati redosled `POST → fresh conversations GET → navigation`; ako se nit zatvori posle 201, fetch lookup vodi na claim detail `tab=razgovor`; ako je obrisana, prikazuje unavailable bez pada na General. 422 nema success toast/callback. Composer query-je samo poslednji MR, ne crta zeleni create za closed, a poslati closed MR chip na klik vodi na claim detail bez POST-a.

- [ ] **Step 5: Implementirati resolver i precizne MR putanje**

Posle POST-a markirati exact lookup stale bez refetcha, force-fetchovati aktivnu listu, pa tek onda navigirati. Ako returned ID nije aktivan, force-fetchovati lookup i birati closed/unavailable granu. Sent chip radi lookup tek na stvarni klik; composer radi lookup samo za `lastWrittenClaim`.

- [ ] **Step 6: Napisati crven locked-pane test i sakriti mutacije**

Locked pane nema textbox, reply, react, pin/unpin handler niti njihove HTTP pozive, ali i dalje crta poruke, pinned read prikaz i download.

```tsx
onReply={isLocked ? undefined : setReplyTo}
onReact={isLocked ? undefined : handleReact}
onPin={isLocked ? undefined : handlePin}
```

- [ ] **Step 7: Dodati minimalan thread copy u oba jezika**

Dodati ključeve `chat_thread_closed_empty_title`, `chat_thread_closed_create_error`, `chat_thread_opened_toast`, `chat_thread_saved_closed_toast` i `chat_thread_unavailable_toast`, pa pokrenuti `pnpm --filter @mr/i18n build` pre typecheck-a. Ne hardkodovati tekst u komponentama.

Pre finalnog typecheck-a napisati jedan crveni test da postojeći name-only channel modal šalje novi deljeni oblik `{ name, memberIds: [] }`, pa promeniti samo taj call site. Picker, people query i selection ostaju u Task 6.

- [ ] **Step 8: Pokrenuti fokusirane frontend testove**

Run:

```bash
TZ=UTC pnpm --filter internal-web test -- \
  src/features/chat/__tests__/new-thread-dialog.test.tsx \
  src/features/chat/__tests__/open-claim-thread.test.tsx \
  src/features/chat/__tests__/claim-conversation-tab.test.tsx \
  src/features/chat/__tests__/claim-detail-conversation-tab.test.tsx \
  src/features/chat/__tests__/composer-mr-suggestion.test.tsx \
  src/features/chat/__tests__/message-body.test.tsx \
  src/features/chat/__tests__/conversation-pane.test.tsx
pnpm --filter internal-web typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/internal-web/src/features/chat \
  apps/internal-web/src/features/emotive-claims/detail/emotive-claim-detail.tsx \
  apps/internal-web/src/features/domace-claims/detail/domace-claim-detail.tsx \
  apps/internal-web/src/routes/_shell/razgovori.tsx \
  packages/i18n/src/messages/sr.json packages/i18n/src/messages/en.json
git commit -m "fix(chat): preserve closed claim thread history"
```

### Task 4: Atomic channel create, stvarna eligibility pravila i metadata management API

**Files:**
- Modify: `apps/api/src/modules/chat/chat.validators.ts`
- Modify: `apps/api/src/modules/chat/chat.repository.ts`
- Modify: `apps/api/src/modules/chat/chat.service.ts`
- Modify: `apps/api/src/modules/chat/chat.controller.ts`
- Modify: `apps/api/src/modules/chat/chat.routes.ts`
- Modify: `apps/api/src/modules/chat/__tests__/chat-channels.integration.test.ts`

**Interfaces:**
- Consumes: Task 1 create/management/member ugovore, `INTERNAL_APP_PERMISSIONS`, postojeći admin bypass i `ChatSystemKind.ChannelCreated`.
- Produces:

```ts
ChatRepository.createChannel(
  input: ChatChannelCreateInput,
  createdBy: string,
): Promise<{ conversationId: string; systemMessageId: string }>

ChatService.createChannel(
  input: ChatChannelCreateInput,
  actor: ChatActor,
): Promise<ChatConversationListItem>

ChatRepository.listManagedChannels(
  actorId: string,
  isAdmin: boolean,
  query: ChatChannelManagementQuery,
): Promise<ChatChannelManagementListResponse>

GET /api/chat/channels/manage
PATCH /api/chat/conversations/:id // 204
GET /api/chat/conversations/:id/members // { members, addable, canManage }
POST /api/chat/conversations/:id/members // all-or-nothing
```

- [ ] **Step 1: Napisati crvene atomic-create/eligibility testove**

Create sa dva validna izabrana člana daje creator+2, tačno jednu `channel_created` poruku i jedan signal `{conversationId:id,messageId:id}`. Duplikati/creator u `memberIds` ne dupliraju red. Inactive, deleted, portal-only i custom role bez interne dozvole daju 422 i nula conversation/member/message redova; custom role sa jednom dozvolom iz `INTERNAL_APP_PERMISSIONS` prolazi.

- [ ] **Step 2: Potvrditi očekivani RED**

Run: `TZ=UTC pnpm --filter api test:integration -- src/modules/chat/__tests__/chat-channels.integration.test.ts`

Expected: FAIL jer API trenutno prima samo name, nema atomic member validation i ne piše creation system message.

- [ ] **Step 3: Implementirati jedan reusable eligibility predikat i transactional create**

SQL pomoćnik mora zahtevati live/approved/not-deleted user, live role, i `(role.code='admin' OR role_permissions.permission_id IN INTERNAL_APP_PERMISSIONS)`. Isti pomoćnik koristiti za General `/people`, create validaciju, `listAddableUsers` i later-add. U transakciji: insert channel, dedupe+validate ceo skup, insert creator+members, insert jednu system poruku; tek zatim service `announce(id,id)`.

- [ ] **Step 4: Napisati crvene roster/management/visibility testove**

Pokriti `canManage` creator/admin vs member; ordinary member dobija `addable:[]`; mixed valid+invalid batch rollback; departed creator i nonmember admin upravljaju metapodacima ali messages/files su 404; legacy empty channel sa istorijom nije u običnoj listi niti sadržajno vidljiv dok se manager eksplicitno ne self-add; General mutations su 422.

Management GET testira creator-only scope, admin-all, search, deterministic page max 50, memberCount i `creatorName:null` za ugašen nalog. Metadata tok ne poziva message/file repo putanje.

- [ ] **Step 5: Implementirati metadata guard i management query**

Guard prvo traži manageable channel po `createdBy`/admin bez membership-a. Ako nije manageable, proverava ordinary visibility da vrati 403 vidljivom tuđem članu ili 404 nevidljivom. General/claim metadata mutation daje 422. Ukloniti admin-empty-channel iz `visibleConversationCondition`; content read ostaje striktno membership-only.

- [ ] **Step 6: Uskladiti HTTP ugovore i signale**

Prvo crvenim shared query testom ispraviti management fetch na jedinu dokumentovanu rutu `/api/chat/channels/manage?...`; ne dodavati alias za raniji Task 1 URL. Controller parsira deljeni `ChatChannelCreateInputSchema`, dodaje `GET /channels/manage`, a postojeća rename ruta `/conversations/:id` vraća `c.body(null,204)`. Create/rename/uspešan add/remove šalju tačno jedan `announce(conversationId,conversationId)` posle uspešne DB operacije. Create/rename/roster ne auditiraju.

- [ ] **Step 7: Pokrenuti fokusirane API testove**

Run:

```bash
TZ=UTC pnpm --filter api test:integration -- src/modules/chat/__tests__/chat-channels.integration.test.ts
pnpm --filter api typecheck
pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/chat
git commit -m "feat(chat): add secure channel membership management"
```

### Task 5: Replica-safe send/delete fence i vlasničko brisanje kanala

**Files:**
- Create: `apps/api/src/modules/chat/chat-conversation-fence.ts`
- Create: `apps/api/src/modules/chat/__tests__/chat-send-delete-race.integration.test.ts`
- Modify: `apps/api/src/modules/chat/index.ts`
- Modify: `apps/api/src/core/container.ts`
- Modify: `apps/api/src/core/ports/audit-port.ts`
- Modify: `apps/api/src/core/ports/notifications-port.ts`
- Modify: `apps/api/src/modules/audit/audit.service.ts`
- Modify: `apps/api/src/modules/notifications/notifications.schema.ts`
- Modify: `apps/api/src/modules/notifications/notifications.repository.ts`
- Modify: `apps/api/src/modules/notifications/notifications.service.ts`
- Modify: `apps/api/src/modules/chat/chat-attachments.service.ts`
- Modify: `apps/api/src/modules/chat/chat.repository.ts`
- Modify: `apps/api/src/modules/chat/chat.service.ts`
- Modify: `apps/api/src/modules/chat/__tests__/chat-channels.integration.test.ts`
- Modify: `apps/api/src/modules/chat/__tests__/chat-attachments.integration.test.ts`
- Modify: `apps/api/src/modules/chat/__tests__/chat-mention-notifications.integration.test.ts`
- Modify: `apps/api/src/test-helpers/test-app.ts`

**Interfaces:**
- Consumes: Task 4 metadata guard/delete rules; postojeći `Pool`, `ApiDatabase`, Drizzle schema, storage, audit i notification servisi.
- Produces:

```ts
export interface ChatConversationFence {
  shared<T>(conversationId: string, work: (db: ApiDatabase) => Promise<T>): Promise<T>
  exclusive<T>(conversationId: string, work: (db: ApiDatabase) => Promise<T>): Promise<T>
}

export class PostgresChatConversationFence implements ChatConversationFence

audit.log(entry, executor?: ApiDatabase): Promise<void>
notifications.notifyChatMention(input, executor?: ApiDatabase): Promise<void>
notifications.dropForChatConversation(
  conversationId: string,
  executor?: ApiDatabase,
): Promise<void>
```

- [ ] **Step 1: Napisati crveni authorization/delete cleanup test**

Pokriti creator delete, drugi creator 403, nevidljivi nonmember 404, nonmember admin delete, General 422 i claim thread admin-only. Uspešan delete piše tačno jedan audit sa stvarnim `messagesErased`, briše mention notifikacije jednim conversation-scoped upitom, briše attachment redove/bajtove i šalje jedan `{id,id}` signal.

- [ ] **Step 2: Napisati crveni deterministički race test**

Committed fixture i dve leased konekcije koriste blocking storage: send stane pošto je fizički upload upisan dok shared lock traje; delete počne i mora čekati advisory lock; po puštanju send-a delete završava i ostavlja nula conversation/message/attachment/notification redova, nula original/thumbnail fajlova, jedan tačan audit, a novi send dobija 404.

- [ ] **Step 3: Potvrditi očekivani RED**

Run:

```bash
TZ=UTC pnpm --filter api test:integration -- \
  src/modules/chat/__tests__/chat-send-delete-race.integration.test.ts \
  src/modules/chat/__tests__/chat-channels.integration.test.ts
```

Expected: FAIL jer trenutni delete snapshotuje message IDs pre konkurentnog send-a i kanal briše samo admin.

- [ ] **Step 4: Implementirati mali PostgreSQL fence**

`PostgresChatConversationFence` radi `pool.connect()`, parametrizovani `pg_advisory_lock_shared(hashtextextended($1::text,0))` ili exclusive lock, `drizzle(client,{schema})` za callback, odgovarajući unlock i release u `finally`. Unlock failure mora izbaciti problematičnu konekciju umesto vraćanja u pool. Nema polling-a, reda čekanja ili nove biblioteke.

- [ ] **Step 5: Provlačiti isti leased executor kroz fenced putanju**

Shared send unutar callback-a koristi scoped `ChatRepository` za visibility/open, message insert/read, attachment DB write/storage, mention recipients i notification insert; signal/push može posle unlock-a. Ne držati pool konekciju pa iz callback-a uzimati drugu. Audit/notifications/storage metode primaju opcioni executor/scoped repository, uz postojeći executor kao default za sve druge callere.

- [ ] **Step 6: Implementirati exclusive delete**

Unutar exclusive callback-a ponoviti authorization sa scoped repo, `COUNT(*)`, conversation-scoped notification delete, čitanje i erase storage putanja, hard delete, pa audit kroz isti executor. Posle unlock-a objaviti jedan signal. Ukloniti neograničeni `listMessageIds`/`IN (...ids)` cleanup ako nema drugog callera.

- [ ] **Step 7: Obezbediti test executor bez lažne cross-connection vidljivosti**

Standardni transaction-isolated integration test app dobija passthrough `ChatConversationFence` nad `ctx.db`; samo committed race suite konstruiše pravi `PostgresChatConversationFence`. Tako obični testovi ne pokušavaju da vide fixture kroz drugu konekciju.

- [ ] **Step 8: Pokrenuti susedne API suite-ove**

Run:

```bash
TZ=UTC pnpm --filter api test:integration -- \
  src/modules/chat/__tests__/chat-send-delete-race.integration.test.ts \
  src/modules/chat/__tests__/chat-channels.integration.test.ts \
  src/modules/chat/__tests__/chat-attachments.integration.test.ts \
  src/modules/chat/__tests__/chat-mention-notifications.integration.test.ts
pnpm --filter api typecheck
pnpm --filter api depcruise
```

Expected: PASS, bez orphan redova/fajlova i bez dependency-cycle-a.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/chat apps/api/src/modules/notifications \
  apps/api/src/modules/audit/audit.service.ts \
  apps/api/src/core/container.ts apps/api/src/core/ports \
  apps/api/src/test-helpers/test-app.ts
git commit -m "fix(chat): serialize sends with conversation deletion"
```

### Task 6: Kreiranje kanala sa članovima

**Files:**
- Modify: `apps/internal-web/src/features/chat/new-channel-dialog.tsx`
- Modify: `apps/internal-web/src/features/chat/__tests__/new-channel-dialog.test.tsx`
- Modify: `apps/internal-web/src/routes/_shell/razgovori.tsx`

**Interfaces:**
- Consumes: Task 1 `createChatChannel({name,memberIds})`, `chatPeopleOptions`; Task 4 validaciju; postojeći General conversation i signed-in user ID.
- Produces:

```ts
type NewChannelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  generalConversationId: string | null
  currentUserId: string
}
```

- [ ] **Step 1: Napisati crveni picker test**

Proširiti postojeći exact-empty-body regression i dokazati: dok je modal zatvoren nema people GET-a; otvaranje koristi `/api/chat/conversations/:generalId/people`; creator nije ponuđen; lokalna pretraga ne šalje dodatni request; izbor dva naloga šalje jedan POST `{name,memberIds:[...]}`; 422 ostavlja modal i izbor otvorene; close/success resetuju name/search/selection.

- [ ] **Step 2: Potvrditi očekivani RED**

Run: `TZ=UTC pnpm --filter internal-web test -- src/features/chat/__tests__/new-channel-dialog.test.tsx`

Expected: FAIL jer trenutni dijalog ima samo ime i nema new test behavior.

- [ ] **Step 3: Implementirati native search/checkbox picker**

Koristiti postojeće input/checkbox/scroll komponente, `enabled: open && generalConversationId !== null`, lokalni filter i jedan mutation. Ne dodavati combobox biblioteku. Iznad potvrde prikazati upozorenje da novi član vidi celu dotadašnju istoriju.

- [ ] **Step 4: Povezati General ID i current user iz rute**

`razgovori.tsx` prosleđuje postojeći General conversation ID i session user ID; mutation success invalidira conversations i management preko Task 1 helpera.

- [ ] **Step 5: Pokrenuti test/typecheck i commit**

Run:

```bash
TZ=UTC pnpm --filter internal-web test -- src/features/chat/__tests__/new-channel-dialog.test.tsx
pnpm --filter internal-web typecheck
```

Expected: PASS.

```bash
git add apps/internal-web/src/features/chat/new-channel-dialog.tsx \
  apps/internal-web/src/features/chat/__tests__/new-channel-dialog.test.tsx \
  apps/internal-web/src/routes/_shell/razgovori.tsx
git commit -m "feat(chat): choose members when creating channels"
```

### Task 7: Roster editor, management modal, delete UI, realtime i copy

**Files:**
- Create: `apps/internal-web/src/features/chat/channel-members-editor.tsx`
- Create: `apps/internal-web/src/features/chat/channel-management-dialog.tsx`
- Create: `apps/internal-web/src/features/chat/__tests__/channel-management-dialog.test.tsx`
- Modify: `apps/internal-web/src/features/chat/channel-panel.tsx`
- Modify: `apps/internal-web/src/features/chat/conversation-list.tsx`
- Modify: `apps/internal-web/src/routes/_shell/razgovori.tsx`
- Modify: `apps/internal-web/src/features/chat/__tests__/channel-panel.test.tsx`
- Modify: `apps/internal-web/src/features/chat/__tests__/conversation-list.test.tsx`
- Modify: `apps/internal-web/src/lib/handle-app-event.ts`
- Modify: `apps/internal-web/src/lib/__tests__/handle-app-event.test.ts`
- Modify: `packages/i18n/src/messages/sr.json`
- Modify: `packages/i18n/src/messages/en.json`

**Interfaces:**
- Consumes: Task 1 members/management query/helper; Task 4 `canManage` i metadata API; Task 5 delete; postojeći `ConfirmDialog` i i18n action/pagination ključevi.
- Produces: jedan reusable `ChannelMembersEditor`, lazy `ChannelManagementDialog` i equality-based metadata event invalidacija.

- [ ] **Step 1: Napisati crvene panel/editor testove**

Običan član vidi roster bez add/remove; manager vidi kontrole; niko nema ✕ uz sebe; later-add se šalje tek posle istorija-confirm; self leave ostaje poseban confirm; manager delete je destruktivni confirm. Ukloniti admin-empty-channel notice očekivanje.

- [ ] **Step 2: Implementirati jedini roster editor**

`ChannelMembersEditor` poseduje add/remove mutations i Task 1 metadata invalidator. `ChannelPanel` samo učitava response, crta editor, self-leave i delete prema `canManage`; ne prima `isAdmin` i ne duplira permission logiku.

- [ ] **Step 3: Napisati crvene management modal/list testove**

Modal ne fetchuje dok je zatvoren; search debounce je 300 ms i vraća page na 1; page size koristi samo `CHAT_CHANNEL_MANAGEMENT_PAGE_SIZE`; lista crta name, `creatorName ?? localized disabled account`, memberCount; roster se učitava tek izborom jednog reda (bez N+1); rename šalje PATCH 204; delete ide kroz confirm; creator/admin van membership-a može self-add; metadata tok ne traži messages/pins/attachments.
Route test dodatno dokazuje da brisanje trenutno izabranog kanala bira General i čisti matching cache, dok brisanje drugog reda ne menja trenutni razgovor.

- [ ] **Step 4: Implementirati lazy management UI bez dupliranja**

`ConversationList` dobija `onManageChannels` dugme uz sekciju Kanali. Ruta montira jedan modal i prosleđuje selected ID. Isti editor se koristi u panelu i modalu. Postojeći header trash ostaje samo admin+claim-thread; channel delete živi u panel/modal toku.
Posle uspešnog brisanja trenutno izabranog kanala ruta prvo poništava metadata/matching claim lookup ključeve, pa bira postojeći General kanal; nikada ne ostavlja obrisani ID selektovan niti ga tiho zamenjuje pogrešnom niti reklamacije.

- [ ] **Step 5: Napisati crvene realtime invalidation testove**

Za `{conversationId:'c1',messageId:'c1'}` poništiti conversations/messages/pins/attachments plus members/people/management i samo cached claim lookup čiji conversation ID odgovara. Za običnu poruku `{conversationId:'c1',messageId:'m1'}` ne dirati metadata/claim lookup ključeve.

- [ ] **Step 6: Implementirati equality branch**

Postojeće invalidacije uvek ostaju. Samo `messageId === conversationId` poziva `invalidateChatConversationMetadataQueries(queryClient, conversationId)`. Ne menjati event schema, SSE parser ili `HANDLED_EVENT_TYPES`.

- [ ] **Step 7: Dodati minimalan sr/en copy i ukloniti mrtav tekst**

Dodati ključeve za channel history warning/search/manage/creator/disabled-account/member-count/delete. Ponovo koristiti postojeće `action_*`, erase i pagination ključeve. `chat_erase_description` mora eksplicitno reći da nestaju poruke i prilozi bez vraćanja; ukloniti zastareli „stiže uskoro“/empty-admin copy kada više nema callera. Thread copy je već uveden uz Task 3 komponente koje ga koriste.

- [ ] **Step 8: Pokrenuti i18n i fokusirane frontend provere**

Run:

```bash
pnpm --filter @mr/i18n build
TZ=UTC pnpm --filter internal-web test -- \
  src/features/chat/__tests__/channel-panel.test.tsx \
  src/features/chat/__tests__/channel-management-dialog.test.tsx \
  src/features/chat/__tests__/conversation-list.test.tsx \
  src/lib/__tests__/handle-app-event.test.ts
pnpm --filter internal-web typecheck
pnpm --filter internal-web lint
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/internal-web/src/features/chat apps/internal-web/src/lib \
  apps/internal-web/src/routes/_shell/razgovori.tsx \
  packages/i18n/src/messages/sr.json packages/i18n/src/messages/en.json
git commit -m "feat(chat): manage channel members and deletion"
```

### Task 8: Dokumentacija, puna kapija i završni pregled

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-08-25-cet-niti-i-upravljanje-kanalima-design.md` only if implementation forced a documented ruling
- Test: all touched shared/API/internal-web suites and full repository gate

**Interfaces:**
- Consumes: Tasks 1–7 final behavior.
- Produces: repo-level invariant that prevents later reintroduction of closed-thread creation, admin content bypass, hardcoded role eligibility or unsafe delete.

- [ ] **Step 1: Dopuniti binding repo kontekst bez prepisivanja specifikacije**

U chat invariant dodati sažetak: pending-only create, closed lookup/read-only history, creator/admin metadata vs membership-only content, actual internal-permission eligibility, `messageId===conversationId` metadata token, and advisory send/delete fence. `AGENTS.md` i `CLAUDE.md` moraju ostati sadržajno identični.

- [ ] **Step 2: Pokrenuti format/diff provere**

Run:

```bash
pnpm format
pnpm format:check
git diff --check
```

Expected: PASS i bez whitespace grešaka.

- [ ] **Step 3: Pokrenuti kompletnu build/typecheck/lint/test kapiju**

Run:

```bash
TZ=UTC pnpm exec turbo run build typecheck lint --force --concurrency=2
TZ=UTC pnpm exec turbo run test --force --concurrency=1
pnpm --filter api depcruise
TZ=UTC pnpm test:integration
```

Expected: svi paketi i integracioni testovi PASS. Ne pokretati niti zaustavljati `pnpm dev:all`.

- [ ] **Step 4: Pregledati veličinu i granice rešenja**

Run:

```bash
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
rg -n "role.*client|client.*role|new Queue|BullMQ|Redis" \
  apps/api/src/modules/chat apps/internal-web/src/features/chat packages/shared/src/queries/chat.ts
```

Expected: nema novog role-code eligibility hardkoda, queue/worker/dependency-ja ili duplog roster editora; svaka nova datoteka ima jednu odgovornost.

- [ ] **Step 5: Commit dokumentaciju**

```bash
git add AGENTS.md CLAUDE.md docs/superpowers/specs/2026-08-25-cet-niti-i-upravljanje-kanalima-design.md
git commit -m "docs(chat): record thread and channel invariants"
```

- [ ] **Step 6: Zatražiti završni whole-branch review**

Reviewer mora proveriti specifikaciju, bezbednosne granice, race test, trošak po normalnom zahtevu, invalidation fanout i odsustvo AI-slop apstrakcija. Sve Critical/Important nalaze popraviti u jednoj završnoj fix turi, zatim ponoviti scoped review.
