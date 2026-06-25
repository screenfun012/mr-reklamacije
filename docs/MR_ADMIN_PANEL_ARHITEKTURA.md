# MR Admin Panel — Arhitektonski plan

**Verzija:** 1.0
**Autor:** Arhitektura (Claude) za Nikolu Dinića / MR Engines
**Status:** Plan pre koda — referentni dokument za Cursor
**Stack:** Turborepo monorepo · TanStack Start · Hono API · PostgreSQL/Drizzle · Better-Auth · Tailwind v4 · shadcn/ui

---

## 1. Vizija i cilj

Admin panel (`apps/admin-web`, port `:3001`) je **centralni kontrolni alat samo za admina**. Cilj: nikada ne dirati kod za rutinske izmene. Sve što postoji u internom delu (`:3002`) i portal delu (`:3003`) mora biti upravljivo iz admina — katalozi, statusi, korisnici, permisije, reklamacije, logovi.

Princip: **admin panel ne sme da bude bloat.** Svaki modul ima jasnu svrhu i definisano "gotovo". Bez preklapanja, bez koda koji ništa ne radi, bez stvari koje usporavaju aplikaciju. Struktura iznad svega.

### Vodeći principi (senior pristup)
1. **Jedan generički "resource" obrazac** — katalozi (proizvođači, tipovi motora, izvori, radnici, statusi) dele JEDAN obrazac (lista + dodaj + izmeni + ukloni). Novi katalog = ~10 minuta, ne novi modul. Ovo je srce fleksibilnosti.
2. **RBAC iz jednog mesta** — permisije već postoje (`packages/shared/src/permissions.ts`). Admin ih proširuje i dodeljuje, ne kopira logiku.
3. **Svaki modul je upotrebljiv ODMAH** — posle svake faze imaš radni alat koji raste. Nikad "pola-završeno ništa".
4. **Sigurnost prvo** — admin akcije (otključavanje, brisanje, permisije) su zaštićene i logovane. Admin ne sme slučajno sebi da oduzme pristup.

---

## 2. Ključni tehnički nalaz: cross-app real-time sync

**Zahtev:** izmena u admin delu (npr. dodaš proizvođača) → odmah vidljiva u internom/portal delu, bez hard reload-a.

### Šta NE radi (istraženo)
`broadcastQueryClient` (TanStack Query) radi **samo unutar istog origin-a** (protokol+host+port). Naše app su na različitim portovima (`:3001`, `:3002`, `:3003`) = **različiti origin-i**. Pa `BroadcastChannel` NE sinhronizuje između admin i interne app direktno. (Radi samo između tabova ISTE app — npr. dva taba interne app.)

### Pravo rešenje — SSE od starta (radimo kako treba)

Pošto gradimo vrhunski alat od starta, ne pravimo kompromis "refetch on focus pa SSE kasnije". Idemo na **pravi real-time od početka.** Ključno: stack već IMA sve potrebno, nula novih teških biblioteka (= nula bloat-a u pravom smislu).

**Šta već imamo u stacku (istraženo):**
- **Hono `streamSSE`** — ugrađen helper za Server-Sent Events. Backend šalje event "resource changed" svim povezanim klijentima. Nije dodatna biblioteka — deo Hono-a koji već koristimo.
- **TanStack `streamedQuery`** — radi sa AsyncIterable/stream, prirodno prima SSE event-ove i ažurira keš. Deo TanStack Query koji već koristimo.

**Arhitektura real-time sync-a (tri sloja, svi koriste postojeći stack):**

**Sloj 1 — Unutar iste app (instant):**
`invalidateQueries` na mutaciju. Admin izmeni → njegova app odmah osveži. Već koristimo (`invalidateStatisticsSummary`).

**Sloj 2 — Između tabova ISTE app (besplatno):**
`broadcastQueryClient` (BroadcastChannel) — dva taba interne app sinhronizovani. Radi jer isti origin.

