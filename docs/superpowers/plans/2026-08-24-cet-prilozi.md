# Čet — prilozi, kamera i uži ekran: plan izrade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spajalica i kamera u četu prestaju da budu mrtve — fotografija ili PDF putuje na samoj
poruci, ostaje interna, i čet radi na tabletu.

**Architecture:** Prilog je red u postojećoj tabeli `attachments` sa novom svrhom
`chat_attachment` i novom vezom `chat_message_id`. Slanje ide kroz **postojeći** endpoint poruke,
koji sad prima i `multipart`, pa idempotencija po `client_msg_id` pokriva i fajlove. Serviranje ide
kroz **sopstvenu rutu čet modula**, jer `/api/attachments/*` traži dozvolu koja otvara fajlove svake
reklamacije. Nema novog SSE tipa — prilog putuje na poruci koju postojeći signal već osvežava.

**Tech Stack:** Hono + Drizzle + PostgreSQL · TanStack Start (React 19) · Zod · Paraglide · Vitest.

**Spec:** `docs/superpowers/specs/2026-08-24-cet-prilozi-design.md` — čita se **pre** prvog zadatka.
Njegov §16 nabraja 12 tvrdnji koje su bile pogrešne; **ne vraćati ih.**

---

## Global Constraints

- **Nema nove dozvole.** Kapija ostaje `INTERNAL_APP_PERMISSIONS`. Posle deploja **ne treba `db:seed`**.
- **404, nikad 403** za sve što čovek ne sme da vidi.
- **Svrha se filtrira POTVRDNO** (`eq(purpose, X)`), nikad `!=`.
- **`AttachmentsRepository.findById` se NE dira** — servira slike TipTap izveštaja (spec §10).
- **Dozvoljeni tipovi u četu:** `ALLOWED_IMAGE_MIME_TYPES` + `application/pdf`. Ništa drugo.
- **Granice:** ≤ 5 fajlova po poruci, ≤ 25 MB po fajlu (`MAX_FILE_SIZE_MB`), bez kvote po razgovoru.
- **Nema novog SSE tipa.**
- **Bez ICU množine** u i18n; sr + en parity je obavezan; nov ključ traži `pnpm --filter @mr/i18n run build`
  pre `typecheck`-a (`compile` je dovoljan samo za dev).
- **Boje samo kroz `mri-*` utility klase.** `var(--mri-warn|ok|bad|info|domace)` se **ne razrešava** u
  internal-web — koristi `stroke-mri-warn` / `text-mri-bad` i slično.
- **Container query mora imati IME** (`@container/chat`), nikad `lg:`, nikad merenje širine u JS-u.
- **Pun gejt zelen pre svakog komita**, sa `TZ=UTC` i podeljenim prolazima:

```bash
pnpm format:check \
  && TZ=UTC pnpm exec turbo run build typecheck lint --force --concurrency=2 \
  && TZ=UTC pnpm exec turbo run test --force --concurrency=1 \
  && pnpm --filter api depcruise && TZ=UTC pnpm test:integration
```

- **Nikad ne pokretati ni gasiti `pnpm dev:all`** — to je Nikolin terminal.
- **Migracija se generiše `drizzle-kit`-om**, nikad ručno pisanim SQL-om, i traži izričito odobrenje.

---

## File Structure

**Novo:**

| Fajl | Odgovornost |
| --- | --- |
| `packages/db/migrations/0055_*.sql` | četvrta svrha, `chat_message_id`, popravljen `one_of_claim_check` |
| `apps/api/src/core/attachments/attachment-download-meta.ts` | preseljeno iz `modules/attachments/` (modul ne sme da uvozi modul) |
| `apps/api/src/modules/chat/chat-attachments.service.ts` | provera tipa/broja, upis, razrešavanje za serviranje |
| `apps/internal-web/src/features/chat/composer-attachments.tsx` | red pločica iznad polja + birač + lepljenje |
| `apps/internal-web/src/features/chat/message-attachments.tsx` | pločice i pilula u mehuriću |
| `apps/internal-web/src/features/chat/attachment-lightbox.tsx` | omotač oko `AttachmentPreviewDialog` sa čet URL-ovima |
| `apps/internal-web/src/lib/use-file-picker.ts` | preseljen `useIntakePhotoPicker` + opcija `accept` |

**Menja se:** `packages/db/src/schema/attachments.ts` · `packages/shared/src/enums.ts` ·
`packages/shared/src/schemas/chat.schema.ts` · `packages/shared/src/queries/chat.ts` ·
`apps/api/src/core/middleware/body-limit.ts` · `apps/api/src/infrastructure/storage/storage.interface.ts` ·
`apps/api/src/modules/chat/{chat.repository,chat.service,chat.controller,chat.routes,chat.schema}.ts` ·
`apps/api/src/core/container.ts` · `apps/internal-web/src/routes/_shell/razgovori.tsx` ·
`apps/internal-web/src/features/chat/{composer,message-row,thread-context-panel,conversation-pane}.tsx` ·
`packages/ui/src/components/claim-attachments/claim-attachment-preview-dialog.tsx` ·
`packages/i18n/src/messages/{sr,en}.json` · `CLAUDE.md` · `.cursor/rules/05-security.mdc` ·
`design_handoff_chat/2026-08-21-cet-KOMPLETNA-specifikacija.md`

