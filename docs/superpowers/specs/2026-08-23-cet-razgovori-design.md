# Čet („Razgovori") — dizajn za izradu

**Status:** PREDLOG — čeka Nikolino odobrenje · **Datum:** 23.08.2026 · **Aplikacija:** `internal-web` + `api` + `db`

**Izvori istine, po prvenstvu:**

1. **izgled:** `design_handoff_chat/cet-prototip.dc.html` — **svetinja**; vrednosti se ČITAJU iz fajla (folder se servira preko HTTP-a, `support.js` je pored), nikad ne procenjuju;
2. **funkcija:** `design_handoff_chat/2026-08-21-cet-KOMPLETNA-specifikacija.md` (dalje: **handoff**);
3. **ovaj dokument** — gde handoff protivreči kodu ili ćuti, odluka je ovde, i svaka je obrazložena.

⚠ Handoff se poziva na `cet-odluke.md` (odluke vlasnika) i na `2026-07-22-popup-notifikacija-handoff.md` — **nijedan ne postoji.** §0 handoff-a je jedini zapis vlasnikovih odluka; vizuelni zakon za popup je KOD (`notification-popups.tsx` + `.mri-glass` blok).

---

## 1. Šta se gradi

Interni razgovor u aplikaciji: **Opšti kanal** + **kanali po temi** + **nit po reklamaciji** (1 reklamacija = najviše 1 nit), sa prilozima, pomenima, viđeno, pretragom i pin-om. Klijent sa portala ne vidi ništa od toga. Ekran je nova stavka menija „Razgovori"; ista nit se čita i iz taba „Razgovor" na detalju reklamacije.