**Sloj 3 — Između RAZLIČITIH app-ova (admin → interna/portal) — PRAVI SSE:**
Pošto su različiti origin-i (portovi), SSE preko Hono-a:
1. **Hono SSE endpoint** `/api/events/me` — svaki app (interna, portal) se konektuje pri startu, drži otvorenu konekciju
2. **Admin mutacija** (npr. dodaš proizvođača) → API upiše u bazu → **emituje SSE event** `{ type: 'resource.changed', resource: 'manufacturers' }` svim povezanim klijentima
3. **Interna/portal app** prima event → `invalidateQueries(['manufacturers'])` → **instant refetch, bez ikakvog reload-a, bez focusa**
4. Operater koji baš gleda formu vidi novi proizvođač da "uskoči" u dropdown u realnom vremenu

**Zašto je ovo pravo, ne bloat:**
- Hono `streamSSE` + TanStack `streamedQuery` su VEĆ u stacku — ne uvozimo ništa novo
- SSE je lakši od WebSocket-a (jednosmeran server→klijent, tačno što nam treba — server javlja "promenjeno", klijent refetuje)
- Jedan SSE endpoint pokriva SVE resurse (event nosi `resource` polje) — ne pravimo endpoint po katalogu
- Konekcija je jeftina (jedan keep-alive po app tabu), `onAbort` čisti pri disconnect-u

**Event bus pattern (server strana):**
```
Admin mutacija → AdminService → emitResourceChanged('manufacturers')
                                      ↓
                          In-memory event emitter (Node EventEmitter)
                                      ↓
              streamSSE konekcije (interna, portal) → writeSSE event
                                      ↓
              Klijent EventSource → queryClient.invalidateQueries
```
Za jedan server (trenutno stanje) — Node `EventEmitter` je dovoljan, nula infrastrukture. Ako jednog dana skaliramo na više instanci API-ja, zamenjujemo emitter sa Redis pub/sub (ista šema, drugi transport) — ali to NE gradimo sad (bilo bi bloat dok imamo jedan server).

**Alternativa razmotrena i odbačena:** WebSocket (preteško — dvosmerno nam ne treba), polling (trošenje resursa), refetchOnFocus (radi ali nije "vrhunski" — operater mora da klikne tab). SSE je tačka preseka: pravi real-time, lak, već u stacku.

---

## 3. Generički Resource obrazac (srce fleksibilnosti)

Umesto da pišemo zaseban CRUD za svaki katalog, definišemo **jedan obrazac** koji svi katalozi koriste. Ovo je razlika između "100x boljeg alata" i kopiranog koda.

### Koncept
```
ResourceDefinition<T> = {
  key: 'manufacturers' | 'engineTypes' | 'sources' | 'employees' | 'statuses' | ...
  label: 'Proizvođači'
  apiBase: '/api/admin/manufacturers'
  columns: [{ key, label, sortable }]
  formFields: [{ key, label, type, validation }]
  permissions: { view, create, update, delete }
}
```

### Šta to omogućava
- **Jedna generička stranica** `ResourceListPage` renderuje listu BILO kog kataloga iz definicije
- **Jedna generička forma** `ResourceForm` renderuje dodaj/izmeni iz `formFields`
- **Jedan generički hook** `useResourceCrud(definition)` radi sve mutacije + invalidaciju
- Novi katalog = dodaš `ResourceDefinition` (10 min), NE pišeš nov modul

### Granica (da ne postane preopšte)
Generički obrazac pokriva **proste kataloge** (entitet sa poljima, CRUD). Složeni moduli (RBAC matrica permisija, manipulacija reklamacijama, logovi) su **namenski** — ne forsiramo ih u generiku. Senior pravilo: generika za ono što se ponavlja, namenski za ono što je jedinstveno.

---

## 4. Moduli admin panela (sve što treba da bude upravljivo)

Iz analize interne app, ovo su entiteti/akcije koje admin mora da kontroliše:

| # | Modul | Tip | Šta radi |
|---|---|---|---|
| 1 | **Proizvođači** | Katalog (generik) | CRUD nad proizvođačima (BMW, Mercedes…) |
| 2 | **Tipovi motora** | Katalog (generik) | CRUD nad tipovima (OM651, N47…) |
| 3 | **Izvori** | Katalog (generik) | CRUD nad izvorima (SELMAN, VITOBELLO…) |
| 4 | **Firme** | Katalog (generik) | CRUD nad firmama (klijenti emotive) |
| 5 | **Radnici** | Katalog (generik) | CRUD nad radnicima (sklapači motora) |
| 6 | **Statusi reklamacija** | Katalog (generik+) | Custom statusi — dodaj/izmeni/ukloni, boje |
| 7 | **Operateri (korisnici)** | Namenski | Upravljanje korisnicima interne app |
| 8 | **Role + Permisije** | Namenski (RBAC) | Matrica ko sme šta (kao Strapi) |
| 9 | **Admin akcije nad reklamacijama** | Namenski | Otključavanje, manipulacija koju operater ne sme |
| 10 | **Logovi (audit)** | Namenski (read) | Ko je šta menjao, istorija |
| 11 | **Portal korisnici (klijenti)** | Namenski | Praćenje klijenata koji gledaju svoje reklamacije |

---

## 5. Redosled faza (svaka daje upotrebljiv alat)

### FAZA 0 — Temelj (engine) — ✅ DOKAZANO (2026-06)
**Cilj:** infrastruktura koja čini sve module laganim + real-time sync.
- **Admin API namespace** `/api/admin/*` — odluka odložena za Fazu 1; F0 koristi postojeće module (`/api/engine-types`)
- **Generički Resource engine** — `ResourceDefinition`, `ResourceListPage`, `ResourceFormDialog`, `useResourceCrud` u `admin-web`. Engine-manufacturers ostaje namenski (referenca). **Engine types** = prvi generic katalog (`/settings/engine-types`).
- **Lifecycle (engine types):** `PATCH isActive` za deaktivaciju **i reaktivaciju**; `DELETE` samo kad `usageCount = 0` (409 inače). UI: toggle-active dijalog + hard-delete (Trash, disabled + tooltip kad je usage > 0). SSE `resource_changed` na sve mutacije.
- **Admin list UX (katalozi, ~60–200 redova):** pun fetch preko `fetchAllReferencePages`, zatim **client-side** pretraga (debounce 300ms), filter Svi/Aktivni/Neaktivni, paginacija 10/25/50 — URL sync (`?page=&pageSize=&q=&status=`). Deljeni `ListPagination` u `@mr/ui`, `useDebouncedValue` u `@mr/shared`, `ResourceCatalogSearchSchema` u `@mr/shared`.
- **SSE proširen** (nije gradio od nule): `InProcessEventBus` + `/api/events/me` + `resource_changed` u `AppEvent` union + emit iz engine-types mutacija + `EventSource` u `internal-web` (`useRealtimeEventStream` → `invalidateQueries`). **Odluka:** zadržati `/api/events/me` (nema `/api/events/stream` alias-a).
- **Gotovo:** browser test — admin doda tip motora → interni dropdown osvežen instant bez F5; reaktivacija istim SSE lancem; hard delete samo za usage=0.

### FAZA 1 — Katalozi (moduli 1-5) — prvi upotrebljiv alat
**Cilj:** dodaješ/menjaš proizvođače, tipove motora, izvore, firme, radnike iz UI.
- Svaki katalog = jedna `ResourceDefinition` (zahvaljujući Fazi 0)
- Admin API: CRUD endpointi per katalog (ili generički `/api/admin/:resource`)
- **Gotovo kad:** svih 5 kataloga radi (lista/dodaj/izmeni/ukloni), izmene se vide u internoj app (refetch on focus)
- **Najveća vrednost za najmanje muke** — rešava tvoju svakodnevnu bolnu tačku ("dođe novi radnik")
- **Bonus:** statistika "Po tipu motora" prestaje da pokazuje ENG kodove kad uneseš prave tipove

### FAZA 2 — Custom statusi reklamacija (modul 6) — ⚠️ VELIKA MIGRACIJA, NE mala faza
**Realnost (potvrđeno):** statusi su hardkodovan enum (4 vrednosti) na 6 mesta: TS tip (`ClaimOutcome`), DB CHECK constraint, UI registry (`OUTCOME_REGISTRY`), `claim-lock.ts` logika, Excel, statistika. Pravi custom statusi znače:
- Nova tabela `claim_statuses` + migracija postojećih redova
- Uklanjanje CHECK constraint-a
- Refaktor `ClaimOutcome` (union → string FK)
- `OUTCOME_REGISTRY` → dinamički iz API-ja
- Refaktor `claim-lock.ts` (koja stanja locked, koje tranzicije)
- Excel/statistika/filteri — sve koristi outcome
- i18n za labele iz baze