---

### Task A1: Čet na užem ekranu

**Files:**
- Modify: `apps/internal-web/src/routes/_shell/razgovori.tsx` (FRAME_CLASSES `:55-56`, lista `:181`, zaglavlje `:189`, panel `:237`)
- Modify: `apps/internal-web/src/features/chat/conversation-list.tsx:191`
- Modify: `apps/internal-web/src/features/chat/thread-context-panel.tsx:154`
- Test: `apps/internal-web/src/features/chat/__tests__/chat-responsive.test.tsx` (create)

**Interfaces:**
- Produces: ništa što drugi zadatak uvozi. `@container/chat` na okviru je jedini ugovor.

**Merenje pre koda (obavezno):** otvoriti `/razgovori` u pregledaču (Playwright iz
`apps/api/node_modules/playwright`), sužavati okvir i zapisati **`PORUKE_MIN`** — širinu na kojoj
mehurić i composer prestaju da rade. Onda:

```
PRAG_PANEL = 252 + 250 + PORUKE_MIN
PRAG_LISTA = 252       + PORUKE_MIN
```

Provera: kontejner je **1140px** na ekranu 1440 sa otvorenom bočnom trakom i **980px** na 1280.
Lista mora da preživi oba; panel mora da preživi 1140. Ako ne preživi — `PORUKE_MIN` je pogrešno
izmeren, ne prag.

- [ ] **Step 1: Izmeriti `PORUKE_MIN` i zapisati oba praga u komentar iznad `FRAME_CLASSES`**

Komentar mora da kaže **šta je mereno i na čemu**, po uzoru na `intake-orders-table.tsx`.

- [ ] **Step 2: Napisati test koji tvrdi DEKLARACIJU (jsdom ne vidi CSS)**

```tsx
// apps/internal-web/src/features/chat/__tests__/chat-responsive.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ConversationList } from '../conversation-list'

// jsdom ne primenjuje container queries. Ovaj test čuva DEKLARACIJU: ime kontejnera postoji i
// oba praga su ISTA vrednost na oba mesta — bez toga `@min-[…]` tiho nikad ne pogodi.
describe('chat responsive declaration', () => {
  it('lista nosi prag liste, isti onaj koji okvir objavljuje', () => {
    render(<ConversationList items={[]} activeId={null} onSelect={() => {}} onNewThread={() => {}} />)
    const aside = screen.getByRole('complementary')
    expect(aside.className).toContain('@min-[PRAG_LISTApx]/chat:')
  })
})
```

⚠ `PRAG_LISTA` u testu je **broj izmeren u koraku 1**, ne literal iz ovog plana.

- [ ] **Step 3: Pokrenuti test i videti da pada**

Run: `pnpm --filter internal-web test -- chat-responsive`
Expected: FAIL — klasa još ne postoji.

- [ ] **Step 4: Dodati `@container/chat` na okvir**

`razgovori.tsx:55-56` → `FRAME_CLASSES` dobija `@container/chat` **na početak**.
⚠ **NE dirati** istoimenu konstantu u `claim-conversation-tab.tsx:35` — ona je već jednokolonska.

- [ ] **Step 5: Lista se sklanja ispod `PRAG_LISTA`**

Novo stanje `const [listOpen, setListOpen] = useState(false)` u `razgovori.tsx`.
Lista dobija `hidden @min-[PRAG_LISTApx]/chat:flex` i, kad je `listOpen`, preklop preko cele širine.
Zaglavlje dobija strelicu ← vidljivu samo ispod praga (`@max-[…]/chat:grid`), koja radi `setListOpen(true)`.
`openConversation` radi `setListOpen(false)`.
Hladno učitavanje bez `?razgovor=` → `listOpen` počinje kao `true`.

- [ ] **Step 6: Panel postaje preklop između dva praga**

`thread-context-panel.tsx:154`: `w-[250px] flex-none` ostaje iznad `PRAG_PANEL`; ispod njega
`absolute inset-y-0 right-0 z-20 shadow-*`. `contextOpen` **već postoji** — ne dodavati novo stanje.

- [ ] **Step 7: `Esc` i klik izvan zatvaraju oba preklopa, fokus se vraća na dugme**

- [ ] **Step 8: Pokrenuti test — prolazi. Onda pun gejt.**

- [ ] **Step 9: Dokazati mutacijom** — skloniti ime kontejnera (`@container` bez `/chat`) i potvrditi
      da test pocrveni. Ako ne pocrveni, test je šupalj i piše se ponovo.

