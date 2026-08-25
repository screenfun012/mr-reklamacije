# Čet — obaveštenje na telefon (korak 5)

> Nastavak na `2026-08-23-cet-razgovori-design.md` (korak 5) i `2026-08-24-cet-prilozi-design.md`.
> Gde ovaj i handoff protivreče, **ovaj pobeđuje** — razlozi su u tekstu, svaki sa dokazom.

> **Dopuna 2026-08-25 (Nikolina odluka; ova dopuna pobeđuje starije delove ispod):** dozvola se
> traži samo posle jednog klika, a zatim aplikacija na svakom prijavljenom pokretanju sama vezuje ili
> popravlja postojeću pretplatu. DND i otvoren razgovor više NE gutaju primljen push: obaveštenje se
> uvek prikaže, samo sa `silent: true`, jer WebKit može ukinuti pretplatu zbog nevidljivih push-eva.
> Pretplata pripada aktivnoj sesiji; najviše 5 sesija znači najviše 5 aktivnih odredišta po
> korisniku. Lični režim ostaje na `users.push_mode`, nezavisno od odjave poslednjeg uređaja.
> Slanje je po API procesu ograničeno na 10 aktivnih i 250 čekajućih zahteva (dovoljno za jednu
> najgoru sobu od 50 ljudi × 5 uređaja); višak se odmah odbija umesto da puni RAM. Postoji najviše
> jedan retry, samo za 429/5xx. Payload nosi primaoca, pa se posle
> odjave/promene naloga eventualno već redovan stari push prikazuje generički, bez tuđeg teksta.
> Nema pollinga, outbox-a, Redis-a, Firebase-a, dodatnog Railway servisa ni beskonačnog retry-ja.

---

## 1. Šta se gradi

Poruka stigne na telefon i kad aplikacija nije otvorena. Danas u repou **nema nijedne linije** za
to: ni manifesta, ni service worker-a, ni tabele pretplata, ni zavisnosti.

⚠ **Push NIJE nadogradnja zvona.** Zvono nosi samo @pomen (Nikolina odluka N2, 23.08.), a push nosi
**svaku poruku** (N3). To su dva različita razašilja i dele samo spisak ljudi
(`listPeopleFor(conversation)`), koji već postoji i već je test-pokriven.

---

## 2. Nikoline odluke (ne preispituju se)

1. **Push za SVAKU poruku**, sa imenom i početkom teksta (N3, 23.08.).
2. **Prekidač po čoveku, tri položaja:** sve poruke · samo pomeni · bez teksta (N3).
   Razlog je njegov: „da ko se prezasiti ne ugasi obaveštenja u telefonu i time izgubi i pomene".
3. **Prečica na telefonu = cela interna aplikacija**, otvara Početnu. **Klik na obaveštenje = pravo
   u taj razgovor.** To su dve različite stvari (N5).
4. **Ikonica je jednostavan MR znak, ne amblem** — izmereno: amblem se na 60px pretvori u mrlju (N7).
   Fajlovi već postoje: `apps/internal-web/public/icons/`.
5. **Migracija `0056` odobrena** (24.08.).

---

## 3. Šta moraš da znaš pre nego što se gradi

### 3.1 Na iPhone-u i iPad-u push radi SAMO iz aplikacije dodate na početni ekran

Apple ne dozvoljava web push iz obične kartice Safari-ja. Dok korisnik ne uradi **Share → Add to
Home Screen**, `Notification.requestPermission` na iOS-u ne postoji i dugme se **ne sme ni crtati** —
inače nudi nešto što ne može da uradi.

Posledica za pogon: serviserima sa tabletima neko mora pokazati taj jedan korak. Ekran zato mora da
kaže **zašto** dugmeta nema, a ne da ćuti.

### 3.2 Nova zavisnost: `web-push`

⚠ **Traži tvoju reč.** Slanje push poruke nije HTTP zahtev nego potpisan VAPID JWT plus telo
šifrovano po RFC 8291 (AES-128-GCM sa razmenom ključeva). To se **ne piše ručno** — pogrešno
sprovedena kriptografija je gora od nikakve. `web-push` je referentna biblioteka za to.

### 3.3 Bez ključeva push je ugašen, i to je ispravno stanje

`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` su **opcioni** u `env.ts`. Kad ih nema,
`PushPort` je no-op, dugmeta nema, ništa ne puca — isti obrazac koji `EmailPort` već koristi.
Ključevi se prave jednom (`npx web-push generate-vapid-keys`) i **ti ih dodaješ na Railway**.

### 3.4 Ovo se ne može dokazati bez telefona