**Odluka:** ovo je ZASEBAN veliki projekat, ne "popuni admin UI". Razmotriti **međukorak:** admin upravlja samo boje/labele postojeća 4 outcome-a (bez dodavanja novih kodova) — to je malo. Pun custom statusi (dodavanje novih) = posebna migraciona faza, planirati zasebno kad MVP kataloga radi.

### FAZA 3 — Operateri + Role + Permisije (moduli 7-8) — RBAC
**Realnost:** tabele postoje, ali nema API ruta za `users.*`/`roles.*`. Treba NOV modul (service→repo→controller) + admin UI matrica.
**Cilj:** upravljaš ko ima pristup i šta sme.
- Lista operatera, kreiranje (kontrolisano preko Better-Auth + dodela `user_roles` + audit), deaktivacija
- **RBAC matrica** (kao Strapi): resurs × akcija čekboksovi — SAMO za custom role (sistem role se ne edituju, pravilo u kodu)
- **ZAŠTITA:** admin ne sme sebi da oduzme admin — guard u SERVISU, ne samo UI
- **SSE:** `permissions_changed` event → invalidacija sesija operatera kojima si promenio prava
- **Gotovo kad:** menjaš permisije custom role, promene se primenjuju u internoj app (real-time preko SSE)

### FAZA 4 — Admin akcije nad reklamacijama (modul 9)
**Realnost:** logika VEĆ postoji u API-ju (`claim-lock.ts`, reopen je admin-only). Admin claims modul u `:3001` = **tanak wrapper** oko postojećih API-ja, ne nova logika.
**Cilj:** otključavaš/manipulišeš reklamacijama iz admin panela (umesto iz interne app kao admin).
- **Gotovo kad:** admin claims stranice u `:3001` rade (lista + reopen + restore + admin akcije), koriste postojeće API-je

### FAZA 5 — Logovi / Audit (modul 10)
**Realnost:** audit log delimično postoji (login-audit, export audit, manufacturers audit). Proširiti emit + prikazati.
**Cilj:** vidiš ko je šta menjao.
- Read-only modul (lista + filteri)
- **Gotovo kad:** vidiš istoriju sa filterima

### FAZA 6 — Portal korisnici (modul 11)
**Realnost:** portal je skeleton; `client_registration_requests` tabela postoji, nema UI/approval API. Klijent je first-class RBAC.
**Cilj:** pratiš/odobravaš klijente.
- **Gotovo kad:** vidiš/upravljaš portal klijentima + registration queue (approve/reject)

---

## 6. Šta već postoji (STVARNO STANJE — potvrđeno od Cursora)

Cursor je pregledao kod i potvrdio tačno stanje (ne pretpostavke):

### Radi i gotovo
- `apps/admin-web` skeleton: layout, sidebar, topbar, login (Better-Auth + 2FA), admin-only guard (`adminRequireRoles(['admin'])`)
- **Engine manufacturers — POTPUN CRUD** (`/api/engine-manufacturers`): namenski admin modul (referenca, ne migriran u generic).
- **Engine types — POTPUN CRUD** (`/api/engine-types`): PATCH (ukl. `isActive` toggle) + **hard delete** (usage guard) + audit; admin UI preko **generičkog engine-a** (`/settings/engine-types`) sa lifecycle + client-side list UX.
- **SSE:** Hono `/api/events/me` (streamSSE, heartbeat 20s, auth), `InProcessEventBus`, claim event-ovi + **`resource_changed`** (F0). `internal-web` sluša preko `EventSource` i invalidira query keš. CORS nije problem — Vite proxy čini `/api/**` same-origin.

### Placeholderi (ruta + guard postoje, prazan sadržaj)
`/` (dashboard), `/emotive-claims`, `/domace-claims`, `/users` — konzistentan pattern (AdminShell + Heading + placeholder), dobra osnova za generic resource page.