- [ ] **Step 10: Izmeriti u pregledaču na 1440, 1280, 1024 i 768 — oba naloga (kancelarija, serviser)**

- [ ] **Step 11: Commit**

```bash
git add apps/internal-web/src docs/superpowers
git commit -m "feat(chat): the room gives its width to the conversation"
```

---

### Task B1: Migracija, svrha, i čuvar koji brani izveštaje

**Files:**
- Modify: `packages/shared/src/enums.ts:103-115`
- Modify: `packages/db/src/schema/attachments.ts:60-101`
- Create: `packages/db/migrations/0055_*.sql` (generisana)
- Test: `apps/api/src/modules/attachments/__tests__/attachments.integration.test.ts` (dopuna)

**Interfaces:**
- Produces: `AttachmentPurpose.ChatAttachment = 'chat_attachment'`; kolona `attachments.chat_message_id`.

- [ ] **Step 1: Dodati svrhu u `@mr/shared`**

```ts
// packages/shared/src/enums.ts — uz IntakeQuote
/**
 * A file sent inside a chat message. Its own purpose because the client rule in
 * `attachments.repository.ts` visibilityFilter hands the portal EVERY image whose purpose is
 * `claim_attachment` — a photo from an internal thread would reach the customer (Nikola, N1).
 */
ChatAttachment: 'chat_attachment',
```

- [ ] **Step 2: Izmeniti shemu — kolona, FK, indeks, oba CHECK-a**

```ts
// packages/db/src/schema/attachments.ts
chatMessageId: uuid('chat_message_id'),
```

`attachments_purpose_check` dobija četvrtu vrednost.
`attachments_one_of_claim_check` dobija **petu granu** (`claim_kind IS NULL AND chat_message_id IS NOT NULL
AND emotive_claim_id IS NULL AND domace_claim_id IS NULL AND client_submission_id IS NULL AND intake_order_id IS NULL`)
**i `AND chat_message_id IS NULL` u sve četiri postojeće grane.**
FK `attachments_chat_message_id_fkey` → `chat_messages.id` `ON DELETE CASCADE`.
Parcijalni indeks `idx_attachments_chat_message_id ... WHERE chat_message_id IS NOT NULL`.

- [ ] **Step 3: Generisati migraciju**

Run: `pnpm --filter @mr/db run db:generate`
Expected: nastaje `0055_*.sql`. **Pročitati je celu** i potvrditi da sadrži samo ova četiri DDL-a.

- [ ] **Step 4: Napisati test koji tvrdi da neprijateljski red pada**

```ts
it('odbija prilog koji nosi i poruku i reklamaciju', async () => {
  await expect(
    db.insert(attachments).values({
      claimKind: 'emotive',
      emotiveClaimId: claim.id,
      chatMessageId: message.id,
      fileName: 'x.jpg', storagePath: 'x', mimeType: 'image/jpeg', fileSizeBytes: 1n,
      purpose: AttachmentPurpose.ClaimAttachment,
    }),
  ).rejects.toThrow(/attachments_one_of_claim_check/)
})
```

- [ ] **Step 5: Napisati čuvar koji brani slike izveštaja**

```ts
it('slika izveštaja se i dalje servira kroz /api/attachments/:id/download', async () => {
  // Spec §10: ovde je jednom predloženo da findById dobije filter po svrsi. Ovaj test je razlog
  // zašto se to NE sme uraditi — report_image ide kroz isti URL.
  const res = await app.request(`/api/attachments/${reportImageId}/download`, {}, envWithOperator)
  expect(res.status).toBe(200)
})
```

- [ ] **Step 6: Pokrenuti oba testa protiv prazne baze od nule**

Run: `TZ=UTC pnpm test:integration`
Expected: PASS, i migracija od nule prolazi (globalSetup to već radi).

- [ ] **Step 7: Dokazati mutacijom** — skloniti `AND chat_message_id IS NULL` iz prve grane i
      potvrditi da test iz koraka 4 pocrveni.

- [ ] **Step 8: Pun gejt, pa commit**

```bash
git add packages/db packages/shared apps/api/src/modules/attachments
git commit -m "feat(db): a chat message may own a file, and only one parent may"
```

---

### Task B2: Slanje — multipart, tipovi, broj, granica tela

**Files:**
- Modify: `packages/shared/src/schemas/chat.schema.ts:203-207` (`ChatSendInputSchema`)
- Modify: `apps/api/src/core/middleware/body-limit.ts:34-60`
- Modify: `apps/api/src/infrastructure/storage/storage.interface.ts` (nov graditelj putanje)
- Create: `apps/api/src/modules/chat/chat-attachments.service.ts`
- Modify: `apps/api/src/modules/chat/{chat.controller,chat.service,chat.schema}.ts`
- Modify: `apps/api/src/core/container.ts` (ChatService dobija storage; konstrukcija se pomera ispod `storageService`)
- Test: `apps/api/src/core/middleware/__tests__/body-limit.test.ts`, `apps/api/src/modules/chat/__tests__/chat-attachments.integration.test.ts` (create)