**Van obima ove faze** (i to se piše u primopredaji, da ne bi ispalo „prećutano"): telefon i tablet ispod 1024px · svetla tema dobija tokene ali se ne crta posebno · izvoz razgovora u PDF/Excel · glasovne poruke · „kuca…" indikator i online tačka (handoff ih izričito odbija).

---

## 2. Nikoline odluke, 23.08. (ne preispituju se)

| # | odluka | posledica |
| --- | --- | --- |
| **N1** | **Prilog iz niti OSTAJE interni** — klijent ga ne vidi | ⚠ **odstupanje od handoff §10**, namerno; vidi §3.1 |
| **N2** | **Zvono i popup samo za @pomen**; nepročitano se računa iz čet-a | ⚠ **odstupanje od handoff §0.5/§7**, namerno; vidi §3.2 |
| **N3** | MR broj se prepoznaje u **sva tri zatečena oblika**, i sa i bez prefiksa; nalozi prijema se preskaču | ⚠ handoff §8.1 predlaže regex koji ne pogađa nijedan pravi broj |
| **N4** | **Bez novih dozvola** — ko sme u internu aplikaciju, sme i u čet | nema `db:seed` posle deploja |

---

## 3. Odstupanja od handoff-a — svako sa razlogom

### 3.1 Prilog iz niti se NE registruje kao prilog reklamacije (N1)

Handoff §10: „prilog u niti se registruje i kao prilog reklamacije". **U ovom kodu to je tiho curenje ka klijentu.**

`attachments.repository.ts:65-79` daje portalskom klijentu svaki red koji je `purpose = 'claim_attachment'` **i slika**, **ignorišući kolonu `visibility`**. Uz to `bumpEmotiveClientContentUpdatedAt` klijentu pali oznaku NOVO. Fotografija iz interne niti bi tako stigla kupcu, bez greške i bez ijednog crvenog testa. Isti oblik greške je u ovom repou već dvaput ujeo (`/api/dashboard/summary`, ponuda u `photoCount`).

**Rešenje:** čet prilozi dobijaju **svoju svrhu** `purpose = 'chat_attachment'`. Nasleđuju ceo lanac za fajlove (magične bajtove, 25 MB, putanja iz UUID-a, meko brisanje, `Content-Disposition: attachment`), ali **ne ulaze** ni u galeriju reklamacije, ni u `photoCount`, ni u klijentsku žicu. Ko hoće sliku kod klijenta, kači je kroz postojeće Priloge reklamacije — svesno.
⚠ Upiti za priloge reklamacije MORAJU filtrirati `purpose` — isto pravilo koje ponuda prijema već nosi.

### 3.2 Zvono nosi samo pomene (N2)

Handoff §0.5 traži zvono+popup za **svaku** poruku, a §7 i §10 onda broje nepročitano na **dva različita načina** (iz zvona i iz pročitanosti). Izmereno: pri obimu ove firme to je red veličine **4.000 redova dnevno** u tabelu koja se nikad ne čisti, i dva brojača koja neizbežno razilaze.

**Rešenje:** nepročitano je **jedan** broj, iz `chat_reads`. Amber brojčići u listi i zbir na stavci menija čitaju njega. Zvono i popup se pale **samo na @pomen** (nov tip obaveštenja `chat_mention`), i pomen **probija utišanu nit** kako handoff §7 traži.

### 3.3 Niti se čuvaju INTERNIM setovima dozvola, ne „dozvolom čitanja reklamacija"

Handoff §8.8 kaže da nit prati postojeću dozvolu čitanja reklamacije — a nju **drži i klijent sa portala** (`emotive_claims.view_own_customer`). Doslovno sprovedeno, klijent bi čitao interne niti. Koriste se `INTERNAL_EMOTIVE_CLAIMS_VIEW_PERMISSIONS` / `INTERNAL_DOMACE_CLAIMS_VIEW_PERMISSIONS` — isti propust je zatvoren 21.08. i zapisan u CLAUDE.md §2.

### 3.4 Ulaz u čet je `INTERNAL_APP_PERMISSIONS` (N4)

Bez `chat.view`/`chat.send`. Ko prolazi čuvara interne aplikacije, prolazi i u čet — uključujući servisera, vidioca i nalog „samo Statistika" (taj set je deo `INTERNAL_APP_PERMISSIONS`). Klijent ne prolazi, jer `*_view_own_customer` namerno nije u tim setovima.
**Nit dodatno** traži pravo čitanja SVOJE reklamacije (§3.3): ko ne sme da vidi reklamaciju, ne vidi ni njenu nit — ali kanale vidi.

### 3.5 MR broj (N3)

Handoff §8.1: `MR \d{4}/\d{2}`. **U produkciji stoje `7167/25`, `MR1204/26`, `MR-7167`** — a `normalizeMrKey` **ne skida prefiks**, pa su to različiti ključevi.
**Rešenje:** prefiks je **cela grupa i opciona** — `(?:MR)?\s?-?\d{3,5}\s?/\s?\d{2}`, plus zaseban oblik bez kose crte (`MR-7167`). ⚠ Prvo napisano `MR?…` bilo je **greška u ovom dokumentu**: čita se kao „M pa opciono R", traži vodeće `M` i nikad ne bi pogodilo `7167/25` — prvi oblik koji je gore naveden kao produkcioni. Za svaki pogodak se traži i doslovan i ključ bez prefiksa; ako ništa ne pogodi — ostaje običan tekst. **Brojevi naloga prijema (`RN-…`) se izričito preskaču** (imaju svoj normalizator i svoj registar). ⚠ Mutacija je pokazala da oblik `RN-0249/26` hvata i opšte pravilo „broj zalepljen za crticu", ali **razmaknuti `RN 0249/26` hvata samo pravilo za prijem** — zato ono stoji zasebno.

---

## 4. Model

Sedam tabela, jedna migracija.

```
chat_conversations   id · type('general'|'channel'|'claim') · name? · emotive_claim_id? · domace_claim_id?
                     · created_by · created_at · updated_at · deleted_at
                     CHECK: type='claim' → tačno jedan claim id; inače oba NULL
                     CHECK: type='channel' → name NOT NULL
                     dva PARCIJALNA unique indeksa na claim id → „1 reklamacija = 1 nit"
                     jedan parcijalni unique: samo jedan red sa type='general'

chat_members         conversation_id · user_id · created_at            (samo za 'channel')
chat_messages        id · conversation_id · author_id? · body · seq bigserial · quote_of?
                     · system_kind? · system_meta jsonb? · edited_at? · deleted_at? · created_at
chat_reads           conversation_id · user_id · last_seq · updated_at   (PK: oba)
chat_pins            conversation_id · message_id · pinned_by · created_at
chat_reactions       message_id · user_id · created_at                  (PK: oba — jedna reakcija ✓)
chat_mutes           conversation_id · user_id                          (PK: oba)
```

**Zašto `seq bigserial` a ne vreme:** PK-ovi su UUID **v4, nesortivi** (CLAUDE.md §8), a rad na kategorijama je već izmerio da izjednačene datume razvezuje nasumičan UUID. Redosled poruka, „dokle sam pročitao", stranice i „ima li novijih" traže **monoton ključ** — `seq` je jedini pošten.

**Autor:** `author_id` je FK na `users` sa **`ON DELETE SET NULL`** (nikad CASCADE) — poruke su dokazni materijal (handoff §8.7), a nalog se gasi. Sistemska poruka nema autora, pa je kolona ionako NULL-abilna.

**Klijentska žica** nikad ne nosi id-jeve tuđih naloga niti sirove vremenske pečate mimo onoga što ekran crta.

---

## 5. Odluke o svemu što handoff NE kaže

Ovo je spisak koji odgovara na Nikolinu bojazan („neke stvari nisu urađene"): 25 mesta gde bi graditelj inače tiho izmislio pravilo.

| # | pitanje | odluka |
| --- | --- | --- |
| 1 | redosled poruka | `seq` rastuće; nikad `created_at` |
| 2 | koliko se učitava | 50 poruka; starije na skrol nagore; deep-link učitava prozor oko poruke |
| 3 | „na dnu sam" | ≤ 80px od dna; skroluje SAM tok, ne stranica |
| 4 | izmena poruke | dozvoljena **15 minuta**, samo svoja; posle toga ne; stara verzija se ne čuva (ako zatreba — svoj posao) |
| 5 | brisanje | meko; red ostaje, telo se ne prikazuje, na mestu poruke stoji „Poruka obrisana" — **render, ne nova sistemska poruka** |
| 6 | kanal: brisanje/napuštanje | kanal briše i preimenuje **onaj ko ga je napravio ili admin**; član sme da izađe; Opšti kanal ni jedno ni drugo |
| 7 | pomen | čuva se **id korisnika** (`@[ime](id)` u telu); ime se crta iz baze, pa preimenovanje ne kvari link; pomen nekome ko ne sme da vidi tu nit — **ne šalje se** |
| 8 | ko emituje sistemske poruke | `ChatPort` u `core/ports/` (kao `NotificationsPort`) — servisi reklamacija ga zovu; modul ne sme da uvozi modul |
| 9 | sistemski događaj bez niti | **ne pravi nit** (handoff §8.2: ništa se ne pravi tiho); događaj se gubi, i to je namerno |
| 10 | reakcije | **jedna** (✓); tabela bez kolone za emoji |
| 11 | pin | po razgovoru, **najviše 20**; skida ga onaj ko je prikačio ili admin |
| 12 | viđeno | jedan upis po ulasku u razgovor i pri primanju nove poruke dok je otvoren, **prigušeno na 5 s**; „SVI" se računa prema aktivnim članovima |
| 13 | pretraga | svi razgovori koje smeš da vidiš; **bez obrisanih**; po `seq` opadajuće; `pg_trgm` indeks nad telom |
| 14 | deep-link | `/razgovori/$conversationId?message=<id>` — kroz Zod, kao svaka ruta u ovoj aplikaciji |
| 15 | tab „Razgovor" bez niti | prazno stanje sa dugmetom „Napravi nit" — **ne pravi se само otvaranjem taba** |
| 16 | brojač na tabu | da, kao Prilozi — broj nepročitanih te niti |
| 17 | skraćivanje | popup 90 znakova, citat 120 |
| 18 | vreme | `Intl` **uvek sa `timeZone: 'Europe/Belgrade'`** — pogon je u Beogradu, server je UTC (CLAUDE.md ima ceo incident) |
| 19 | čuvanje | ništa se ne briše automatski; kad tabela poraste, to je svoj posao |
| 20 | izvoz | **van obima**; piše se u primopredaji |
| 21 | kvota | čet prilog **ne ulazi** u kvotu reklamacije (druga svrha, §3.1) |
| 22 | promena kategorije | nit preživljava; red u listi se ne menja (nosi MR i partnera) |
| 23 | ispod 1024px | **van obima**, drugi prolaz |
| 24 | ⌘K paleta | stavka menija stiže sama; „skok na razgovor" **van obima**, zapisano |
| 25 | prazno/učitavanje/greška | sve tri kolone dobijaju svoja stanja, skeleti a ne točkići (CLAUDE.md §5) |

**Reklamacija obrisana (meko):** nit **ostaje**, nestaje sa liste dok je reklamacija obrisana, i vraća se sa njom (`restore` postoji). Poruke se ne diraju.
**DND** je **po pregledaču** (`useStoredFlag`, bez servera) i to piše u opisu prekidača. **Utišavanje niti je po nalogu** (`chat_mutes`), jer mora da preživi uređaj i da ga server čita.
**Domaća bez MR broja:** sme da ima nit, pravi se sa detalja, a red u listi nosi `claim_number`/kupca.

---

## 6. Realno vreme

Postojeći `EventBus`: nov događaj `chat_message_created` sa **samo** `{ conversationId, messageId }` — signal, nikad sadržaj (CLAUDE.md §2). Klijent na njega radi `invalidateQueries`, ništa više. Pomen dodatno ide kroz postojeći `publishNotificationCreated` na korisnički kanal.

---

## 7. Redosled izrade

Isti kao handoff §11, sa dve izmene koje nameće kod:

1. **Model + API + SSE** (bez UI) — uključuje `ChatPort` i sistemske poruke.
2. **Ekran: lista + Opšti kanal + composer** (tekst).
3. **Niti:** MR linkifikacija, čip niti, dijalog „Nova nit", kontekst panel, tab „Razgovor" u detalju.
4. **Prilozi + kamera** (nova svrha `chat_attachment`).
5. **Nepročitano + pomeni:** brojači, „NOVO" separator, viđeno, @pomen u zvono/popup, mute/DND.
6. **Kanali** + dijalog.
7. **Poliranje:** citat, izmena/brisanje, reakcija, pin, pretraga, deep-link, brzi odgovori.

⚠ Razlika u odnosu na §11: **nepročitano dolazi PRE kanala** (korak 5 pre 6), jer brojači i „NOVO" separator rade nad Opštim kanalom koji već postoji od koraka 2 — a kanali bez brojača izgledaju gotovo, pa se lako zaboravi da nisu.

---

## 8. Primopredaja

Prijemna lista iz handoff-a §12 se prenosi **doslovno** i svaka stavka se dokazuje snimkom ekrana. Uz nju ide i spisak iz §5 ovog dokumenta — svaka odluka koju sam doneo van handoff-a, izričito, da se vidi šta je odlučeno a ne prećutano.

---

## 9. Realtime ugovor — šta čet čini ispravnim

Osam pravila. Svako imenuje fajl. Ko izmisli alternativu, greši — alternative su razmotrene i stoje u §11 kao zamke.

**9.1 Redosled: `seq` rastuće — i rupa koju `seq` ima.** `bigserial` se dodeljuje pri upisu a vidi tek pri potvrdi, pa dva istovremena pošiljaoca mogu da naprave da čitalac vidi `42` dok je `41` još neupisan. Klijent koji zapamti 42 i posle traži „> 42" **trajno gubi 41**. Ne rešava se zaključavanjem: klijent **uvek traži `> maxSeen − 20`** i odbacuje id-jeve koje već ima. Preklapanje je besplatno, a isti ključ ionako treba za §9.4.

**9.2 Oporavak propuštenog — jedan endpoint, tri okidača.** Danas ga NEMA: `sse.controller.ts` ne šalje `id:`, a klijent na `open` samo resetuje odbroj. Jedini slučajni oporavak je `refetchOnWindowFocus` — dakle radi samo ako se korisnik vrati na prozor. Ista rupa postoji sloj niže: `postgres-event-bus.ts` zna da gubi signale objavljene tokom svog ponovnog povezivanja — jedan deploy = svaka poruka iz tog prozora nevidljiva svima.
`GET /api/chat/conversations/:id/messages?afterSeq=|beforeSeq=&limit=` → `{ items, nextCursor, hasMore }` (oblik iz `audit-log.repository.ts`, **ne** `{items,total,page,pageSize}` — beskonačan skrol nema broj strane). Klijent ga zove sa `afterSeq = maxSeen − 20` na: otvaranje SSE · povratak taba u vidljivo · okidanje čuvara iz §9.3.

**9.3 Živost — nijedna strana ne vidi polumrtvu vezu.** Server: otkucaj ide kroz `stream.write` koji **guta grešku na mrtvom soketu**, pa mrtav slušalac visi do granice od 30 minuta. Klijent: `EventSource` **ignoriše redove komentara**, pa otkucaj ne vidi; kad TCP umre bez RST-a (prelaz Wi-Fi→mobilna, VPN, uspavan laptop) `onerror` se nikad ne javi. Popravka, ~15 linija: otkucaj postaje **imenovan događaj** (`event: 'ping'`), klijent pamti vreme poslednjeg događaja i posle **45 s tišine sam ruši i ponovo otvara** vezu. Granica od 30 minuta OSTAJE — ona je ono što ponovo proverava opozvanu sesiju.
⚠ **Ne dodavati `id:` na SSE okvire** — niko ne čita `Last-Event-ID`, a §9.2 ionako pokriva i tu i `pg_notify` rupu jednim mehanizmom.

**9.4 Idempotentno slanje — `client_msg_id`.** Klijent kuje UUID pre slanja; kolona + parcijalni unique `(author_id, client_msg_id)`; upis `ON CONFLICT DO NOTHING`, prazan povratak → ponovo pročitaj i vrati **200** umesto 201. Isplati se triput: ponovljeno slanje je bezbedno, isti ključ je dedupe za §9.1, i on je ono što sprečava da se optimistički red iscrta dvaput.

**9.5 Stanja isporuke — optimističko slanje je ovde DOZVOLJENO** (zabrana iz CLAUDE.md važi za kreiranje/izmenu reklamacije; „optimistično je u redu za male radnje sa povratkom"). Tri stanja, ni jedno više: `pending` → `sent` → `failed` sa dugmetom za ponovno slanje **istog** `clientMsgId`.

**9.6 Stranice: keyset po `seq`, nikad offset.** 50 po strani.

**9.7 Viđeno: prigušeno na 5 s, i upis kroz `GREATEST`** — dva zahteva van redosleda ne smeju da vrate pročitanost unazad.

**9.8 Poništavanje kеša mora da bude prigušeno.** Bez toga svaka poruka u kanalu od 9 ljudi okida refetch kod svih — a sesijski limiter je **120 zahteva u minutu, deljen sa celom aplikacijom**.

**9.9 Nov SSE događaj ćuti ako se promaši ijedno od pet mesta** — spisak je u §12.

---

## 10. Push obaveštenja na telefon

**Odluke (Nikola, 23.08.):** push za **svaku** poruku u razgovoru čiji si član · na ekranu stoji **ime autora i početak poruke** · poštuju se utišana nit i DND · ne zvoni za sopstvenu poruku ni dok gledaš baš taj razgovor.

**Šta push traži da postoji, a nemamo ništa od toga:**

| korak | fajl |
| --- | --- |
| manifest (`display: standalone` — to je iOS kapija) | `apps/internal-web/public/manifest.webmanifest` |
| ikonice 192 / 512 / 512-maskable | `apps/internal-web/public/icons/` |
| veza iz zaglavlja | `apps/internal-web/src/routes/__root.tsx` (`links`) |
| service worker (`push` + `notificationclick`) | `apps/internal-web/public/sw.js` — **piše se ručno**, ništa ga ne prevodi ni ne pakuje |
| registracija + prekidač za dozvolu | `_shell.tsx` + nov ekran u podešavanjima |
| pretplata, čuvanje, slanje, čišćenje | nov modul `apps/api/src/modules/push/` + migracija |

**Prečica na telefonu je CELA interna aplikacija, ne čet** (Nikola, 23.08.). Manifest se zove „MR Interna", `start_url: '/'` — ikonica otvara Početnu ako je nalog prijavljen. Čet je stavka u meniju kao i svaki drugi modul. **Klik na obaveštenje je druga stvar:** vodi pravo u taj razgovor (`data.url` → ako je aplikacija već otvorena u nekom tabu, prebacuje se na njega preko `clients.matchAll`, inače otvara nov).

**Ikonice su napravljene (23.08.)** — `apps/internal-web/public/icons/`: `icon-192`, `icon-512`, `icon-512-maskable`, `apple-touch-icon` (180, **neprovidna**, jer iOS providnu podlaže crnom). Izvor je Nikolin `MR` znak 512×512 (`design_handoff_chat/mr-mark-512-source.png`), na brend tamnoj `#0b0b0d`.
⚠ **Pun amblem (majstor u zupčaniku) NIJE upotrebljen, i to je merena odluka:** na 180px je čitak, na **60px — a to je veličina na telefonu — pretvara se u mrlju**, jer se „SINCE 1968" i lik izgube. Jednostavan `MR` znak se čita na svakoj veličini. Amblem ostaje logo, nije ikonica.
⚠ **Maskable je zaseban fajl sa znakom na 58% širine**, ne isti fajl: Android podrazumevanu ikonicu seče u krug i odseca ivice; maskable ima sadržaj unutar bezbednog kruga.

**`web-push` je odobrena zavisnost** (Nikola, 23.08.) — potpisivanje i `aes128gcm` šifrovanje se ne pišu ručno.

**Ključne činjenice, proverene u našem buildu, ne po sećanju:**
- `public/**` se kopira u koren sajta (dokaz: `favicon.png`, `internal/logo-white.png`) i nitro sam dodeljuje ispravan MIME i `.webmanifest`-u i `.js`-u.
- CSP nam **ne smeta**: `worker-src` pada na `script-src 'self'`.
- ⚠ `/sw.js` danas ide **bez ijednog `Cache-Control`**, a `.js` je ekstenzija koju Cloudflare podrazumevano kešira. Bez pravila na oba kraja, radnici bi mesecima vukli **stari** service worker.
- ⚠ `apple-touch-icon` je danas `favicon.png` — **providan**, a iOS providnu ikonicu podlaže **crnom**. Treba mu neprovidna 180×180.
- Push **ne prolazi kroz Cloudflare** (pregledač ↔ Apple/Google ↔ naš API), pa geo-blokada i limiti ne smetaju; pretplata/odjava idu kroz `/api/*` i broje se u 60/min.

**Šta Apple i Google mogu da pročitaju:** sadržaj je šifrovan ključevima pregledača, oni ga **ne vide**. Ali stoji na **zaključanom ekranu** telefona i preslikava se na upareni sat i laptop. Aplikacija ne ume da razlikuje osetljiv tekst od bezazlenog — zato §13 nosi prekidač po čoveku.

**Odjava i gašenje naloga:** pretplata je vezana za nalog; deaktiviran ili obrisan nalog gubi pretplate, a odgovor `404/410` sa servisa znači „pretplata je mrtva, obriši je". ⚠ `403` **ne** znači to (to su pogrešni VAPID ključevi) i ne sme da briše.

---

**Fusnota kontekst panela je JEDINO mesto gde tekst prototipa nije prepisan doslovno (Nikola, 23.08.).** Prototip piše „Viđeno, pomeni i **nove poruke** idu u zvono + popup"; po odluci N2 zvono i popup nose **samo @pomen**, pa bi doslovan prepis obećavao iskačući prozor koji sistem ne šalje. Prototip je zakon za IZGLED — ovde je reč o činjenici koju je odluka promenila. Nova rečenica imenuje ono što aplikacija stvarno radi: pomen → zvono i popup, nove poruke → brojač u listi i push na telefon.

**Traka nad poljem ne pita dvaput (Nikola, 23.08.: „ne mora da izlazi popup").** Kad prepoznat MR
broj nema nit, dugme `NAPRAVI +` u composeru je **pravi**, bez `<ConfirmDialog>`-a posle. Traka je
pitanje, a dugme koje već piše NAPRAVI je odgovor na njega; drugo pitanje nije opreznost nego drugi
klik. Time je to treća vrata koja se ponašaju isto — badge NAPRAVI u dijalogu „Nova nit" i dugme
NAPRAVI NIT na detalju reklamacije oba pišu iz prvog pritiska. ⚠ **Čip MR broja u POSLATOJ poruci
zadržava dijalog** i mora: klik na broj usred tuđe rečenice ne govori da neko hoće sobu (§8.2).

## 11. Šta se NE sme raditi

- ❌ `vite-plugin-pwa` / Workbox — tukli bi se sa nitro cevovodom i keširali `/assets/**` koji već ima trajni keš; aplikaciji offline rad ne treba.
- ❌ `id:` na SSE okvirima i replay događaja na serveru — drugi izvor istine za problem koji `seq` već rešava.
- ❌ Push sa praznim telom („silent push") — iOS posle nekoliko takvih **oduzme dozvolu**; svaka grana `push` rukovaoca, uključujući `catch`, mora da pozove `showNotification`.
- ❌ Slanje push-a iz putanje zahteva sinhrono — best-effort, kao `fanOut()` kod obaveštenja.
- ❌ Brisanje pretplate na `403`.
- ❌ Offset stranice za poruke.
- ❌ Traženje dozvole za obaveštenja pri učitavanju — mora iz dodira, inače je pregledač trajno odbije.

---

## 12. Šta se menja u postojećem kodu

`sse.controller.ts` (imenovan otkucaj) · `use-realtime-event-stream.ts` (čuvar tišine + `ping`) · `handle-app-event.ts` + `app-events.ts` + `event-bus-port.ts` + oba autobusa + `NotifyMessageSchema` (nov događaj — **pet mesta, promašiš jedno i ćuti**) · `__root.tsx` (manifest + ikonica) · `_shell.tsx` (registracija SW) · `env.ts` (VAPID) · `internal-sidebar.tsx` (stavka + zbir) · `resource-query-map.ts` · claim detail (tab „Razgovor") · `attachments` (nova svrha) · i18n.

---

## 13. Prekidač po čoveku (odluka van handoff-a)

Push za svaku poruku znači, pri 200 poruka dnevno i 9 ljudi, **oko 200 zvukova dnevno po čoveku**. Tako rade Viber i WhatsApp — ali ko se prezasiti, ugasi obaveštenja u telefonu, i tada **gubi i pomene**, pa feature umire. Zato u podešavanjima stoji jedan red po čoveku:

**Obaveštenja na telefonu:** `sve poruke` (podrazumevano) · `samo pomeni` · `bez teksta na ekranu`

Tri vrednosti, jedna kolona. Pokriva i zabrinutost oko zaključanog ekrana — ko ne želi tekst napolju, isključi ga sam.

---

## 14. Šta se ne može dokazati bez telefona

Sve osim jednog se automatizuje: potpisivanje i šifrovanje (integracija protiv lažnog endpointa), ko dobija push (integracija, prava baza — ugašen nalog ne dobija, klijent se ne pojavljuje), čišćenje na `404/410` i **ne**-čišćenje na `403`, skraćivanje teksta, prigušenje, `GREATEST`, prozor oporavka. **Tri stvari se dokazuju mutacijom** (svaka je ovaj repo već ujela): izbaci `is_active` iz kruga primalaca · dodaj `403` u brisanje · zameni `GREATEST` običnim upisom.

**Ne može bez telefona samo jedno, i tu feature i pada:** iPhone od početka do kraja — Podeli → Dodaj na početni ekran → pokreni sa ikonice → **prijavi se ponovo** (instalirana aplikacija ima svoju korpu kolačića, odvojenu od Safarija) → uključi prekidač → primi push sa zaključanim ekranom.
⚠ Za to treba **pravi HTTPS**: `localhost` iOS-u ne važi, a grane se ne deploj-uju (Railway prati `main`). Znači ili ide na `main` sa isključenim VAPID promenljivim, ili traži privremeno Railway okruženje.
**Desktop Chrome dokazuje ceo serverski deo** — ključeve, šifrovanje, izlaz ka `fcm.googleapis.com`, primaoce, čišćenje — pre nego što iko dodirne telefon. To se radi prvo.

---

## 15. Prijavljeno, ne popravljeno

`permissions-policy: camera=()` u `tooling/vite/security-headers.ts` gasi `getUserMedia` u sve tri aplikacije. Handoff §7 korak 4 je „Prilozi + **kamera**". Ako se misli na `<input capture>` (predaje se sistemskoj kameri) — radi. Ako se misli na **pregled kamere u stranici** — ne radi, i to zaglavlje traži svoju odluku i svoju izmenu.

