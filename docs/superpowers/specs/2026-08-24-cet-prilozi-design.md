# Čet — prilozi, kamera i uži ekran (korak 4)

> Nastavak na `2026-08-23-cet-razgovori-design.md`. Ono što taj spec zove „korak 4".
> Gde ovaj i handoff protivreče, **ovaj pobeđuje** — razlozi su niže, svaki sa dokazom u kodu.
> Verzija 2: prošao je kroz četiri neprijateljska pregleda protiv koda; pet tvrdnji prve verzije
> je bilo netačno i one su ovde ISPRAVLJENE, ne obrisane — §16 imenuje svaku.

---

## 1. Šta se gradi

Spajalica i kamera u composeru prestaju da budu mrtve. Fotografija ili PDF putuje **na samoj
poruci** — nema posebnog ekrana, nema posebnog događaja, nema stanja „okačeno a neposlato".

Dve faze, ovim redom:

- **Faza A — čet na užem ekranu.** Kamera je afordansa tableta; nema smisla je isporučiti na ekran
  koji na tabletu ne radi.
- **Faza B — prilozi.** Spajalica, kamera, lepljenje iz clipboard-a, preuzimanje, lightbox,
  mreža priloga u desnom panelu.

---

## 2. Nikoline odluke, 24.08. (ne preispituju se)

1. **Prilog živi SAMO u razgovoru.** Tab „Prilozi" na reklamaciji se ne dira.
2. **Fotografije + PDF.** Video i Office se odbijaju — **na serveru**, ne samo u `accept` atributu.
3. **Slika sama JESTE poruka** — tekst uz nju nije obavezan.
4. **Sklanja se povlačenjem cele poruke.** Nema zasebnog „ukloni fajl".
5. **Do 5 fajlova po poruci, bez kvote po razgovoru.** Po fajlu ostaje zatečenih 25 MB.
6. **Korisnici mogu da preuzmu sliku** — dugme na prilogu i u lightboxu.
7. **Lepljenje slike iz clipboard-a** (Ctrl+V) — da.
8. **Uži ekran: dve prečke.** Prvo odlazi desni panel, pa tek onda lista razgovora.

---

## 3. Šta je razmotreno i ODBAČENO — sa razlogom

### 3.1 „Poveži prilog sa reklamacijom" — odbačeno 24.08.