**Interfaces:**
- Consumes: `AttachmentPurpose.ChatAttachment` (B1), `processUploadFile`/`writeStoredFile` iz `core/attachments/attachment-upload-pipeline.ts`, `readUploadFiles` iz `core/http/upload-files.ts`.
- Produces:
  ```ts
  buildChatAttachmentStoragePath(input: {
    conversationId: string; attachmentId: string; extension: string
  }): string   // `chat/${conversationId}/${attachmentId}.${extension}`

  class ChatAttachmentsService {
    prepare(files: UploadFile[]): Promise<PreparedChatFile[]>   // 415/400/413 ovde
    persist(messageId: string, conversationId: string, prepared: PreparedChatFile[]): Promise<number>
  }
  ```

- [ ] **Step 1: Test da JSON čet poruka OSTAJE pod 2 MB**

```ts
// body-limit.test.ts
it('čet poruka u JSON-u ostaje na podrazumevanoj granici', () => {
  expect(usesUploadLimit('/api/chat/conversations/x/messages', 'application/json')).toBe(false)
  expect(usesUploadLimit('/api/chat/conversations/x/messages', 'multipart/form-data; boundary=y')).toBe(true)
})
```

- [ ] **Step 2: Pokrenuti — pada (funkcija ne postoji)**

- [ ] **Step 3: Granica se bira po putanji I sadržaju**

```ts
// body-limit.ts — izvezeno zbog testa; putanja bez multiparta više ne diže granicu
export function usesUploadLimit(path: string, contentType: string | undefined): boolean {
  return isUploadPath(path) && (contentType ?? '').startsWith('multipart/form-data')
}
```

`UPLOAD_PATH_PATTERNS` dobija `/^\/api\/chat\/conversations\/[^/]+\/messages$/`.
`requestBodyLimit` zove `usesUploadLimit(c.req.path, c.req.header('content-type'))`.

- [ ] **Step 4: `body` gubi `.min(1)`; pravilo se seli u servis**

```ts
// chat.schema.ts — prazno telo je legalno SAMO uz fajl, a šema fajlove ne vidi (spec §6.3)
body: z.string().trim().max(CHAT_MESSAGE_MAX_LENGTH),
```

- [ ] **Step 5: Integracioni testovi slanja (pišu se pre servisa)**

```ts
it('slika bez teksta prolazi', async () => { /* 201, body === '' */ })
it('prazna poruka bez fajla pada', async () => { /* 400 */ })
it('video se odbija', async () => { /* 415 */ })
it('šesti fajl se odbija', async () => { /* 400 */ })
it('ponovljen clientMsgId sa fajlovima vraća 200 i NE pravi drugu kopiju', async () => {
  // dva ista slanja → jedan red u chat_messages i jedan skup priloga
})
```

- [ ] **Step 6: Pokrenuti — svi padaju**

- [ ] **Step 7: Napisati `ChatAttachmentsService` i uvezati ga u `ChatService.send`**

Redosled iz spec §6 je obavezan: provera u memoriji → `insertMessage` → `created === false` → 200 i
bacanje bajtova → tek onda `writeStoredFile` + upis redova.

- [ ] **Step 8: Kontroler prima oba oblika**

```ts
const isMultipart = (c.req.header('content-type') ?? '').startsWith('multipart/form-data')
const input = isMultipart
  ? ChatSendInputSchema.parse(formFieldsOf(await c.req.formData()))
  : ChatSendInputSchema.parse(await c.req.json())
```

- [ ] **Step 9: Svi testovi prolaze**

- [ ] **Step 10: Dokazati mutacijom** — obrnuti redosled (fajlovi pre poruke) i potvrditi da test
      ponovljenog `clientMsgId` pocrveni.

- [ ] **Step 11: Pun gejt + `pnpm --filter api depcruise`, pa commit**

```bash
git commit -m "feat(chat): a message can carry what the camera just saw"
```

---

### Task B3: Serviranje i preuzimanje

**Files:**
- Move: `apps/api/src/modules/attachments/attachment-download-meta.ts` → `apps/api/src/core/attachments/attachment-download-meta.ts` (+ svi uvoznici)
- Modify: `apps/api/src/modules/chat/{chat.repository,chat.service,chat.controller,chat.routes}.ts`
- Test: `apps/api/src/modules/chat/__tests__/chat-attachments.integration.test.ts`

**Interfaces:**
- Consumes: `ChatAttachmentsService` (B2).
- Produces: `GET /api/chat/conversations/:id/attachments/:attachmentId`.

- [ ] **Step 1: Test koji gađa BAŠ rupu iz spec §7**