Sve do isporuke se testira i meri; **da obaveštenje stvarno stigne na zaključan ekran može da
potvrdi samo čovek sa telefonom u ruci.** To je jedina stvar u ovom koraku koju ne mogu da izmerim.

---

## 4. Model

### 4.1 Migracija `0056` — `push_subscriptions`

| kolona | šta je |
| --- | --- |
| `id` | uuid PK |
| `user_id` | FK → `users(id)` **ON DELETE CASCADE** — nalog se gasi, pretplate idu s njim |
| `endpoint` | text **UNIQUE** — adresa koju je pregledač dobio od svog push servisa |
| `p256dh`, `auth` | text, ključevi tog pregledača za šifrovanje tela |
| `user_agent` | text NULL — ime uređaja u spisku iz §7.4 |
| `mode` | text + CHECK `('all','mentions','no_text')`, default `'all'` |
| `created_at` | timestamptz |

Indeks na `user_id` (razašilj čita po korisniku), UNIQUE na `endpoint`.

⚠ **Nema `last_seen_at`.** Prva verzija ga je imala i **ništa ga nije ni pisalo ni čitalo** — kolona
koju niko ne dodiruje je obećanje u koje će sledeći čovek poverovati. Rast je i tako mali (pretplata
nastaje samo svesnim uključivanjem, a zamenjenu pregledač prijavi kao 410).

⚠ **`endpoint` je jedinstven GLOBALNO, ne po korisniku.** Isti pregledač na istom uređaju daje istu
adresu; ako se na njemu prijavi drugi čovek, pretplata mora da **pređe** na njega, ne da se udvoji —
inače stari korisnik i dalje dobija tuđe poruke na uređaj koji više nije njegov. Upis je zato
`ON CONFLICT (endpoint) DO UPDATE`.

### 4.2 Prekidač je po ČOVEKU, iako red stoji po uređaju

`mode` stoji na redu pretplate, ali ga endpoint menja **za sve redove tog korisnika odjednom** —
jer je Nikolina odluka „prekidač po čoveku", ne po uređaju. Kolona je tu jer red već postoji i
jedno mesto je dovoljno; ⚠ **ne praviti drugu tabelu za jedno polje.**

---

## 5. Kome se šalje

Za svaku novu poruku, redom:

```
ljudi koji smeju da vide sobu   (listPeopleFor — postoji, test-pokriveno)
− autor                          (nikad sebi)
− oni koji su utišali sobu       (chat_mutes — postoji)
× njihove pretplate              (push_subscriptions)
× njihov mode
```

| mode | dobija |
| --- | --- |
| `all` | svaku poruku: „Ime · Soba" + početak teksta |
| `mentions` | samo poruke koje ga imenuju |
| `no_text` | svaku poruku, ali **bez teksta**: samo „Nova poruka · Soba" |

⚠ **`chat_mutes` se poštuje.** Utišana soba je već obećanje da neće da smeta; push koji ipak
stigne bi to obećanje pogazio na najgoroj mogućoj površini — na zaključanom ekranu.

### 5.1 DND i „ne zvoni dok gledam baš taj razgovor" — dve odluke koje su ispale

Spec od 23.08. §10 beleži **četiri** pravila isporuke: ne zvoni sebi · ne zvoni za utišanu nit ·
**poštuje se DND** · **ne zvoni dok gledaš baš taj razgovor**. Prve dve su gore; druge dve su iz
prve verzije ovog spec-a ispale bez reči — što je gore od svesnog izostavljanja.

**DND je danas prekidač U PREGLEDAČU**, `localStorage` ključ `mrr:internal:chat:dnd`
(`chat-dnd.ts:11`). ⚠ Ni server ni `sw.js` ga **ne mogu pročitati**: Web Storage postoji samo na
`Window`, a service worker ga nema uopšte. DND kakav jeste ne stiže do telefona sam od sebe.

**Predlog (Nikola može da obori):** kad se DND uključi, upisati ga i u **IndexedDB**, koji service
worker ume da čita, pa `sw.js` ćuti dok je DND upaljen. Time DND znači ono što piše, uključujući i
telefon, i ostaje **po uređaju** — što je i tačno: telefon u džepu ćuti, računar na stolu ne mora.
Alternativa je da DND postane serverski, ali to menja zatečenu funkciju i pravi dva prekidača za
istu stvar.

**„Ne zvoni dok gledam baš taj razgovor"** se rešava u samom `sw.js`:
`clients.matchAll({ type: 'window', includeUncontrolled: true })`, pa ako je neka otvorena kartica
vidljiva (`visibilityState === 'visible'`) i njen URL nosi `razgovor=<id>` — obaveštenje se ne crta.
Bez toga telefon zuji dok čovek gleda tu istu sobu na računaru.