### Katalozi — stvarno stanje API CRUD-a (KRITIČNO za Fazu 1)
| Resurs | list | create | update | delete |
|---|---|---|---|---|
| Engine manufacturers | ✅ | ✅ | ✅ | ✅ soft |
| Engine types | ✅ | ✅ | ✅ | ✅ hard (usage=0) |
| Claim sources | ✅ | ❌ | ❌ | ❌ |
| Employees | ✅ | ❌ | ❌ | ❌ |
| Customers (firme) | ✅ | ❌ | ❌ | ❌ |
| Departments | ✅ | ❌ | ❌ | ❌ |
| External parties | ✅ | ✅ | ❌ | ❌ |

**Implikacija:** većina kataloga ima samo `list`. Faza 1 mora da **doda create/update/delete** u API za svaki, ne samo UI. Permisije u `permissions.ts` već predviđaju pun CRUD (katalog spreman), ali rute fale.

### Nema `/api/admin/*` namespace
Sve je pod postojećim modul putanjama. Faza 0 odluka: uvesti `/api/admin/*` wrapper ILI generic engine obavija postojeće module.

### RBAC — hibrid (kod + baza)
- Katalog permisija u `permissions.ts` (izvor istine)
- Sistem role (admin/operator/viewer/client) — hardkodovani setovi; **admin ima bypass** (uvek pun pristup, sprečava lock-out)
- Custom role — permisije iz DB (`role_permissions`)
- Tabele postoje (`permissions`, `roles`, `role_permissions`, `user_roles`), ali **nema API ruta za `roles.*`/`users.*`** ni admin UI matricu
- Session enrichment + cache TTL 5 min

### Reklamacije — admin granica VEĆ u API-ju
- `claim-lock.ts` centralizuje: editabilno samo dok `pending`; `accepted/rejected` → locked
- **Reopen (otključavanje)** = admin-only permisija (`emotive_claims.reopen`), nije u OPERATOR_PERMISSIONS
- Admin akcije nad claim-ovima VEĆ rade u internal-web kad si ulogovan kao admin (ista API, ista sesija)
- **Implikacija:** admin claims modul = tanak wrapper oko postojećih API-ja, logika već postoji

### Portal (:3003) — skeleton
- Klijent je first-class RBAC koncept (`CLIENT_PERMISSIONS`, row-level scope po customer-u)
- `client_registration_requests` tabela postoji, ali nema registracioni UI ni approval API
- Samo welcome + login rade

---

## 7. Pitanja za Cursor — šta je moguće, šta zahteva izmenu

Pre koda, Cursor mora da potvrdi (jer on vidi kod, mi ne):

1. **Admin app stanje:** Koje rute/stranice `admin-web` već ima? Šta je placeholder, šta radi? Da li admin login + admin-only guard postoje?
2. **Katalog tabele:** Da li sve katalog tabele (manufacturers, engineTypes, sources, firme, employees) imaju potpune CRUD mogućnosti u API-ju, ili samo read? Šta fali za create/update/delete?
3. **Statusi:** Kako su statusi reklamacija trenutno implementirani — hardkodovan enum ili tabela? Ako je enum, **custom statusi zahtevaju migraciju** (enum → tabela). Ovo je verovatno najveća izmena. Potvrdi.
4. **Operateri/korisnici:** Better-Auth korisnici — kako se kreiraju/menjaju? Da li admin može da kreira korisnika preko API-ja?
5. **RBAC:** Kako su permisije trenutno dodeljene korisnicima (hardkodovano po roli, ili u bazi)? Za dinamičke permisije iz admina, gde se čuvaju?
6. **Admin akcije nad reklamacijama:** "Otključavanje" — postoji li koncept zaključane reklamacije? Šta operater NE sme što admin sme? Gde je ta granica u kodu?
7. **Cross-app real-time (SSE):** ✅ Potvrđeno — `/api/events/me` + `InProcessEventBus` + `EventSource` u internoj app; Vite proxy omogućava same-origin konekciju.
8. **Rute koje smo "ostavili":** Spomenuli smo da su neke rute/putanje ostavljene za kasnije. Koje su to u admin app? Da li su spremne za popunjavanje?
9. **Portal app:** Šta `:3003` trenutno ima? Da li su portal korisnici (klijenti) zaseban tip naloga?

**Cursor: odgovori na ovih 9 pre nego što napišemo PRE-CHECK za Fazu 0.** Cilj je da znamo šta je "samo popuni" a šta "zahteva migraciju/izmenu da bi delovi komunicirali".