```ts
it('id priloga iz niti koju ne sme da vidi, predat uz nit koju sme → 404', async () => {
  // serviser vidi Opšti kanal bezuslovno i nijednu nit reklamacije
  const res = await app.request(
    `/api/chat/conversations/${generalChannelId}/attachments/${attachmentFromClaimThread.id}`,
    {}, envWithServiser,
  )
  expect(res.status).toBe(404)
})

it('povučena poruka više ne servira svoj prilog', async () => { /* 404 */ })
it('sopstveni prilog kroz sopstvenu nit → 200', async () => { /* 200 + ETag */ })

// Spec §10, test 1: portal ga ne sme videti ni u listi ni na download-u.
it('klijent ne vidi čet prilog reklamacije', async () => {
  const list = await app.request(`/api/emotive-claims/${claimId}/attachments`, {}, envWithClient)
  expect((await list.json()).items).toHaveLength(0)

  const direct = await app.request(
    `/api/attachments/${chatAttachment.id}/download`,
    {},
    envWithClient,
  )
  expect(direct.status).toBe(404)
})
```

- [ ] **Step 2: Pokrenuti — padaju (ruta ne postoji)**

- [ ] **Step 3: Repozitorijum razrešava prilog KROZ poruku, u jednom upitu**

```ts
async findChatAttachment(conversationId: string, attachmentId: string) {
  const rows = await this.db
    .select({ /* … */ })
    .from(attachments)
    .innerJoin(chatMessages, eq(chatMessages.id, attachments.chatMessageId))
    .where(and(
      eq(attachments.id, attachmentId),
      eq(attachments.purpose, AttachmentPurpose.ChatAttachment),
      isNull(attachments.deletedAt),
      eq(chatMessages.conversationId, conversationId),
      isNull(chatMessages.deletedAt),
    ))
    .limit(1)
  return rows[0] ?? null
}
```

- [ ] **Step 4: Servis: `requireVisible(conversationId)` **plus** upit iz koraka 3; `null` → `NotFoundError`**

- [ ] **Step 5: Ruta koristi `parseAttachmentDownloadRequest` + `serveCachedAttachmentDownload`**

- [ ] **Step 6: Testovi prolaze**

- [ ] **Step 7: Dokazati mutacijom** — skloniti `eq(chatMessages.conversationId, conversationId)` i
      potvrditi da test iz koraka 1 pocrveni. **Ako ne pocrveni, test ne dokazuje ništa.**

- [ ] **Step 8: `pnpm --filter api depcruise` mora proći posle selidbe fajla**

- [ ] **Step 9: Pun gejt, pa commit**

```bash
git commit -m "feat(chat): a file answers only through the room it was sent to"
```

---

### Task B4: Žica — prilog na poruci, `hasAttachment` na citatu

**Files:**
- Modify: `packages/shared/src/schemas/chat.schema.ts` (`ChatAttachmentSchema`, `ChatMessageSchema`, `ChatQuoteSchema`)
- Modify: `packages/shared/src/queries/chat.ts` (`buildChatAttachmentUrl`)
- Modify: `apps/api/src/modules/chat/chat.repository.ts` (`mapMessageRow:291-324`, `resolveQuotes:429-461`, `listPins:838-861`)
- Test: `apps/api/src/modules/chat/__tests__/chat-attachments.integration.test.ts`, `apps/internal-web/src/features/chat/__tests__/use-chat-stream.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export const ChatAttachmentSchema = z.object({
    id: z.string().uuid(),
    fileName: z.string(),
    mimeType: z.string(),
    fileSizeBytes: z.number(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    hasThumbnail: z.boolean(),
  })
  export type ChatAttachment = z.infer<typeof ChatAttachmentSchema>

  buildChatAttachmentUrl(conversationId: string, attachmentId: string, variant?: 'thumbnail'): string
  ```
  `ChatMessage` dobija `attachments: ChatAttachment[]`, `partialFiles: number`.
  `ChatQuote` dobija `hasAttachment: boolean` (pin ga nasleđuje).

- [ ] **Step 1: Test da prilog stiže i kroz SLANJE, ne samo kroz listu**

```ts
it('odgovor na slanje već nosi prilog', async () => {
  const res = await sendWithFile()
  const body = await res.json()
  expect(body.attachments).toHaveLength(1)   // findMessageById, ne listMessages
})
```

- [ ] **Step 2: Test da preklapanje od 20 redova NE BRIŠE prilog**

```tsx
// use-chat-stream.test.tsx — spec §12.5
it('spajanje ne odnosi prilog koji ekran već drži', () => {
  const held = [{ ...msg, attachments: [file] }]
  const incoming = [{ ...msg, attachments: [file] }]
  expect(mergeChatMessages(held, incoming)[0].attachments).toHaveLength(1)
})
```

- [ ] **Step 3: Pokrenuti — padaju**

- [ ] **Step 4: Rezolver po strani, po uzoru na `resolveReactors:473-499`**

Jedan upit keyed na id-jeve strane, `Map`, prazan niz kao podrazumevano.
⚠ Kači se u **`mapMessageRow`**, pa ga dobijaju i `listMessages:594` i `findMessageById:776`.