⚠ **Telo poruke ne putuje u `no_text` režimu** — to je cela svrha tog položaja: telefon na stolu
pokazuje da nešto ima, a ne šta piše.

---

## 6. Kako se šalje

`PushPort` u `core/ports/` (modul ne sme da uvozi modul), isti obrazac kao `NotificationsPort`:
**best-effort, nikad ne odbija** — obaveštenje nije vredno pada poruke koju opisuje.

Zove se sa **istog mesta gde i `announce()`** u `ChatService.send`, i to tek kad je `created === true`.

### 6.0 Tri opcije koje se NE smeju izostaviti

```ts
void this.push
  .notifyChatMessage(…)
  .catch((err) => this.logger.error({ err }, 'chat push failed'))
```

⚠ **`.catch()` nije uljudnost nego uslov da proces preživi.** Node 24 podrazumevano radi
`--unhandled-rejections=throw`, a ovaj API **nema globalni `unhandledRejection`** (`server.ts` hvata
samo SIGTERM/SIGINT) — jedno odbijeno slanje obara ceo servis. Presedan je u repou:
`client-submissions.service.ts:111`.

```ts
sendNotification(sub, payload, { timeout: 5000, TTL: 3600, topic: shortTopic(conversationId) })
```

- ⚠ **`timeout`** — `web-push` ga podrazumevano NE postavlja, a ni Node-ov `https.request`. Push
  servis koji prihvati vezu pa zaćuti drži utičnicu dok se TCP keepalive ne preda: **dva sata**. To
  je tačno onaj oblik „stepenice u memoriji" koji Railway beleške već opisuju, a memorija je 86%
  računa.
- ⚠ **`TTL`** — podrazumevano je **četiri nedelje** (`DEFAULT_TTL = 2419200`). Telefon ugašen preko
  noći ujutru bi dobio celo jučerašnje ćaskanje, redom. Jedan sat je koliko poruka iz sobe vredi.
- ⚠ **`topic`** (RFC 8030 §5.4) — sabija poruke **u redu push servisa**, dok `tag` sabija tek ono
  što je već stiglo na uređaj. Ograničen je na **32 base64url znaka**, a uuid razgovora bez crtica
  je tačno 32.

### 6.1 Mrtva pretplata se briše, i to je obavezno

Push servis vraća **404 ili 410** za pretplatu koja više ne postoji (čovek obrisao aplikaciju,
pregledač je odbacio). ⚠ Taj red se **briše odmah**, inače tabela zauvek raste i svaka poruka plaća
zahtev koji ne može da uspe. Svaki drugi status se loguje i ostavlja.

### 6.2 Cena po poruci — izmeriti pre nego što se pusti

Jedna poruka u sobi od 20 ljudi je do 20 HTTPS zahteva. ⚠ Ovo je **jedina stvar u koraku koja može
da opterezi API**, i mora se izmeriti na stvarnom broju pretplata pre nego što se pusti u pogon.
Ako zasmeta, red je: prvo `Promise.allSettled` u paketima, pa tek onda red čekanja — **ne uvoditi
red čekanja unapred.**

---

## 7. Pregledač

### 7.1 Service worker: `apps/internal-web/public/sw.js`

Statičan fajl, bez koraka u buildu. Radi tačno dve stvari:

- `push` → `showNotification(naslov, { body, icon, tag, data: { conversationId } })`
  ⚠ **`tag` je id razgovora**: deset poruka iz iste sobe zamenjuju jedna drugu umesto da naslažu
  deset redova na zaključanom ekranu.
- `notificationclick` → fokusira otvorenu karticu ako postoji, inače otvara
  `/razgovori?razgovor=<id>` (N5: klik vodi **u taj razgovor**, prečica vodi na Početnu).

### 7.2 Manifest: `apps/internal-web/public/manifest.webmanifest`

`start_url: '/'` (N5), `display: 'standalone'`, ikonice koje već postoje, boje iz `--mri-*`.

### 7.3 Prekidač na ekranu

Pored DND-a u zaglavlju liste razgovora — tamo čovek i misli o obaveštenjima. Četiri stanja:

| stanje | šta se vidi |
| --- | --- |
| pregledač ne ume push | ništa (nema šta da se ponudi) |
| iOS, nije dodato na početni ekran | rečenica **zašto** dugmeta nema (§3.1), ne ćutanje |
| nije dozvoljeno / nije pretplaćen | dugme „Uključi obaveštenja" |
| pretplaćen | tri položaja: sve · samo pomeni · bez teksta |