---

## 8. Šema komunikacije (vizuelno)

```
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN PANEL (:3001)                      │
│  Katalozi · Statusi · Operateri · RBAC · Logovi · Portal     │
│         ↓ mutacija (create/update/delete)                    │
│  invalidateQueries (ista app — instant)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ piše u + emituje event
                           ▼
              ┌────────────────────────────┐
              │   Hono API (:3000)         │
              │   /api/admin/* (namespace) │
              │   + RBAC guard po akciji   │
              │   + EventEmitter bus       │
              │   + streamSSE endpoint     │◄──── /api/events/me
              └────────────┬───────────────┘      (keep-alive konekcije)
                           │ čita iz            
                           ▼                       │ SSE push
              ┌────────────────────────────┐       │ "resource.changed"
              │   PostgreSQL (Drizzle)     │       │
              │   katalozi · korisnici ·   │       ▼
              │   permisije · statusi      │  ┌─────────────────────┐
              └────────────────────────────┘  │   EventSource       │
                                              │   slušaju interna   │
         ┌────────────────────────────────────┤   + portal app      │
         ▼                                     └─────────┬───────────┘
┌──────────────────┐              ┌──────────────────┐  │
│ INTERNA (:3002)  │              │  PORTAL (:3003)  │  │ na event:
│ EventSource →    │◄─────────────│ EventSource →    │◄─┘ invalidateQueries
│ invalidateQueries│   SSE push   │ invalidateQueries│   → INSTANT refetch
│ → INSTANT refresh│              │ → INSTANT refresh│   (bez reload, bez
│   (real-time)    │              │   (real-time)    │    focusa)
└──────────────────┘              └──────────────────┘

Stack: Hono streamSSE (server) + EventSource/streamedQuery (klijent)
       Sve VEĆ u stacku — nula novih biblioteka.
```

---

## 9. Šta NEĆEMO raditi (anti-bloat — pravo značenje)

"Bloat" = uvlačiti teške biblioteke za malu korist, ili graditi infrastrukturu pre nego što treba. NE znači "ne pravi prave feature-e". Radimo kako treba, ali pametno:

- **Nećemo uvoziti nove teške biblioteke** kad stack već ima rešenje — SSE preko Hono `streamSSE` + TanStack `streamedQuery` (već u stacku), ne dodajemo Socket.io/Pusher/Ably ako ne moramo
- **Nećemo Redis pub/sub sad** — Node `EventEmitter` je dovoljan za jedan API server. Redis tek ako skaliramo na više instanci (ista šema, drugi transport). Graditi Redis sad = bloat.
- **Nećemo WebSocket** — dvosmerna komunikacija nam ne treba; SSE (jednosmeran server→klijent) je tačno dovoljan i lakši
- **Nećemo generički obrazac forsirati na složene module** (RBAC matrica, logovi) — oni su namenski
- **Nećemo sve module odjednom** — faza po faza, svaka upotrebljiva
- **Nećemo duplirati permisije logiku** — jedan izvor istine
- **Nećemo dirati internu/portal app više nego što treba** — samo SSE listener + tačke integracije

Princip: **pravo rešenje sa postojećim alatima.** Real-time DA (jer radimo kako treba), ali kroz ono što stack već nudi, ne kroz gomilu novih zavisnosti.

---

## 10. Sledeći korak

1. **Cursor odgovara na 9 pitanja iz sekcije 7** (šta je moguće, šta zahteva izmenu)
2. Na osnovu odgovora → **PRE-CHECK za Fazu 0** (temelj: admin API namespace, permisije, generički resource engine, cache strategija)
3. Faza 0 → Faza 1 (katalozi) → … fazno, commit po commit, browser test, CI repro pre push — isti dokazani workflow kao statistika

**Workflow pravila (kao za statistiku):**
- PRE-CHECK pre koda, STOP na greškama, fix root cause
- Commit po commit (ne 60 fajlova odjednom)
- Browser verifikacija pre push
- PUN CI repro lokalno pre push (clean install, paraglide regen, turbo test --force)
- Cursor commituje kad gate-ovi zeleni, Nikola pushuje preko GitHub Desktop