- [ ] **Step 5: `hasAttachment` u `resolveQuotes` i `listPins`**

`EXISTS` podupit, isti u oba — ⚠ **oba**, inače zakačena fotografija-bez-teksta crta prazan blok.

- [ ] **Step 6: Testovi prolaze**

- [ ] **Step 7: Dokazati mutacijom** — skloniti rezolver iz `findMessageById` grane i potvrditi da
      test iz koraka 1 pocrveni.

- [ ] **Step 8: Pun gejt, pa commit**

```bash
git commit -m "feat(chat): the message carries its files wherever it goes"
```

---

### Task B5: Composer — spajalica, kamera, lepljenje

**Files:**
- Create: `apps/internal-web/src/lib/use-file-picker.ts` (preseljen `useIntakePhotoPicker` + `accept`)
- Modify: `apps/internal-web/src/features/intake-orders/wizard/intake-photo-grid.tsx:10`, `step-damage-photos.tsx`
- Create: `apps/internal-web/src/features/chat/composer-attachments.tsx`
- Modify: `apps/internal-web/src/features/chat/composer.tsx:32-33, 152-159, 216-233, 304`
- Modify: `apps/internal-web/src/features/chat/conversation-pane.tsx:221-264` (optimistički red)
- Modify: `packages/i18n/src/messages/{sr,en}.json`
- Test: `apps/internal-web/src/features/chat/__tests__/conversation-pane.test.tsx:175-181` (**zamena, ne brisanje**), `composer-attachments.test.tsx` (create)

**Interfaces:**
- Consumes: `buildChatAttachmentUrl` (B4), `compressImage` iz `@mr/ui`.
- Produces: `onSend: (body: string, files: File[]) => void` — potpis `Composer`-a se menja.

- [ ] **Step 1: Preseliti birač i dati mu `accept`**

```ts
// apps/internal-web/src/lib/use-file-picker.ts
export function useFilePicker(
  onPick: (files: File[]) => void,
  options?: { accept?: string },
): { openCamera: () => void; openGallery: () => void; inputs: React.ReactElement }
```

⚠ Kamera zadržava `accept="image/*" capture="environment"`. Galerija uzima `options.accept`, sa
podrazumevanim `image/*` — **tako se prijem ne menja nijednim bajtom.**

- [ ] **Step 2: Zameniti test koji tvrdi da je spajalica mrtva**

```tsx
// conversation-pane.test.tsx — stari test je čuvar koji je i postojao da padne na ovaj dan
it('spajalica je živa i nudi slike i PDF', () => {
  render(<ConversationPane {...props} />)
  const input = screen.getByTestId('chat-file-input')
  expect(input).toHaveAttribute('accept', expect.stringContaining('application/pdf'))
  expect(screen.getByTitle(/Prilog/)).not.toBeDisabled()
})
```

- [ ] **Step 3: Test da kamera na desktopu ne postoji**

```tsx
it('kamera se crta samo na dodirnom ekranu', () => {
  render(<ConversationPane {...props} />)
  expect(screen.getByTitle(/Kamera/).className).toContain('pointer-coarse:')
})
```

- [ ] **Step 4: Pokrenuti — padaju**

- [ ] **Step 5: Napisati `ComposerAttachments`**

Red pločica **iznad** polja (⚠ nikad unutar — `composer.tsx:64-100` objašnjava da ogledalo pomera
karet), po pločici ✕ za skidanje pre slanja, `objectURL` sa **revokacijom pri zameni i pri unmount-u**
(uzor `use-intake-photo-queue.ts:169-177, 208-214`).
Slike prolaze kroz `compressImage(file, { maxEdge: 2048 })`.
Šesti fajl se ne prima — traka javlja koliko sme.

- [ ] **Step 6: Lepljenje**

```tsx
onPaste={(event) => {
  const files = Array.from(event.clipboardData.files)
  if (files.length > 0) { event.preventDefault(); addFiles(files) }
}}
```

- [ ] **Step 7: `submit()` i dugme POŠALJI prihvataju tekst ILI fajl**

`composer.tsx:152-159` i `:304` — uslov postaje `text.trim() !== '' || files.length > 0`.

- [ ] **Step 8: Optimistički red nosi fajlove**

`conversation-pane.tsx:221-264`: `PendingChatMessage.files: File[]`; composer ostaje otvoren za
kucanje; bez trake napretka (poruka je jedna).
Neuspeh sa `partialFiles > 0` crta traku „N fajlova nije sačuvano — pošalji ih ponovo"; ponovno slanje
ide kao **NOVA poruka**, nikad isti `clientMsgId` (spec §6.4).

- [ ] **Step 9: i18n — tri ključa, sr + en**

⚠ `chat_attach_title` danas kaže „slika, PDF, **Excel**" — mora se prepisati (Excel nije dozvoljen).
Posle izmene: `pnpm --filter @mr/i18n run build` (ne samo `compile`), inače `typecheck` crveni.