Predloženo je dugme koje bi prilog iz niti prevelo u prilog reklamacije („jedan izvor").
**Odbačeno kad je izmereno šta to znači za kupca.**

`apps/api/src/modules/attachments/attachments.repository.ts:70-81` nosi pravilo koje je Nikola
doneo **04.07.**, zapisano u samom kodu:

```
or(
  eq(attachments.visibility, ClientVisible),
  and(eq(attachments.purpose, ClaimAttachment), ilike(attachments.mimeType, 'image/%')),
)
```

Drugi disjunkt **ignoriše kolonu vidljivosti**. Čim fotografija postane prilog EMOTIVE reklamacije,
partner je vidi na portalu — nema prekidača. Dugme „poveži" bi bilo dugme „pošalji kupcu" pod tuđim
imenom, a pogrešan klik se ne može vratiti jer je kupac već video.

**Ishod:** prilog ostaje u četu. Ko hoće da pošalje kupcu, kači kroz Priloge — svesno.
⚠ Zatvoreno dok pravilo od 04.07. važi u ovom obliku, ne zauvek.

### 3.2 Handoff §10 / §6.3 tvrdi suprotno

`design_handoff_chat/2026-08-21-cet-KOMPLETNA-specifikacija.md` traži da se prilog iz niti registruje
i kao prilog reklamacije. To je put koji §3.1 odbija. **Tekst handoff-a se ispravlja u istoj izmeni** —
dokument koji obećava suprotno je gori od dokumenta koji ne postoji.

---

## 4. Faza A — čet na užem ekranu

### 4.1 Zatečeno stanje, pročitano iz koda

Nije reč o tri fiksne kolone — to je bila greška prve verzije:

| kolona | stanje danas |
| --- | --- |
| lista razgovora | `w-[252px] flex-none`, **bezuslovno** (`conversation-list.tsx:191`) |
| poruke | `min-w-0 flex-1` |
| desni panel | `w-[250px] flex-none`, ali se crta **samo kad ga čovek otvori** (`contextOpen`, podrazumevano `false`, `razgovori.tsx:141, 237`) **i samo na niti reklamacije** — `ThreadContextPanel` i `ThreadContextToggle` vraćaju `null` bez reklamacije (`thread-context-panel.tsx:61, 146`) |

Dakle problem na užem ekranu pravi **lista**, a panel ga pogorša kad se otvori. U celom
`features/chat/` nema nijedne responsivne klase. Ljuska pretvara bočnu traku u fioku tek ispod `lg`
(1024px), sadržaj ima `px-4 sm:px-8`. Na 390px poruci ostaje ~106px.

### 4.2 Pravilo i pragovi

Prekidač je **imenovani `@container/chat`**, nikad `lg:`, nikad merenje širine u JavaScriptu — server
i pregledač bi se razišli i hidracija bi pala (CLAUDE.md §5).

```
PRAG_PANEL = 252 (lista) + 250 (panel) + PORUKE_MIN
PRAG_LISTA = 252 (lista)               + PORUKE_MIN
```

⚠ **`PORUKE_MIN` se NE može pročitati iz prototipa** — to je bila greška prve verzije. Artboard je
1440 i **sadrži sopstvenu bočnu traku od 236px** (`cet-prototip.dc.html:23-24`), okvir četa je
`flex:1` (`:41`), kolona poruka `flex:1;min-width:0` (`:75`) — nema deklarisanog minimuma, a „širina
koju stvarno dobija" je dvosmislena za tih 236px.

`PORUKE_MIN` je zato **izmeren** u pregledaču: širina na kojoj mehurić i composer prestaju da rade.
Oba praga se onda proveravaju protiv **stvarnog kontejnera**, ne protiv širine ekrana:

| ekran | kontejner | mora da preživi |
| --- | --- | --- |
| 1440, traka otvorena | 1440 − 236 − 64 = **1140** | lista **i** panel |
| 1280, traka otvorena | 1280 − 236 − 64 = **980** | lista |

Ovo je metod iz CLAUDE.md §5: prag se bira tako da **nijedna zatečena širina ne izgubi kolonu**.
Pravilo „prototip pobeđuje" **ne važi za ova dva broja** — prototip ih ne sadrži.

### 4.3 Šta se dešava na svakoj prečki

| širina kontejnera | lista | poruke | panel (samo nit reklamacije) |
| --- | --- | --- | --- |
| ≥ `PRAG_PANEL` | 252px | ostatak | treća kolona, kad se otvori |
| `PRAG_LISTA` … `PRAG_PANEL` | 252px | ostatak | **preklop zdesna**, kad se otvori |
| < `PRAG_LISTA` | iza strelice ← | cela širina | preklop zdesna |

- Na kanalima (Opšti, tematski) nema ni ⓘ ni panela — red „panel" tamo ne postoji.
- Panel iza ⓘ je **preklop, ne treća ruta** — URL se ne menja, pa se ništa ne dodaje ruteru (tri
  rute već imaju upozorenje `did not match after params.stringify`; ne dodajemo četvrto).
- **Composer ostaje netaknut u širini.** Njegovo polje je `textarea` sa ogledalom iza sebe za bojenje
  pomena; komentar u `composer.tsx:64-100` kaže zašto — razlika u padingu pomera karet. Prilozi se
  crtaju u **novom redu iznad** polja, nikad unutar njega.

### 4.4 Gde tačno (odluka, da se ne bira dvaput)

- `@container/chat` ide na `FRAME_CLASSES` div u `routes/_shell/razgovori.tsx:180` — **izričito NE**
  na istoimenu konstantu u `claim-conversation-tab.tsx:35`, koja je već jednokolonska i bez panela.
- Novo stanje je **samo `listOpen`**; `contextOpen` već postoji (`razgovori.tsx:141`).
- Izbor razgovora zatvara listu. Hladno učitavanje `/razgovori` bez `?razgovor=` otvara listu.
- Oba preklopa se zatvaraju na `Esc` i klik izvan; fokus se vraća na dugme koje ih je otvorilo.

---

## 5. Faza B — model

### 5.1 Migracija `0055` (traži izričito odobrenje, generiše je `drizzle-kit`)

1. **Četvrta svrha:** `attachments_purpose_check` → `('claim_attachment','report_image','intake_quote','chat_attachment')`.
   Presedan `0050_intake_quote.sql`.
2. **Nova kolona** `chat_message_id uuid` + FK na `chat_messages(id)` **`ON DELETE CASCADE`** +
   parcijalni indeks `WHERE chat_message_id IS NOT NULL`. Presedan `0036`.
3. **Peta grana** u `attachments_one_of_claim_check`, i — **popravka koju niko nije tražio a mora** —
   `AND chat_message_id IS NULL` u sve četiri POSTOJEĆE grane. Kako su danas napisane
   (`packages/db/src/schema/attachments.ts:72-91`), o petoj koloni ne kažu ništa, pa bi prilog
   reklamacije smeo da nosi i vezu na poruku. Nijedan test to danas ne hvata.

⚠ **Kaskada je namerna, ali sama ne stiže.** Presedan je `intake_orders.delete_signed`, koji fajlove
briše **pre** reda: `eraseStoredFiles(id)` (`intake-orders.service.ts:1038`, jedini pozivalac
`storage.delete()` u celom API-ju, `:1071`) pa tek onda `hardDelete` (`:1039`). Isto radi i čet:
pre `deleteConversation` (`chat.repository.ts:520-522`) skupiti `storage_path` + `thumbnail_path`
priloga sobe i obrisati bajtove. Bez toga soba nestane, a fajlovi ostanu na disku koji plaćamo —
bez ijednog reda koji ih imenuje.

### 5.2 Svrha, ne kolona vidljivosti

`AttachmentPurpose.ChatAttachment = 'chat_attachment'` u `packages/shared/src/enums.ts`, sa JSDoc-om
po uzoru na `IntakeQuote` koji **imenuje upit koji bi ga inače progutao**.

⚠ `purpose` ima DEFAULT `'claim_attachment'`. Zaboravljeno polje **ne curi klijentu** — claim FK-ovi
su NULL, pa `listByClaim` (`attachments.repository.ts:126-127`) traži claim id koji red nema, a
`findById` vraća `null` na NULL claim FK (`:151-154`). Radi suprotno: svaki čet upit traži
`purpose = 'chat_attachment'` potvrdno, pa bi fotografija **tiho nestala iz sopstvene poruke**.
Zato se svrha navodi izričito. *(Prva verzija ovog spec-a je razlog navela naopako.)*

### 5.3 Bez nove dozvole

Kapija ostaje `INTERNAL_APP_PERMISSIONS` — ko sme da napiše poruku u toj niti, sme i da okači.
**Posle deploja NE treba `db:seed`** (N4 sa 23.08. ostaje na snazi).

⚠ Reuse `/api/attachments/upload` je nemoguć iz dva razloga, i drugi je tiši: dozvola
(`attachments.upload` NIJE u `INTERNAL_APP_PERMISSIONS`, pa serviser i vidilac prolaze kroz čet vrata
a dobijaju 403) i sadržaj (`claimKind` + `claimId` su obavezna polja forme → 400). Presedan je
zapisan u `intake-orders.routes.ts:76-78`.

---

## 6. Slanje — jedan endpoint, redosled koji preživljava ponovljen pokušaj

`POST /api/chat/conversations/:id/messages` prima i **`multipart/form-data`** pored postojećeg JSON-a.
Polja: `body` (opciono), `clientMsgId`, `quoteOf` (opciono), `files` (do 5). Tekstualna poruka ostaje
JSON i ne menja se ni jednim bajtom.

```
1. provera fajlova U MEMORIJI  — magični bajtovi, spisak tipova, smanjivanje, sha256   (ništa na disku)
2. insertMessage               — ON CONFLICT DO NOTHING po client_msg_id
3. created === false  → 200, bajtovi se BACAJU                                          (ništa ne ostaje)
4. created === true   → writeStoredFile + upis redova
5. announce()
```

**Zašto tim redom:** idempotencija koju čet već ima po `client_msg_id` time pokriva i fajlove.
Obrnut redosled traži brisanje objekata pri svakom ponovljenom pokušaju.

### 6.1 Server je sudija za tip i broj

⚠ `processUploadFile` odbija samo ono što `detectAttachmentMimeType` ne prepoznaje, a taj skup
uključuje video i Office (`detect-attachment-mime.ts:7-11`). Odluka §2.2 bi bez servera visila o
`accept` atributu, koji je nagoveštaj, ne brana. Zato u `ChatService`, pored granica:

- tip van `ALLOWED_IMAGE_MIME_TYPES` + `application/pdf` → **415** `UnsupportedMediaTypeError`
- više od 5 fajlova → **400** `ValidationError`
- fajl preko 25 MB → **413** (iz postojećeg pipeline-a)

Presedan je `attachments.service.ts:368`. Sva tri statusa composer prikazuje **rečenicom servera**.

### 6.2 Granica tela zahteva se bira po SADRŽAJU, ne po putanji

⚠ `requestBodyLimit` danas bira limiter **isključivo po putanji** (`body-limit.ts:58-60`). Dodati
čet rutu u `UPLOAD_PATH_PATTERNS` značilo bi dići **najčešći POST modula — običnu tekstualnu
poruku** — sa 2 MB na 130 MB, tj. skloniti sloj koji `:52-56` izričito brani.

Zato: upload granica važi kad je putanja upload putanja **I** `content-type` je `multipart/form-data`;
sve ostalo ostaje na 2 MB. Test `isUploadPath` se proširuje tvrdnjom da **JSON slanje čet poruke i
dalje pada pod 2 MB**.

### 6.3 Prazan tekst

⚠ `body: z.string().trim().min(1)` (`chat.schema.ts:204`) pada **na nivou polja**, pre svake objektne
provere — `superRefine` tu ne može da radi. Uz to šema uopšte ne vidi fajlove; oni stižu kao
`FormData`.

Zato: `body` gubi `.min(1)` (zadržava `.max(CHAT_MESSAGE_MAX_LENGTH)`), a pravilo **„prazno telo samo
uz bar jedan fajl"** živi u `ChatService.send`, gde se raščlanjen unos i obrađeni fajlovi prvi put
sretnu. Prazna poruka bez ičega ostaje odbijena.

### 6.4 Kad upis u skladište padne posle upisa poruke

Odgovor je **201 sa `partialFiles: n`** na poruci. Ekran crta traku „N fajlova nije sačuvano — pošalji
ih ponovo", i ponovno slanje ide kao **NOVA poruka**, nikad kroz isti `clientMsgId` — jer bi taj po
koraku 3 vratio 200 i bacio bajtove, pa bi fotografija bila nepovratna.

---

## 7. Čitanje i serviranje

`GET /api/chat/conversations/:id/attachments/:attachmentId` — pod kapijom samog modula.

⚠ **`requireVisible` NIJE dovoljan** — to je bila najozbiljnija greška prve verzije. On autorizuje
razgovor iz URL-a, ne prilog (`chat.service.ts:533-543`). Serviser prolazi kapiju, vidi Opšti kanal
**bezuslovno** (`chat.repository.ts:181-183`) i ne vidi nijednu nit reklamacije — pa bi
`/conversations/<opšti>/attachments/<id iz tuđe niti>` prošao sve provere koje je prva verzija
imenovala.

Zato se prilog razrešava **kroz svoju poruku, u istom upitu**:

```
attachments.id = :attachmentId
  AND attachments.purpose = 'chat_attachment'
  AND attachments.deleted_at IS NULL
INNER JOIN chat_messages
  ON chat_messages.id = attachments.chat_message_id
  AND chat_messages.conversation_id = :id
  AND chat_messages.deleted_at IS NULL
```

`null` → **404**. Oba brata u repou to već rade i objašnjavaju u komentaru
(`attachments.repository.ts:324-343`, `intake-orders.repository.ts:797-808`).

Ponovo se koristi ceo postojeći lanac iz `core/`: `parseAttachmentDownloadRequest`
(`?variant=thumbnail`, `?disposition=attachment`), `serveCachedAttachmentDownload` (ETag + 304),
`buildAttachmentDownloadResponse` (`nosniff` + sanitizovan `Content-Disposition`), bajtovi teku kroz
`storage.readStream` i nikad se ne bafuju.

⚠ `resolveAttachmentDownloadMeta` danas živi u `modules/attachments/`, a **modul ne sme da uvozi
modul** (depcruise). Seli se u `core/attachments/`.

⚠ `GET /api/attachments/raw` (izuzet od prijave) se **ne koristi i ne proširuje**.

---

## 8. Žica

Novo `ChatAttachmentSchema`, po uzoru na `SubmissionAttachmentItem`:

```
id · fileName · mimeType · fileSizeBytes · width · height · hasThumbnail
```

Nikad `storagePath`, nikad `visibility`, nikad `uploadedBy`, nikad `purpose`. **Bez `caption`** —
ništa ga ne puni i ništa ga ne crta; žica nosi samo ono što ekran štampa.

⚠ `AttachmentListItem` se **ne reciklira**: traži ne-null `claimKind`/`claimId`, a `mapRow` na takvom
redu **baca** (`attachments.repository.ts:26-28`) — dakle 500, ne 404.

`ChatMessageSchema` dobija `attachments: ChatAttachment[]` (podrazumevano prazan niz). Rezolver se
kači na **`mapMessageRow`**, dakle i na `listMessages` i na `findMessageById:776` — a to je oblik koji
vraća SAMO SLANJE (201/200) i izmena. Uzor je `resolveReactors` (`chat.repository.ts:473-499`).

`ChatQuoteSchema` dobija `hasAttachment: boolean` (pin ga nasleđuje kroz `ChatPinSchema`). Bez toga
citirana i zakačena fotografija-bez-teksta crtaju **prazan blok**.

**Prilog putuje NA PORUCI — bez novog SSE tipa.** Postojeći `chat_message_created` već invalidira
`conversations`, `messages` i `pins` (`handle-app-event.ts:151-157`), a `mergeChatMessages` zamenjuje
red koji već drži, pa preklapanje od 20 redova donese prilog sa sobom.

⚠ CLAUDE.md kaže „PET mesta" za nov SSE tip. Stvarni spisak je: `core/ports/event-bus-port.ts`,
`NoOpEventBus` (`modules/events/event-bus.ts`), in-process bus, postgres bus (+`NotifyMessageSchema`),
`cache-invalidating-event-bus.ts`, deljena konstanta + unija, `parseAppEventFromSseData`,
`HANDLED_EVENT_TYPES` (`use-realtime-event-stream.ts`) — **tri od njih ćute**. U CLAUDE.md ide
**spisak, ne broj**. Zaključak ostaje: ne dodaje se tip.

---

## 9. Ekran

### 9.1 Composer

- **Spajalica** otvara birač; `accept` = slike + `application/pdf`.
- **Kamera** se crta samo na dodirnom ekranu (`@media (pointer: coarse)`, čist CSS). Na desktopu bi
  otvorila isti prozor kao spajalica i lagala imenom.
  Koristi se **postojeći `useIntakePhotoPicker`** (`capture="environment"`) — dokazan na tabletu u
  hali preko običnog http. ⚠ `getUserMedia` je nemoguć i zbog `permissions-policy: camera=()`
  (`tooling/vite/security-headers.ts:41`) i zbog nesigurnog konteksta.
  ⚠ Hook danas ima tvrdo `accept="image/*"` na oba inputa i ne prima opcije
  (`intake-photo-picker.tsx:14, 38-52`) — doslovno praćen, spajalica ne bi mogla da izabere PDF.
  Dobija opciju `accept`: kamera zadržava `image/*` + `capture`, galerija uzima string pozivaoca sa
  podrazumevanim današnjim `image/*`, **pa se prijem ne menja**. Fajl se seli zajedno sa pozivaocem
  `intake-photo-grid.tsx:10` — **ne kopira se**.
- **Lepljenje** (`onPaste`) uzima slike iz clipboard-a u isti red.
- Slike se smanjuju **još u pregledaču** na 2048px (`compressImage` iz `@mr/ui`). ⚠ Vraća original
  kad ne ume da dekodira — HEIC sa iPada prolazi pun; server ostaje jedini sudija.
- Red u letu: `PendingChatMessage.files: File[]` + lokalni `objectURL`-ovi; **composer ostaje otvoren
  za kucanje**, bez trake napretka (poruka je jedna, ne pet nezavisnih otpremanja).
- Dugme POŠALJI oživljava kad ima tekst **ili** fajl.
- Zaključana nit: spajalice nema, stari prilozi se i dalje čitaju.

### 9.2 Mehurić

Redosled u koloni je prototipov: ime → citat → tekst → **slike** → **dokument** → futer.

- **Pločica slike: 104×74, radius 9, gap 7, okvir `--border2`** (`cet-prototip.dc.html:126`).
  ⚠ **Odstupanje, svesno:** prototip u pločicu crta *ime fajla*, jer maketa nema pravu sliku. Mi
  crtamo pravu sličicu u istom okviru (`object-cover`). Geometrija ostaje njegova — i to nije
  kozmetika: **fiksnih 104×74 je ono što sprečava da slika koja se učita kasnije gurne listu ispod
  čitaoca.** Auto-skrol se pokreće jednom po novom redu (`message-list.tsx:101-107`).
  ⚠ HEIC ne dobija sličicu i download pada nazad na original — pločica mora da preživi i sličicu koje nema.
- **Dokument: pilula** sa crvenom `PDF` značkom, imenom `12px/700`, veličinom mono `9px`
  (`cet-prototip.dc.html:129`), kroz `getAttachmentPreviewKind` + `formatAttachmentFileSize`.
- **Preuzimanje** je `ActionGlyph` (`message-row.tsx:253-283`) — 15px glif, 29×29 za prst kroz
  poništenu marginu. Isti idiom kao lajk i pin; ne izmišlja se hover traka.

### 9.3 Lightbox i mreža priloga

- Klik na pločicu → **postojeći `ClaimAttachmentPreviewDialog`** iz `@mr/ui` (jedini ume i PDF i
  prelistavanje). Vezuje ga za reklamaciju samo **tip stavke i graditelj URL-a**, pa dobija `buildUrl`
  prop i sužen tip; preimenuje se u `AttachmentPreviewDialog`. Prelistavanje ide **unutar te poruke**.
- Panel dobija **PRILOZI IZ RAZGOVORA · N** — `repeat(3,1fr)`, `gap:6px`, kvadrati `aspect-ratio:1`,
  radius 7, poslednji „+N" (`cet-prototip.dc.html:174`).
  ⚠ **Mreža ima sopstveni endpoint** — to je bila rupa prve verzije. Klijent nikad ne drži celu sobu
  (`CHAT_MESSAGES_PAGE_SIZE = 50`), pa bi i „poslednjih 9" i `N` bili netačni u svakoj sobi starijoj
  od 50 poruka. Zato `GET /api/chat/conversations/:id/attachments` — ista kapija + `requireVisible`,
  omot `{ items, total, page, pageSize }`, svaki red nosi `messageId` za skok na poruku, sopstveni
  ulaz u `chatKeys`, invalidira se iz postojeće grane `chat_message_created`.
  ⚠ Postoji **samo na niti reklamacije** — panel i ⓘ na kanalima ne postoje (§4.1). Ključ
  `chat_context_attachments_empty` se briše zajedno sa svojim mestom.

---

## 10. Zašto klijent ovo ne vidi

**Već sigurno, bez ijedne izmene:** `listByClaim:128`, `countActiveForClaim:203` i
`countActiveReportImagesForClaim:229` **već filtriraju svrhu potvrdno** — čet fajl ne ulazi u galeriju
reklamacije, ne troši njenu kvotu (50 / 500 MB) i ne diže nijedan brojač. Portalski predikat iz §3.1
traži `purpose='claim_attachment'`, što čet red nije. Uz to `findById` vraća `null` čim su oba claim
FK-a NULL (`attachments.repository.ts:151-154`), pa `/api/attachments/:id/download` čet red ne servira.

⚠ **`findById` se NE dira** — prva verzija je tražila da dobije `eq(purpose, ClaimAttachment)` i to
je bila greška koja obara isporučenu funkciju: slike TipTap izveštaja se serviraju **baš tim URL-om**
(`attachments.service.ts:385, 444` vraćaju `/api/attachments/${id}/download` za red sa
`purpose='report_image'`), pa bi filter svaku sliku u svakom izveštaju pretvorio u 404 i učinio je
neobrisivom. Ništa ne kupuje, jer grana `claimId === null` već jeste brana. **Zapisano ovde da niko
kasnije ne „vrati" filter.**

**U drugom smeru:** svaki nov čet upit traži `eq(purpose, ChatAttachment)` potvrdno, da ponuda prijema
ili slika iz izveštaja ne osvane u sobi.

**Regresioni testovi** (uzor `attachments.integration.test.ts:180-212`):
1. fotografija okačena u nit reklamacije → klijentska lista je nema, klijentski download **404**;
2. **id priloga iz niti koju čovek ne sme da vidi, predat uz nit koju sme → 404** (§7 — običan
   „404 za tuđu nit" prolazi i sa rupom, pa ne dokazuje ništa);
3. slika izveštaja se i dalje servira kroz `/api/attachments/:id/download` (čuvar protiv „vraćanja" filtera).

---

## 11. Šta se NE radi

- Povezivanje priloga sa reklamacijom (§3.1).
- Prevlačenje fajla na sobu.
- Video i Office fajlovi — iako ih lanac prima.
- Sistemska poruka „dodat prilog". ⚠ `ChatSystemKind.AttachmentAdded` **već postoji i već se crta**
  (`message-row.tsx:61`) a niko je ne objavljuje — **ne prisvajati je**, namenjena je suprotnom smeru.
- Revizija po fajlu. Modul piše tačno jedan audit red (brisanje sobe, `chat.service.ts:446, 470`).
  ⚠ `.cursor/rules/05-security.mdc` i `07-api-design.mdc` su **obavezujući** i blokiraju PR; izuzetak
  se zato upisuje **u `05-security.mdc` kao imenovan izuzetak za `chat`**, ne samo u CLAUDE.md.
- Galerija kroz ceo razgovor (mreža pokazuje poslednjih 9, klik vodi na poruku).
- Izmena poruke menja **samo tekst**; fajlovi su zamrznuti na slanju.

---

## 12. Zamke — proći će zelen test i i dalje biti pogrešno

1. **Četiri postojeće grane `one_of_claim_check` ne zabranjuju petu kolonu** (§5.1).
2. **Zaboravljena svrha** ne curi nego **tiho briše sliku iz sopstvene poruke** (§5.2).
3. **Povučena poruka se poštuje na PET mesta:** `mapMessageRow:298`, `resolveQuotes:453-456`,
   `listPins:856-857`, plus **dva nova čitanja koja ovaj spec uvodi** — upit serviranja (§7) i upit
   mreže (§9.3), oba sa `chat_messages.deleted_at IS NULL`. Povlačenje je po §2.4 jedini način da se
   fajl skloni, pa promašeno mesto znači da se sklanjanje ne dešava.
4. **Rezolver zakačen samo na `listMessages`** ostavlja `findMessageById:776` bez njega — a to je oblik
   koji vraća SAMO SLANJE. Fotografija bi se pojavila tek posle sledećeg osvežavanja.
5. **`mergeChatMessages` zamenjuje** red koji već drži, pa bi red bez polja `attachments` **obrisao
   sliku koju ekran već pokazuje** — na svakom povratku veze.
6. **`body-limit`** — putanja bez uslova na `content-type` diže granicu i za tekstualne poruke (§6.2).
7. **`URL.createObjectURL`** curi kad optimistički red bude zamenjen serverskim po `clientMsgId`.
   Obrazac: `use-intake-photo-queue.ts:169-177, 208-214`.
8. **Nov i18n ključ je crven na `typecheck`-u dok se `@mr/i18n` ne BUILD-uje** (`compile` je dovoljan
   samo za dev). Bez ICU množine — „Ukupno: 3".
9. **`AttachmentsRepository.insert` je tipom sužen** na `ClaimAttachment | ReportImage`. Ne širiti ga.
10. **`durationSeconds` ne puni niko** i HEIC nema sličicu — ekran ne sme da pretpostavi širinu,
    visinu i sličicu.

---

## 13. Šta se menja u postojećem kodu

- `conversation-pane.test.tsx:175-181` tvrdi da je spajalica `disabled`,
  `thread-context-panel.test.tsx:152-156` da priloga još nema. **Oba idu u crveno i moraju se
  ZAMENITI, ne obrisati.**
- **Tri** i18n ključa obećavaju „stiže u sledećem koraku": `chat_attach_title` (`sr.json:395`),
  `chat_camera_title` (`:397`), `chat_context_attachments_empty` (`:405`), plus `en.json`.
  ⚠ `chat_attach_title` danas nudi „slika, PDF, **Excel**" — protivreči §2.2 i mora se prepisati.
- `resolveAttachmentDownloadMeta` → `core/attachments/` (§7).
- `useIntakePhotoPicker` dobija `accept` i seli se (§9.1).
- `ClaimAttachmentPreviewDialog` → `AttachmentPreviewDialog` + `buildUrl` (§9.3).
- `requestBodyLimit` dobija uslov na `content-type` (§6.2).
- CLAUDE.md: spisak mesta za nov SSE tip umesto broja, izuzetak četa od revizije, ovaj spec u §2.
- `.cursor/rules/05-security.mdc`: imenovan izuzetak za čet (§11).
- `design_handoff_chat/2026-08-21-cet-KOMPLETNA-specifikacija.md` §10/§6.3 (§3.2).

---

## 14. Redosled izrade

| # | Šta | Dokaz da radi |
| --- | --- | --- |
| A1 | `@container/chat`, `listOpen`, panel kao preklop | merenje na obe prečke **+ test koji tvrdi deklaraciju** (uzor `inbox-table.test.tsx:96-105`) |
| B1 | migracija `0055` + svrha u `@mr/shared` | migracija od nule na praznoj bazi |
| B2 | regresioni testovi curenja (sva tri iz §10) | svaki pada kad se njegov uslov skloni |
| B3 | slanje: multipart, tipovi, broj, `content-type` granica | ponovljen `client_msg_id` sa fajlovima → 200 bez druge kopije; JSON poruka i dalje pod 2 MB |
| B4 | serviranje + preuzimanje | tuđ prilog kroz svoju nit → 404; povučena poruka → 404 |
| B5 | žica: `attachments`, `hasAttachment`, `partialFiles` | prilog preživi preklapanje od 20 redova |
| B6 | composer: spajalica, kamera, lepljenje, granice | tablet: kamera; desktop: nema je |
| B7 | mehurić: pločice, pilula, preuzimanje | lista ne skače kad se slika učita |
| B8 | endpoint mreže + panel + lightbox | soba sa >50 poruka broji tačno; povučena poruka obara brojač |
| B9 | brisanje bajtova pre brisanja sobe | posle brisanja u skladištu nema nijednog objekta te sobe |

Svaki red se završava komitom, uz **pun gejt zelen** i `TZ=UTC` (CLAUDE.md §4).

---

## 15. Prijavljeno, ne popravljeno

- **Telefon ispod ~500px** ostaje tesan i posle faze A.
- **`intake-orders.repository.ts:798-805` (`findPhoto`) ne filtrira svrhu**, pa
  `GET /api/intake-orders/:id/photos/:attachmentId` danas servira i ponudu. Bezopasno (ista kapija),
  ali presedan nije toliko čist koliko izgleda — kopira se po slovu, ne po reputaciji.
- **`docs/08:152-176` opisuje čišćenje fajlova 30 dana posle `deleted_at` i nedeljno usaglašavanje
  siročadi. Toga nema u kodu.**
- **Meko obrisan prilog zauvek ostaje na disku** — po dizajnu (obnova baze ne sme da pokaže red bez
  fajla), ali bez ijednog čišćenja iza sebe.

---

## 16. Šta je prva verzija ovog spec-a tvrdila pogrešno

Zapisano da se ne bi „popravilo" nazad.

| # | Tvrdila je | Istina |
| --- | --- | --- |
| 1 | `findById` treba da dobije filter po svrsi | oborilo bi svaku sliku u svakom izveštaju (§10) |
| 2 | `requireVisible` je dovoljan za serviranje priloga | autorizuje razgovor, ne prilog — rupa (§7) |
| 3 | čet ruta ide u `UPLOAD_PATH_PATTERNS` | diglo bi granicu i tekstualnim porukama (§6.2) |
| 4 | mreža priloga čita iz keša poruka | keš drži 50 poruka; treba svoj endpoint (§9.3) |
| 5 | `PORUKE_MIN` se čita iz prototipa | prototip ga ne sadrži; meri se (§4.2) |
| 6 | čet su tri fiksne kolone | panel je već opcion i samo na nitima (§4.1) |
| 7 | zaboravljena svrha curi klijentu | tiho briše sliku iz sopstvene poruke (§5.2) |
| 8 | povlačenje se poštuje na tri mesta | pet (§12.3) |
| 9 | prazan tekst rešava `superRefine` | `.min(1)` pada na nivou polja; pravilo ide u servis (§6.3) |
| 10 | `useIntakePhotoPicker` može da izabere PDF | tvrdo `accept="image/*"`; dobija opciju (§9.1) |
| 11 | čet je jedini roditelj koji se tvrdo briše | prijem takođe, i on bajtove briše PRE reda (§5.1) |
| 12 | nov SSE tip je „šest mesta" | osam, tri ćute — u CLAUDE.md ide spisak (§8) |