### 7.4 Spisak uređaja

Ispod prekidača, kad je čovek pretplaćen: red po uređaju (`user_agent`) i ✕ koji tu pretplatu skida.
⚠ **To je jedini razlog zašto `user_agent` uopšte stoji u tabeli** — bez ovog spiska on je prikupljen
podatak bez ijednog čitaoca. Uz to je jedino mesto gde čovek sam skida tablet koji više ne koristi,
umesto da se čeka da push servis vrati 410.

⚠ **Nikad ne tražiti dozvolu sam od sebe pri učitavanju.** Pregledači to kažnjavaju trajnim
odbijanjem, a čovek koji je jednom odbio ne može da se predomisli iz aplikacije.

---

## 8. Šta se NE radi

- Push za portal (klijent nema čet).
- Push za bilo šta osim čet poruke — zvono i dalje nosi svoje.
- Red čekanja / radnik u pozadini (§6.2).
- Grupisanje više poruka u jedno obaveštenje preko `tag`-a (to `tag` već radi po sobi).
- Prekidač po sobi. Za to postoji `chat_mutes` i on se poštuje.

---

## 9. Zamke

1. **`endpoint` je jedinstven globalno** (§4.1) — bez toga uređaj sa dva naloga šalje tuđe poruke.
2. **404/410 znači obriši** (§6.1) — bez toga tabela raste zauvek.
3. **iOS bez „Add to Home Screen" nema `Notification` uopšte** — kod koji to ne proveri baca grešku
   pri samom crtanju ekrana.
4. **Service worker se kešira agresivno.** Promena `sw.js` mora da se vidi; `updateViaCache: 'none'`
   pri registraciji.
5. **`tag` bez `renotify`** zameni obaveštenje **nečujno** — što je ovde tačno ono što se hoće za
   drugu poruku iz iste sobe, ali treba znati da je namerno.
6. **Ključevi u env-u su opcioni** — jedan test mora da dokaže da bez njih ništa ne puca.
7. **Push se šalje samo za `created === true`** — ponovljen `client_msg_id` ne sme da zvoni dvaput.
8. **Utišana soba ne šalje** (§5).
9. **Bez `.catch()` na razašilju Node 24 obara proces** (§6.0) — ovaj API nema globalni hvatač.
10. **Bez `timeout`-a jedna zaglavljena veza drži utičnicu dva sata** (§6.0).
11. **Bez `TTL`-a telefon ujutru dobije celo jučerašnje ćaskanje** (§6.0).
12. **`localStorage` ne postoji u service worker-u** — DND mora kroz IndexedDB (§5.1).

---

## 10. Redosled izrade

| # | Šta | Dokaz |
| --- | --- | --- |
| P1 | migracija `0056` + `PushSubscriptionMode` u `@mr/shared` | migracija od nule; neprijateljski red pada na CHECK |
| P2 | `env.ts` + `PushPort` + no-op bez ključeva | test: bez ključeva slanje ne puca i ne šalje |
| P3 | endpoint za pretplatu/odjavu/prekidač — **iza `INTERNAL_APP_PERMISSIONS`**, ista vrata kao ceo čet modul, bez nove dozvole | isti `endpoint` sa drugim nalogom **prelazi**, ne udvaja |
| P4 | razašilj iz `ChatService` | autor ne dobija; utišana soba ne dobija; `mentions` dobija samo pomen; `no_text` ne nosi telo |
| P5 | brisanje mrtve pretplate na 404/410 | red nestane posle odbijenog slanja |
| P6 | `sw.js` + manifest + registracija | build prolazi, `sw.js` se servira |
| P7 | prekidač na ekranu, sva četiri stanja + spisak uređaja (§7.4) | test po stanju; iOS grana se ne crta kao dugme; ✕ skida baš tu pretplatu |
| P8 | DND kroz IndexedDB + „ne zvoni dok gledam tu sobu" (§5.1) | SW ćuti kad je DND upaljen i kad je ta soba vidljiva u otvorenoj kartici |

Svaki red se završava komitom, uz **pun gejt zelen** i `TZ=UTC`.

---

## 11. Posle deploja

- **Migracija ide sama** (`db:migrate:deploy`).
- **Nova dozvola se ne uvodi → `db:seed` NE treba.**
- ⚠ **Nikola dodaje `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` i `VAPID_SUBJECT` na Railway.** Dok ih
  nema, push je ugašen i ekran ga ne nudi.
- ⚠ **Prijemna proba traži telefon** (§3.4).