- [ ] **Step 10: Testovi prolaze**

- [ ] **Step 11: Dokazati mutacijom** — skloniti revokaciju `objectURL`-a i potvrditi da test curenja
      pocrveni; skloniti `application/pdf` iz `accept` i potvrditi da test iz koraka 2 pocrveni.

- [ ] **Step 12: Pun gejt, pa commit**

```bash
git commit -m "feat(chat): the paperclip and the camera do what they promise"
```

---

### Task B6: Mehurić — pločice, pilula, preuzimanje

**Files:**
- Create: `apps/internal-web/src/features/chat/message-attachments.tsx`
- Modify: `apps/internal-web/src/features/chat/message-row.tsx:375-389`
- Test: `apps/internal-web/src/features/chat/__tests__/message-attachments.test.tsx` (create)

**Interfaces:**
- Consumes: `ChatAttachment` (B4), `getAttachmentPreviewKind` + `formatAttachmentFileSize` iz `@mr/shared`.

**Vrednosti iz prototipa** (`design_handoff_chat/cet-prototip.dc.html:126, 129`) — **ne procenjivati**:
pločica `104×74`, radius `9`, `gap 7`, okvir `--border2`, hover `border-color: --text2`;
pilula `padding 9px 12px`, `gap 9`, radius `9`; značka `700 8px mono`, `letter-spacing .1em`,
`color --redh`, okvir `rgba(237,28,36,.4)`, `padding 2px 5px`, radius `4`;
ime `12px/700`, veličina `500 9px mono` u `--text2`.

- [ ] **Step 1: Test da je pločica FIKSNE veličine**

```tsx
it('pločica je 104x74 — slika koja se učita kasnije ne sme da pomeri listu', () => {
  render(<MessageAttachments items={[image]} conversationId="c" />)
  expect(screen.getByRole('button', { name: /x\.jpg/ }).className).toContain('h-[74px]')
})
```

- [ ] **Step 2: Test da dokument crta značku i veličinu**

- [ ] **Step 3: Pokrenuti — padaju**

- [ ] **Step 4: Napisati komponentu**

Slika → `<img>` sa `buildChatAttachmentUrl(…, 'thumbnail')`, `object-cover`, u fiksnom okviru.
⚠ HEIC nema sličicu — `onError` pada na ikonicu tipa, nikad na razbijenu sliku.
Dokument → pilula.
Preuzimanje → `ActionGlyph` (uzor `message-row.tsx:253-283`) sa `?disposition=attachment`.

- [ ] **Step 5: Uvezati u `message-row.tsx` između tela i futera (redosled iz prototipa)**

- [ ] **Step 6: Testovi prolaze**

- [ ] **Step 7: Dokazati mutacijom** — zameniti fiksnu visinu sa `h-auto` i potvrditi da test pocrveni

- [ ] **Step 8: Pun gejt, pa commit**

```bash
git commit -m "feat(chat): a photo in the room, at a size that holds its place"
```

---

### Task B7: Mreža priloga u panelu + lightbox

**Files:**
- Modify: `apps/api/src/modules/chat/{chat.repository,chat.service,chat.controller,chat.routes}.ts`
- Modify: `packages/shared/src/queries/chat.ts` (`chatKeys.attachments(conversationId)`)
- Modify: `packages/ui/src/components/claim-attachments/claim-attachment-preview-dialog.tsx` → `attachment-preview-dialog.tsx`
- Modify: `apps/internal-web/src/features/attachments/claim-attachments-tab.tsx` (novo ime + `buildUrl`)
- Create: `apps/internal-web/src/features/chat/attachment-lightbox.tsx`
- Modify: `apps/internal-web/src/features/chat/thread-context-panel.tsx`
- Modify: `apps/internal-web/src/lib/handle-app-event.ts:151-157`
- Test: `apps/api/src/modules/chat/__tests__/chat-attachments.integration.test.ts`, `thread-context-panel.test.tsx:152-156` (**zamena**)

**Interfaces:**
- Produces: `GET /api/chat/conversations/:id/attachments` → `{ items, total, page, pageSize }`,
  gde svaki `item` je `ChatAttachment & { messageId: string }`.

- [ ] **Step 1: Test da brojač NIJE ograničen na stranu poruka**

```ts
it('soba sa više od 50 poruka broji sve priloge', async () => {
  // CHAT_MESSAGES_PAGE_SIZE = 50 — keš poruka ne zna za starije priloge (spec §9.3)
  const res = await app.request(`/api/chat/conversations/${id}/attachments`, {}, env)
  expect((await res.json()).total).toBe(60)
})
it('povučena poruka obara brojač', async () => { /* total pada za 1 */ })
```

- [ ] **Step 2: Pokrenuti — padaju**

- [ ] **Step 3: Endpoint + upit (isti `deleted_at IS NULL` uslovi kao B3)**

- [ ] **Step 4: `chatKeys.attachments()` + invalidacija u postojećoj grani `chat_message_created`**

