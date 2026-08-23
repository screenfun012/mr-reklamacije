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
**Rešenje:** obrazac `MR?\s?-?\d{3,5}\s?/\s?\d{2}`; za svaki pogodak se traži i doslovan i ključ bez prefiksa; ako ništa ne pogodi — ostaje običan tekst. **Brojevi naloga prijema (`RN-…`) se izričito preskaču** (imaju svoj normalizator i svoj registar).

---

## 4. Model

Pet tabela, jedna migracija.

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