`handle-app-event.ts:151-157` dobija četvrti `invalidateQueries`.

- [ ] **Step 5: Preimenovati dijalog i dati mu `buildUrl`**

```tsx
export function AttachmentPreviewDialog(props: {
  items: Array<{ id: string; fileName: string; mimeType: string; fileSizeBytes: number }>
  buildUrl: (id: string, variant?: 'thumbnail') => string
  /* … ostalo nepromenjeno … */
})
```

⚠ Svi zatečeni pozivaoci dobijaju `buildUrl={buildAttachmentDownloadUrl}` — ponašanje reklamacija se
ne menja.

- [ ] **Step 6: Zameniti test koji tvrdi da priloga u panelu nema**

- [ ] **Step 7: Mreža 3×3 u panelu** (`cet-prototip.dc.html:174`: `repeat(3,1fr)`, `gap 6`,
      `aspect-ratio 1`, radius `7`, poslednji „+N" u `600 9px mono`)

⚠ Panel postoji **samo na niti reklamacije** — ključ `chat_context_attachments_empty` se briše
zajedno sa svojim mestom.

- [ ] **Step 8: Testovi prolaze**

- [ ] **Step 9: Dokazati mutacijom** — vratiti brojanje na keš poruka i potvrditi da test iz koraka 1 pocrveni

- [ ] **Step 10: Pun gejt, pa commit**

```bash
git commit -m "feat(chat): the room keeps a shelf of everything it was sent"
```

---

### Task B8: Brisanje sobe odnosi i bajtove

**Files:**
- Modify: `apps/api/src/modules/chat/{chat.service,chat.repository}.ts` (`deleteConversation:520-522`)
- Test: `apps/api/src/modules/chat/__tests__/chat-message-actions.integration.test.ts`

**Interfaces:**
- Consumes: `storage.delete()` — uzor `intake-orders.service.ts:1038, 1064-1074` (`eraseStoredFiles`).

- [ ] **Step 1: Test da posle brisanja sobe u skladištu nema nijednog objekta**

```ts
it('obrisana soba ne ostavlja fajlove na disku', async () => {
  await service.deleteConversation(conversationId, admin)
  await expect(storage.readStream(storedPath)).rejects.toThrow()
})
```

- [ ] **Step 2: Pokrenuti — pada (bajtovi ostaju)**

- [ ] **Step 3: Skupiti putanje pa obrisati bajtove PRE reda**

⚠ Redosled je isti kao kod prijema: `eraseStoredFiles` **pre** brisanja reda. Greška po fajlu se
loguje sa putanjom i **ne zaustavlja** brisanje.

- [ ] **Step 4: Test prolazi**

- [ ] **Step 5: Dokazati mutacijom** — obrnuti redosled (red pa fajlovi) i potvrditi da test pocrveni

- [ ] **Step 6: Pun gejt, pa commit**

```bash
git commit -m "fix(chat): erasing a room takes its files with it"
```

---

### Task B9: Dokumenti koji više ne smeju da obećavaju suprotno

**Files:**
- Modify: `CLAUDE.md` (§2 invarijanta četa, spisak mesta za nov SSE tip)
- Modify: `.cursor/rules/05-security.mdc` (imenovan izuzetak od revizije za `chat`)
- Modify: `design_handoff_chat/2026-08-21-cet-KOMPLETNA-specifikacija.md` (§10, §6.3)

- [ ] **Step 1: CLAUDE.md — invarijanta priloga u četu**

Jedan pasus u §2 uz postojeću čet invarijantu: svrha `chat_attachment`, zašto (predikat od 04.07.),
ruta pod čet kapijom, `findById` se ne dira i zašto, granica tela po sadržaju.

- [ ] **Step 2: CLAUDE.md — spisak umesto broja**

„PET mesta" → spisak od osam, sa oznakom koja tri **ćute**.

- [ ] **Step 3: `.cursor/rules/05-security.mdc` — imenovan izuzetak**

Čet ne piše reviziju po poruci ni po prilogu; jedini audit red je brisanje sobe. Bez ovoga pravilo
blokira PR.

- [ ] **Step 4: Handoff §10/§6.3 — ispraviti tvrdnju da prilog iz niti postaje prilog reklamacije**

- [ ] **Step 5: `pnpm format:check`, pa commit**

```bash
git commit -m "docs(chat): the papers stop promising the opposite of the code"
```

---

## Posle svega

- **Nema migracije koja traži seed** — nova dozvola nije uvedena, pa posle deploja **ne treba `db:seed`**.
- **Migracija `0055` ide sama** kroz `db:migrate:deploy`.
- **Provera u pregledaču pre poziva Nikoli:** poslati fotografiju iz niti reklamacije sa dva naloga,
  otvoriti je kao klijent na portalu (mora 404), preuzeti je kao interni korisnik, povući poruku pa
  ponovo otvoriti prilog (mora 404).
