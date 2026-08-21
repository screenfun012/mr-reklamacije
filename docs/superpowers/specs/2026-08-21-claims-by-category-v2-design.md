# Reklamacije po kategorijama — V2 (dizajn)

**Status:** predlog v2, čeka Nikolin pregled · **Datum:** 21.08.2026 · **Aplikacije:** `internal-web` + `admin-web` + `api` + `db`

**Izvori istine, po prvenstvu:**

1. **izgled i ponašanje:** `design_handoff_claim_categories/kategorije-prototip.dc.html` — **svetinja.** Vrednosti se ČITAJU iz fajla (servirati folder preko HTTP-a, `support.js` je pored), nikad ne procenjuju;
2. **odluke vlasnika:** `docs/design-handoffs/2026-08-21-kategorije-prototype-handoff.md` §0 (sedam odluka) + §2 ovog dokumenta;
3. **funkcija i podaci:** `docs/design-handoffs/2026-08-21-reklamacije-kategorije-handoff.md` + postojeći kod.

**Pravilo spajanja (Nikola, 21.08.):** ne bira se prototip _ili_ postojeće — **spajaju se.** Sve što mi imamo, a prototip ne crta, **ostaje**. Sve što prototip ima, a mi nemamo, **dodaje se**. Gde se razlikuju samo po mestu ili izgledu — prototip pobeđuje. Gde nešto nije pokriveno ni jednim ni drugim — **pitati, ne improvizovati.**

---

## 1. Cilj i okvir

**Problem** (Nikolinim rečima): „Ja sada hoću da unesem novu reklamaciju za mašinsko — kako ja to da uradim? … neću sigurno da idem ovim redosledom, nego ću lepo kao normalan čovek: aha, mašinsko, kliknem, šta ima tu, dobro, idemo, popunjavam."

**Zašto mu se prototip sviđa** (njegove reči, 21.08. kasnije): „lakše možemo da dodajemo šta nam treba iz šifarnika — glavu, deklo, karter, šta god — i onda lakše izvlačimo statistiku: ko je radio, ko je kriv, prilozi su tu… sve što me mučilo da izvučem za statistiku sada možemo, a ujedno nam olakšava posao ako nešto treba da dodamo iz admin panela."

**Cilj:** kategorija (vrsta posla) postaje ravnopravan, vidljiv ulaz u reklamacije — u meniju, na listi, pri unosu i na detalju — a **polja koja pripadaju jednoj vrsti posla** (npr. koji je deo obrađen) su **podatak u šifarniku** koji kancelarija sama dodaje, gasi i proširuje iz admin panela, i po kome statistika ume da broji. Vrsta (EMOTIVE/DOMAĆE) ostaje jasna jer ona određuje polja, dozvole i portal.

**U okviru:** meni-stablo · brojevi nerešenih · mrvice u traci (cela aplikacija) · lista u dva režima · jedan čarobnjak sa korakom „Vrsta" · čip kategorije i značka ugašene kategorije · **polja kategorije kao šifarnik** (definicije + opcije u adminu, vrednosti na reklamaciji, četiri stanja na detalju) · detalj po prototipu spojen sa našim · statistika po poljima kategorije · „Servis" → „Prijem vozila".

**Van okvira:** portal (ne dobija ništa novo — vrednosti polja su interne dok se drugačije ne odluči) · Excel (vrednosti polja se ne izvoze dok se ne traži) · forma za pretvaranje pristigle prijave (`convert-claim-form`) · obavezna polja po kategoriji · tipovi polja osim izbora iz liste · brisanje istorije grane (Nikolina odluka 21.08.: temelj Faze 1 ostaje, V2 se gradi na njemu).

**Šta NIJE rešenje** (odbačeno sa razlogom): klonirati listu/formu/detalj po kategoriji. Kategorija i njena polja su **podaci**, ne grane u kodu — nijedan sloj ne sme da kaže `if (category === 'MASINSKA_OBRADA')` niti `if (field === 'obradjeni_deo')`. Interna aplikacija posle V2 **ne imenuje nijedan kod** kategorije ni polja; `MACHINING_CLAIM_CATEGORY_CODE` i `ENGINE_OVERHAUL_CLAIM_CATEGORY_CODE` ostaju samo zbog dva taba na portalu.

---

## 2. Odluke

### 2.1 Iz handoffa (§0, 21.08., ne preispituju se)

1. Meni = stablo: „Reklamacije" je grupa koja se širi, kategorije su pod-stavke.
2. Broj uz kategoriju = **nerešeno** (ishod „Na čekanju").
3. U meniju stoje **sve aktivne** kategorije, i prazne; ugašene se ne prikazuju u meniju, stare reklamacije ih i dalje nose.
4. „Servis" → **„Prijem vozila"** (labela; ruta `/prijem` ostaje).
5. **Jedno** dugme „+ Nova reklamacija"; vrsta je **prvi korak** čarobnjaka.
6. Kategorija u čarobnjaku se **može promeniti u hodu** — čip u zaglavlju sa menijem.
7. **Obe vrste kroz isti čarobnjak** (Vrsta → Podaci → Kvarovi → Pregled); duga DOMAĆA forma se penzioniše.

### 2.2 Donete 21.08. na moja pitanja (Nikola)

8. **Čarobnjak = jedna ljuska, dve forme.** Ljuska (ruta, korak „Vrsta", stepper, čip kategorije, izlaz) posle izbora vrste renderuje **EMOTIVE set koraka** (postojeći) ili **DOMAĆE set koraka** (nov, od postojećih polja) — svaki sa svojom šemom, formom i slanjem na svoj endpoint. Poštuje zaključano pravilo iz `docs/04` („odvojene forme, nikad jedna koja grana po vrsti"): ljuska je „layout shell", koji pravilo izričito dozvoljava da se deli. `docs/04` dobija rečenicu koja to kaže.
9. **Polja kategorije su PRAVI šifarnik, od prvog dana** (zamenjuje istog dana donetu odluku „prazan kontejner sad" — Nikolin roman je jasan: „da možemo lako da dodamo glavu, deklo, karter iz admin panela… i da izvlačimo statistiku"; prazan kontejner bi bio mrtav kod, a to je izričito zabranio). Model u §4 i §10.
10. **Migracija sad** — jedna migracija `0046` nosi i `deactivated_at` i tabele polja (§4.1).
11. **Mrvice u gornjoj traci sad, cela aplikacija** — mono, kao prototip i admin panel; mehanizam koji TanStack Router dokumentuje (§6).

### 2.3 Donete po pravilima koja već važe (rečeno Nikoli, bez prigovora)

12. Ruta kategorije nosi **kod**: `/reklamacije/kategorija/$categoryCode` (spec Faze 1 §4.2).
13. Brojevi za meni dolaze iz **jednog endpointa u modulu reklamacija**, opseg po dozvolama, osvežavanje na iste događaje kao lista (§4.4).
14. Stare rute za unos → `/reklamacije/nova?kind=…`; fajlovi se brišu; paleta prelazi na novu rutu.
15. Posle čuvanja → **lista kategorije sa kojom je reklamacija sačuvana** + toast (prototip `wizSave`; proza je rekla „iz koje je unos krenuo" — prototip pobeđuje, i logičnije je).
16. Jučerašnja mašinerija za „ko svetli u meniju" se **briše** — kategorije dobijaju svoju putanju.
17. **Sve na istoj grani `feat/claim-category`**, jedan merge, jedan `db:seed`. Migracija `0045` živi samo na njoj; nova grana bi napravila sudar `0046`.
18. **Seed prvog polja:** prototip crta „Obrađeni deo: Glava / Blok / Radilica" na mašinskoj; migracija ga seed-uje tako (kao što je `0045` seed-ovala četiri kategorije), a „deklo" i „karter" Nikola dodaje sam iz admina — to je ujedno demonstracija da šifarnik radi. **Veto dobrodošao.**

---

## 3. Standard kvaliteta (Nikolin uslov, 21.08.)

Ovo nije ukras — svaka tačka je provera u završnom pregledu:

- **Ništa hardkodovano:** kategorije, polja, opcije, njihova imena i redosled su redovi u bazi; kod ih čita, nikad ne nabraja. Jedina imenovana stvar su portalska dva taba (već postoji).
- **Nema mrtvog koda:** ništa se ne gradi „za posle" — svaka komponenta ima stvaran podatak iza sebe ili ne postoji. Duga DOMAĆA forma i stare rute se **brišu**, ne ostavljaju.
- **Nema prepletanja:** jedan izvor za brojeve (§4.4), jedan izvor za definicije polja (§4.5), jedno mesto za dugmad i zaštitu čarobnjaka (ljuska), jedno čisto pravilo za aktivnu stavku menija. Funkcija < 30 redova, fajl < 500, bez `any`, bez `!`, bez magičnih brojeva.
- **Munjevito:** meni dodaje jedan jeftin upit (dva grupisana brojanja), keširan i osvežavan samo na događaje; definicije polja se čitaju jednom po kategoriji; vrednosti polja stoje na redu reklamacije (nema join-a za detalj); statistika po poljima računa se samo kad je kategorija izabrana. Nijedan N+1.
- **Bezbednost:** §12. Svaka ruta `requirePermission`; svaki ulaz Zod (i jsonb); server je sudija za vrednosti polja; audit na svaku izmenu šifarnika; opseg na svakom čitanju; portal ne dobija ništa.
- **Provera pre upotrebe:** svaki zadatak počinje **čitanjem dokumentacije** (Context7) za deo stacka koji koristi na nov način, i pogledom kako drugi rešavaju isto. Već provereno i usvojeno: `staticData.getTitle` + `useMatches()` za mrvice; `retainSearchParams` procenjen i **nije** potreban (kategorija je u putanji, ne u search-u). Kandidati za proveru u planu: `@container` upiti (Tailwind v4) umesto `lg:` za flyout i zaglavlje liste (lekcija iz prijema: breakpoint ne zna za sidebar); cmdk grupe u `SearchableSelect`; Radix `Popover` za flyout (već u upotrebi za zvono); Drizzle `check()` za `field_type`.
- **Dokaz, ne uverenje:** test prvo (crven), mutacija na svako pravilo sa ivicom (§13), pun gejt pod `TZ=UTC` pre svakog komita, prolazak kroz pregledač na 1440 i tabletu pre predaje.

---

## 4. Podaci i API

### 4.1 Migracija `0046` (jedna, generisana `drizzle-kit`-om)

Postupak iz CLAUDE.md §3: journal → `generate` (nikad ručni DDL) → migrate-from-zero na praznoj bazi → potvrda da fajl nosi samo ovo. Podaci (seed) se dopisuju rukom na kraj fajla kao u `0034`/`0045`.

1. `claim_categories.deactivated_at timestamptz NULL`.
2. **`claim_category_fields`** — polje koje pripada jednoj kategoriji: `id`, `category_id` FK → `claim_categories` (RESTRICT), `code text`, `name text`, `field_type text NOT NULL DEFAULT 'select'` + CHECK `field_type IN ('select')` (tekst + CHECK, ne PG enum — drugi tip je sutra red u CHECK-u, ne migracija šeme), `sort_order`, `is_active`, `deactivated_at`, `created_at`, `updated_at`, `deleted_at`; UNIQUE `(category_id, code)`; indeks `category_id`.
3. **`claim_category_field_options`** — ponuđena vrednost polja: `id`, `field_id` FK → `claim_category_fields` (RESTRICT), `code`, `name`, `sort_order`, `is_active`, `deactivated_at`, `created_at`, `updated_at`, `deleted_at`; UNIQUE `(field_id, code)`; indeks `field_id`.
4. `emotive_claims.category_field_values jsonb NULL` i `domace_claims.category_field_values jsonb NULL` — `{ "<kod polja>": "<kod opcije>" }`. Obrazac koji repo već ima (`findings`, `section_updated_at`); kodovi su nepromenljivi posle stvaranja (kao kod kategorije), pa su čitljivi i u SQL-u i u izvozu.
5. Seed (odluka 18): polje `obradjeni_deo` „Obrađeni deo" na `MASINSKA_OBRADA`, opcije `glava` „Glava", `blok` „Blok", `radilica` „Radilica"; `ON CONFLICT DO NOTHING`.

Bez backfill-a vrednosti: stare reklamacije nemaju vrednost, a upravo to detalj i statistika umeju da kažu (§10).

### 4.2 Gašenje nosi datum

Servis šifarnika (kategorije, polja, opcije — isti obrazac): `isActive true → false` postavlja `deactivated_at = now()`; `false → true` briše ga. Ništa drugo ga ne piše. Audit beleži before/after kao i danas.

### 4.3 `ClaimCategoryRef` na reklamaciji

`{ id, code, name }` → `{ id, code, name, isActive, deactivatedAt }`. Detalj obe vrste dobija i `categoryFieldValues: Record<string, string>` (prazan objekat kad je NULL). Lista ga **ne** nosi. Klijentska žica (portal) nepromenjena.

### 4.4 `GET /api/claims/category-counts`

- **Modul** `claims` (tu živi `resolveListScope` — brojevi poštuju iste dozvole kao lista). **Dozvola:** isti gate kao `GET /api/claims`. Nema nove dozvole.
- **Odgovor:** `{ items: [{ id, code, name, sortOrder, isActive, total, pending }], totals: { total, pending } }`.
- **Redovi:** kategorije sa `deleted_at IS NULL` **i** (`is_active` **ili** `total > 0` u opsegu čitaoca). Redosled `sort_order`, pa `name`.
- **Brojanje:** UNION obe tabele po opsegu, bez obrisanih; `total` = sve uključujući arhivirane (lista ih prikazuje, pa „Ukupno" mora da se slaže sa listom); `pending` = `outcome = 'pending'`. Jedan upit, `COUNT(*) FILTER`.
- **Keš:** bez server-side keša. Klijent: `claimKeys.categoryCounts()` pod `claimKeys.all`; osvežava ga `invalidateInternalClaimQueries` (posle svake mutacije reklamacije + SSE) i `ResourceChangedKey.ClaimCategories`.
- **Čitaoci:** meni, zaglavlje liste, grupa „Ugašene" u filteru, mrvice (ime po kodu). Filter kategorije na listi prestaje da čita šifarnik direktno.

### 4.5 Šifarnik polja — API

- **Modul `claim-category-fields`** po šablonu kataloga (kao `claim-categories`): `GET /api/claim-category-fields?categoryId=&activeOnly=` · `POST` · `PATCH /:id` · `DELETE /:id` (hard delete blokiran 409 dok bar jedna reklamacija nosi vrednost tog polja — `usageCount` = broj reklamacija čiji jsonb ima taj ključ, obe tabele).
- **Modul `claim-category-field-options`** isto: `GET ?fieldId=&activeOnly=` · `POST` · `PATCH` · `DELETE` (blokiran dok bar jedna reklamacija nosi tu vrednost).
- **Dozvole:** mutacije `settings.claim_categories.manage` (isti šifarnik, isti ključ — polja su deo kategorije); čitanje isti široki gate kao šifarnik kategorija (ko sme reklamacije ili statistiku).
- **Jedan događaj za celu porodicu:** `ResourceChangedKey.ClaimCategories` se šalje i za polja i za opcije — jedan ključ invalidira kategorije, brojeve i definicije. Nema novog ključa.
- **Definicije za ekran:** `GET /api/claim-category-fields?categoryId=X&includeOptions=true` vraća polja **sa opcijama ugnežđenim** i sa `isActive`/`deactivatedAt`/`createdAt` na oba nivoa (detalj starih reklamacija mora da imenuje i ugašeno). Jedan poziv po kategoriji, `claimCategoryFieldsOptions(categoryId)` u `@mr/shared`, keširan; SSE ga osvežava.

### 4.6 Vrednosti polja na reklamaciji — server je sudija

`categoryFieldValues` ulazi kroz **postojeće** create/update šeme obe vrste (`z.record(kod, kod)` sa granicama dužine i broja ključeva), u **istoj transakciji** kao reklamacija (pravilo „jedan endpoint, jedna transakcija" ostaje). Servis proverava (obe familije, isti helper u `core/claims/`):

- svaki ključ je polje **kategorije koju reklamacija ima posle upisa**, svaka vrednost je opcija tog polja — inače 422 `Invalid category field value`;
- na kreiranju polje i opcija moraju biti **aktivni**;
- na izmeni važi **isto pravilo kao za kategoriju**: vrednost koja je nepromenjena sme da ostane iako su polje ili opcija u međuvremenu ugašeni; **promenjena** vrednost mora biti aktivna. Izmena broja MR na staroj reklamaciji ne sme da pukne zbog ukinute opcije;
- promena kategorije briše vrednosti stare kategorije (forma ih ne šalje, server odbija tuđe ključeve);
- polja su **opciona** — „Nije popunjeno" je legitimno stanje (§10). Obavezna polja su svoja odluka, kasnije.

### 4.7 Šta se NE menja

`GET /api/claims` (filter već postoji) · rute i transakcije kreiranja/izmene (dobijaju jedno polje u payload-u) · portal · Excel.

---

## 5. Meni (sidebar)

Vrednosti iz prototipa; ovde ponašanje.

- **Redosled:** 01 Početna · 02 Pristiglo · 03 **Reklamacije** (grupa) · 04 Prijem vozila · 05 Statistika. Gate po dozvolama kao danas; grupa nosi `CLAIMS_LIST_VIEW_PERMISSIONS`.
- **Konfiguracija:** `NavItem` dobija opcioni marker `children: 'claim-categories'` (deca su upit, ne statika). Jučerašnji `search` na `NavItem` se briše.
- **Deca** (iz `category-counts`): prvo **„Sve reklamacije"** (→ `/reklamacije`, broj = `totals.pending`), pa aktivne kategorije redom `sortOrder` (→ `/reklamacije/kategorija/$categoryCode`, broj = `pending`). Broj amber kad > 0, prigušen kad 0. Ime preko ~20 karaktera: ellipsis + `title`.
- **Zaglavlje grupe:** klik širi/skuplja, ne navigira; badge `totals.pending`; caret ▾/▸; stanje u `localStorage` `mrr:internal:nav:reklamacije-open` (obrazac `mrr:internal:sidebar-collapsed`), podrazumevano otvoreno.
- **Aktivna pod-stavka** — čista funkcija `activeClaimsEntry(location)`: `/reklamacije/kategorija/<code>` → ta kategorija; tačno `/reklamacije` → „Sve"; ostalo pod `/reklamacije/…` (detalj, čarobnjak) → `search.categoryCode` ako postoji, inače „Sve". Zaglavlje grupe istaknuto kad je bilo koje dete aktivno.
- **Sužen meni (icon-rail):** ikonica sa amber tačkom kad `totals.pending > 0`; klik otvara flyout (`Popover` iz `@mr/ui`) sa istom listom; Esc/klik van zatvara; izbor navigira i zatvara. **Mobilni drawer:** grupa inline.
- **Učitavanje:** loader `_shell` rute warm-uje brojeve **samo** kad korisnik drži neku od `CLAIMS_LIST_VIEW_PERMISSIONS`; meni čita kroz `useQuery` (ne suspense) — greška ili kašnjenje daju grupu bez brojeva i bez dece osim „Sve". Meni ne pada zbog brojača.
- **Paleta:** pet stavki + Bezbednost; kategorije nisu u paleti (nije traženo).

---

## 6. Mrvice u gornjoj traci (cela aplikacija)

- **Mehanizam iz dokumentacije TanStack Routera** (provereno 21.08.): svaka ruta deklariše `staticData: { getTitle }` (ili `loaderData` za dinamičko ime), traka ih skuplja kroz `useMatches()`. Zamenjuje današnji `sectionLabel` if-lanac po putanji — naslov živi uz rutu, pa ekran ne može da se doda a da mu ime ne stigne u traku.
- **Oblik:** `INTERNO / <SEKCIJA>[ / <DRUGA RAZINA>]`, mono uppercase po prototipu (`600 10.5px 'JetBrains Mono'`, `letter-spacing:.16em`, kosa crta `opacity:.5`, poslednji deo `--text`). Ispod `sm` skriveno kao danas.
- **Druga razina — samo što prototip crta:** lista kategorije → ime kategorije (iz `loaderData`); detalj → `DETALJ`; `/reklamacije/nova` → ceo crumb `NOVA REKLAMACIJA`. Prijem, Statistika, Pristiglo, Početna, Bezbednost → jedna razina. Za Prijem druga razina nije nacrtana pa se ne izmišlja — ako Nikola hoće, svoja odluka.
- Sve labele kroz postojeće `nav_*` ključeve + nove (`topbar_app_name`, `crumb_detail`, `crumb_new_claim`).

---

## 7. Lista — jedan ekran, dva režima

### 7.1 Rute

- `/reklamacije` — režim **„Sve"** (postojeća ruta; `categoryCode` u search-u ostaje običan filter).
- `/reklamacije/kategorija/$categoryCode` — režim **„Kategorija"**; `ClaimsSearchSchema` bez `categoryCode` (kod je u putanji); loader: lista + `category-counts` + proizvođači. Nepoznat kod → prazna lista, zaglavlje bez imena (ne greška); ugašen kod sa zapisima radi normalno.
- **Jedna komponenta** sa `mode` i `category?` — ne dve.
- `ClaimDetailSearchSchema` dobija opcioni `categoryCode` (dele ga oba detalja); čarobnjak ga ima u svom search-u.

### 7.2 Zaglavlje (prototip)

- **Kategorija:** eyebrow `KATEGORIJA` · H1 ime · podnaslov „Nerešeno: N · Ukupno: M" (iz `category-counts`, cela kategorija).
- **Sve:** eyebrow `SVE VRSTE POSLA` · H1 „Sve reklamacije" · „Obe vrste, sve kategorije · Nerešeno: N".
- Jedno dugme **„+ NOVA REKLAMACIJA"** (vidljivo ako sme bar jednu vrstu) → `/reklamacije/nova` sa `categoryCode` režima.
- Kartica tabele: „Reklamacije — <kategorija>" / „Sve reklamacije" + `UKUPNO: n` gde je n `total` liste **pod trenutnim filterima** (broj redova koje tabela zaista ima — namerno različit od podnaslova, prototip tako crta).

### 7.3 Filteri

- **Sve:** svi današnji; select **Kategorija** iz `category-counts`: aktivne, pa grupa **„Ugašene"** sa onima koje imaju zapise (cmdk grupe u `SearchableSelect`; ne sufiks u imenu).
- **Kategorija:** selecta nema; dashed čip `KATEGORIJA = MAŠINSKA OBRADA ✕`; **✕ vodi na `/reklamacije`** i prenosi ostale filtere; „Poništi filtere" ne dira kategoriju (ona je mesto, ne filter).
- Sve ostalo kao danas — prototip je minimum.

### 7.4 Tabela

- Kolona **Kategorija** samo u režimu „Sve"; **ugašena** → čip `†`, dashed, prigušen (`category.isActive`).
- Sve kolone, čekiranje, sortiranje, radnje ostaju (prototipsko `→` je placeholder).
- Red → detalj sa `search: { ...CLAIM_DETAIL_DEFAULT_SEARCH, categoryCode }` **samo u režimu kategorije**.

### 7.5 Prazna stanja

- **Kategorija bez reklamacija** (samo kategorija, `total === 0`): kartica sa ikonicom, „U ovoj kategoriji još nema reklamacija", italic rečenica, „+ Nova reklamacija" sa kategorijom.
- **Filter bez pogotka:** „Nijedna reklamacija ne odgovara filterima" + „Poništi filtere".
- Razlika iz search-a na klijentu (kao prototip `emptyCat`).

---

## 8. Čarobnjak — jedna ljuska, dve forme

### 8.1 Ruta i ulazi

`/reklamacije/nova`, search `{ kind?, categoryCode? }`. Ulazi: dugme na listi, prazno stanje, paleta (`?kind=` preskače „Vrsta", stepper ga označava završenim, „Nazad" ga vraća). Loader: `prefetchClaimEditReferences` + `category-counts` + definicije polja za kategoriju iz search-a. Stari fajlovi ruta se brišu; duga DOMAĆA forma i njeni testovi tek kad novi tok prođe svoje.

### 8.2 Ljuska (`ClaimCreateWizard`)

- Drži `kind`, `categoryId` (iz koda u search-u → id), `step`.
- **Zaglavlje:** „← Nazad" · eyebrow `NOVA REKLAMACIJA` · naslov koraka · **čip kategorije** `KATEGORIJA: MAŠINSKA OBRADA ▾` sa menijem aktivnih kategorija; promena važi odmah i **briše vrednosti polja stare kategorije** (forma ih više ne nosi). Bez kategorije: `KATEGORIJA: IZABERI ▾`, čuvanje mrtvo, rečenica na „Pregledu" imenuje šta fali.
- **Stepper:** `VRSTA · PODACI · KVAROVI · PREGLED`, krug 26px, stanja aktivan/završen/budući, zelene spojnice (prototip `steps`); postojeći `WizardStepper` se proširuje, ne duplira.
- **Izlaz** i **promena vrste** sa prljavom formom: `<ConfirmDialog>`. Zatvaranje taba se ne presreće (odluka).
- Ljuska daje formi: `categoryId`, **definicije polja te kategorije** (aktivne), `onSaved(claim)`; dugmad (NAZAD · DALJE · ✓ SAČUVAJ) i zaštita od preranog čuvanja (dugme nije `type="submit"`) su **ljuskine** — jedno mesto, obe vrste.

### 8.3 Korak „Vrsta"

Dve kartice (prototip `w0`): EMOTIVE (plavi pill, opis) i DOMAĆA (ljubičasti pill, opis); hover lift + tinta; **klik = izbor + odmah korak 2**. Kartica vrste bez dozvole (`<kind>_claims.create`) onemogućena sa rečenicom; bez automatskog preskakanja.

### 8.4 EMOTIVE koraci (postojeći)

`StepBasicFields` → `StepFaultsFields` → `StepReview`, uz: kategorija nije više polje u „Podacima" (čip); **grupa „POLJA KATEGORIJE"** (§10) ispod osnovnih polja, dashed okvir, renderuje se **samo ako kategorija ima aktivna polja**; `StepReview` dobija redove `KATEGORIJA` + po jedan za svako polje. Zvezdice po **stvarnoj Zod šemi**.

### 8.5 DOMAĆE koraci (novi, od postojećih delova)

`DomaceBasicFields` (+ ista grupa polja) → `StepFaultsFields` → **`DomaceStepReview`** po obrascu EMOTIVE pregleda (nota: „otvara se sa ishodom Na čekanju; domaća reklamacija se ne prikazuje na portalu"). Šema, serializer, hook **isti** — payload ka `/api/domace-claims` je nepromenjen osim novog `categoryFieldValues`, što test dokazuje snapshot-om. DOMAĆE i dalje lista sve aktivne radnike (izuzetak ostaje).

### 8.6 Hook-ovi i posle čuvanja

Hook-ovi: POST + invalidacija. **Toast i navigacija sele se u ljusku** (samo ona zna kategoriju). Posle čuvanja: `/reklamacije/kategorija/$categoryCode` sačuvane kategorije + toast „Reklamacija MR 7168/25 sačuvana — Mašinska obrada".

---

## 9. Detalj — spojen sa prototipom

**Pravilo spajanja u praksi** — svaki element prototipa mapiran na naš:

| Prototip | Mi danas | V2 |
| --- | --- | --- |
| `← Nazad na listu` | nema | **dodaje se** — vodi na listu kategorije iz `categoryCode` u search-u, inače na „Sve" |
| `MR 7167/25` mono 25px · KindPill · **čip kategorije** · OutcomePill; mono podnaslov | H1 mono + OutcomePill + KindPill; meta-linija | **restyle po prototipu**, čip kategorije **dodaje se** (dashed + značka `KATEGORIJA UGAŠENA MM/YY` kad je ugašena — datum iz `deactivatedAt`, `Intl`) |
| `✓ PRIHVATI` zeleno / `ODBIJ` crveni outline | `EmotiveClaimStatusActions`: ista dva dugmeta, iste boje, `ConfirmDialog` | **ostaje**, položaj i mere po prototipu |
| tabovi Pregled · Nalazi · Prilozi · Izveštaj | Pregled · Kvarovi · Prilozi · Izveštaj (nalazi su na Pregledu) | **naši tabovi ostaju** (imamo više); prototipski „Nalazi" je naš Pregled |
| dve kolone `1fr 340px` | jedna kolona | **dve kolone** na Pregledu |
| kartica „Osnovni podaci" (4 kolone) | `EmotiveClaimBasicSection` (mreža 4 kolone, edit) | **ostaje**, mere po prototipu |
| **kartica „Polja kategorije"** (dashed) | nema | **dodaje se** (§10) |
| kartica „Kvarovi" na Pregledu | tab Kvarovi sa editorom | **dodaje se** kao **čitanje** (red: broj · opis · pill krivice), link „Izmeni →" vodi na tab; tab ostaje |
| desno „Klijent vidi" (3 tačke sa datumima + „Objavi ishod klijentu") | `EmotiveClaimStageBadge` u zaglavlju + objava u radnjama | **dodaje se** kao kartica iz postojećih `createdAt`/`clientVisibleAt`/`publishedAt` + postojeća mutacija objave; **samo EMOTIVE** (DOMAĆE nema portal — kartice nema, kolona se skuplja) |
| desno „Prilozi" (3 sličice + `+`) | tab Prilozi | **dodaje se** mini-mreža prvih 5 sličica iz postojećeg upita priloga, `+` vodi na tab |
| nalaz pregleda, nalazi, izveštaj, TipTap, vreme izmene | postoje | **ostaju** na svom mestu |

DOMAĆE detalj dobija **isto** (zaglavlje, čip, značka, „Polja kategorije", „Kvarovi" kartica, „Prilozi"), bez „Klijent vidi".

---

## 10. „Polja kategorije" — šifarnik, ne kontejner

**Zahtev (§9 handoffa, Nikola):** polja mašinske će se menjati; sakrivanje nije odgovor; stara reklamacija ne sme da izgleda kao da je neko zaboravio polje; statistika mora da zna nad čime broji.

**Admin** (`admin-web`, okvir `ResourceDefinition` koji već nosi deset šifarnika): dva ekrana pod Podešavanjima — **„Polja kategorija"** (kolone: kategorija, kod, naziv, redosled, u upotrebi, aktivno; kreiranje sa izborom kategorije iz `reference-select`) i **„Opcije polja"** (polje iz `reference-select`, kod, naziv, redosled, u upotrebi, aktivno). Gašenje i paljenje kao kod svakog šifarnika; hard delete blokiran dok ima zapisa (409). Dva ravna ekrana su svesna odluka — dosledno ostalima; ugnežđeno uređivanje (opcije unutar polja) je poliranje za kasnije, ne prepreka.

**Forma** (oba seta koraka): grupa `POLJA KATEGORIJE · <KATEGORIJA>` u dashed okviru (prototip `w1`), po jedno polje = segmentirani izbor aktivnih opcija (prototip „Glava / Blok / Radilica"); renderuje se **samo** kad kategorija ima aktivna polja — nikad prazan okvir.

**Detalj:** kartica „Polja kategorije" (dashed, prototip) renderuje se samo kad kategorija ima polja sa čime da kaže. Čista funkcija `resolveCategoryFieldStates(definitions, values, claimCreatedAt)` daje po polju jedno od **četiri stanja**:

| Stanje | Kad | Prikaz |
| --- | --- | --- |
| `filled` | vrednost postoji, polje i opcija aktivni | vrednost |
| `empty` | polje aktivno, nema vrednosti, reklamacija uneta **posle** nastanka polja | italic „Nije popunjeno" |
| `predates` | polje aktivno, nema vrednosti, reklamacija uneta **pre** nastanka polja | prigušeno „Uvedeno MM/YY, posle unosa" — stara reklamacija nije „zaboravljena" |
| `retired` | polje (ili opcija) ugašeno, vrednost **postoji** | labela sa značkom `UKINUTO MM/YY`, vrednost sačuvana i prikazana prigušeno. **Nikad se ne sakriva.** |

Ugašeno polje **bez** vrednosti se ne prikazuje (nema šta da kaže). Četvrto stanje (`predates`) nije u prototipu — dodato je jer direktno odgovara na Nikolinu brigu („stare reklamacije nemaju to polje popunjeno, pa statistika ima problem"); statistika ga broji odvojeno.

**Statistika:** kad je filter kategorije izabran, sekcija **„Po poljima kategorije"** — za svako polje te kategorije rang-kartica (kao „Po partneru") po opcijama, plus redovi „Nije popunjeno" i „Pre uvođenja polja"; ugašene opcije sa brojem se imenuju sa `†`. SQL: `jsonb_each_text(category_field_values)` spojen na definicije, pod **istim** `buildActiveClaimWhere` kao sve ostalo (pa poštuje i period i proizvođača). Bez filtera kategorije sekcije nema — ne meša polja različitih kategorija.

---

## 11. i18n

Sve kroz Paraglide, SR + EN, bez brojevne množine. Grupe: meni · mrvice · lista (oba režima, čip, „Ugašene", prazna stanja) · čarobnjak (koraci, kartice vrste, čip, obavezna kategorija, potvrde, note, toast) · detalj (nazad, značke, „Polja kategorije", četiri stanja, „Kvarovi" kartica, „Klijent vidi", „Prilozi") · admin (dva nova šifarnika) · statistika (sekcija, dva posebna reda). EN do ~35% duži — ellipsis + `title`. Posle izmene: `compile` za dev, `build` za gejt.

---

## 12. Bezbednost

- Nove rute: `requirePermission`/`requirePermissions` na svakoj; mutacije šifarnika polja pod `settings.claim_categories.manage`; `category-counts` i definicije pod istim gate-om kao reklamacije/šifarnici; **ništa bez dozvole**.
- Opseg: brojevi i statistika po opsegu čitaoca (`resolveListScope` / statistički scope) — domaći čitalac ne vidi EMOTIVE brojeve.
- Ulaz: `categoryFieldValues` kroz Zod (`z.record` sa granicama: ključ/vrednost `trim().min(1).max(100)`, najviše 50 ključeva) **pre** servisa; servis proverava pripadnost kategoriji i aktivnost (§4.6); jsonb nikad ne ulazi neproveren.
- SQL: isključivo parametrizovano (`` sql`${param}` ``); `jsonb_each_text` radi nad kolonom, ne nad ulazom; nema `sql.raw` sa korisničkim podatkom.
- Audit: svaka izmena kategorija/polja/opcija (create/update/delete) sa before/after; vrednosti polja ulaze u postojeći audit reklamacije kroz `changes`.
- Portal ne dobija ništa — `toClientClaimListItem`/`toClientClaimDetail` su whitelist i ne dodaje im se nijedno polje; test na whitelist to čuva.
- Datoteke, CSRF, sesije, rate limit — nepromenjeni slojevi; ništa se ne uklanja.

---

## 13. Testovi — šta se dokazuje (⚙ = mutacija)

- **Migracija:** od nule prolazi; seed upisuje polje i tri opcije; `deactivated_at` NULL na svemu.
- **Šifarnik polja/opcija:** ⚙ gašenje postavlja datum, paljenje briše · UNIQUE `(category_id, code)` → 409 · hard delete blokiran 409 dok postoji vrednost · `includeOptions` vraća i ugašene opcije · 403 bez dozvole · audit red na svaku izmenu.
- **Vrednosti na reklamaciji (obe familije):** ⚙ tuđe polje → 422 · ⚙ ugašena opcija na kreiranju → 422 · nepromenjena ugašena vrednost na izmeni prolazi, promenjena ne · promena kategorije sa starim ključevima → 422 · vrednosti u istoj transakciji (rollback briše i njih) · portal whitelist ih ne nosi.
- **`category-counts`:** ⚙ opseg · ugašena bez zapisa se ne vraća · `pending`/`total` semantika · 403.
- **Invalidacija:** mutacija reklamacije i SSE `ClaimCategories` osvežavaju brojeve i definicije.
- **Meni:** ⚙ `activeClaimsEntry` · gate (serviser ne vidi grupu) · pamćenje · flyout · paleta bez kategorija.
- **Mrvice:** `staticData` svake rute daje naslov; tri druge razine.
- **Lista:** režim kategorije krije select i kolonu; ✕ prenosi filtere; „Poništi" ne dira kategoriju; `†`; dva prazna stanja; dugme nosi kategoriju.
- **Čarobnjak:** ⚙ čip → `categoryId` u payload obe vrste · promena kategorije briše vrednosti polja · bez kategorije čuvanje mrtvo + rečenica · `?kind=` preskače · kartica bez dozvole · izlaz traži potvrdu · DOMAĆE payload snapshot · grupa polja se ne renderuje bez definicija · posle čuvanja navigacija + toast.
- **Detalj:** čip + značka sa datumom u oba zaglavlja · „Polja kategorije" samo kad ima šta · ⚙ `resolveCategoryFieldStates` četiri stanja · „Klijent vidi" samo EMOTIVE · „Kvarovi" kartica čita iste podatke kao tab.
- **Statistika:** ⚙ sekcija po poljima samo sa filterom kategorije i poštuje period (pomeri uslov iz zajedničkog filtera → crveno) · ugašena opcija sa brojem imenovana · „Pre uvođenja" odvojeno od „Nije popunjeno".

---

## 14. Redosled rada (više sesija; svaki zadatak = gejt + komit)

1. **Podaci:** migracija `0046` (sve iz §4.1), `deactivatedAt` kroz servise, `ClaimCategoryRef`, `category-counts` + upit + invalidacija.
2. **Šifarnik polja — API + admin:** dva modula po šablonu kataloga, definicije sa opcijama, dva admin ekrana, `reference-select` ključevi.
3. **Vrednosti na reklamaciji:** Zod + servisna provera u obe familije (helper u `core/claims/`), detalj nosi vrednosti; testovi uključujući transakciju i whitelist.
4. **Meni** + brisanje jučerašnje mašinerije i stavke „Mašinska obrada" + „Prijem vozila" + paleta.
5. **Mrvice** (`staticData`), cela aplikacija.
6. **Lista:** ruta kategorije, dva režima, čip, `†`, „Ugašene", prazna stanja.
7. **Čarobnjak:** ljuska + „Vrsta" + čip + EMOTIVE koraci · DOMAĆE koraci + pregled · grupa polja · seljenje navigacije/toasta · brisanje starih ruta i duge forme · paleta.
8. **Detalj** po tabeli iz §9, obe vrste, `resolveCategoryFieldStates`.
9. **Statistika** po poljima kategorije.
10. **Završetak:** prolazak kroz pregledač (Playwright, `TZ=UTC`, SR+EN, tamna+svetla, 1440 + tablet) sa screenshotovima iz handoffa §8 · `docs/04` rečenica o ljusci · CLAUDE.md (§2 invarijante kategorije i polja, §5 brisanje jučerašnjeg pravila, §9 stanje) · završni pregled cele grane po §3.

Svaki zadatak počinje korakom „provera dokumentacije" za deo stacka koji koristi (§3). Plan (`writing-plans`) razrađuje korake.

Posle: merge `feat/claim-category` → `main` (= deploj; `0045` + `0046` idu same kroz `db:migrate:deploy`), pa **jednom** `db:seed` u api Console (dozvola iz Faze 1; V2 ne uvodi novu).

---

## 15. Rizici

- **Obim.** Deset zadataka, više sesija — Nikola to zna i prihvata. Svaki zadatak je zatvorena celina sa zelenim gejtom; grana je u svakom trenutku spojiva.
- **Čarobnjak** je najveći zalogaj — DOMAĆE payload snapshot pre brisanja stare forme; dugmad i zaštita u ljusci.
- **jsonb bez FK.** Integritet čuva servis (§4.6) + blokiran hard delete dok ima zapisa; statistika imenuje i ugašeno. Ako se pokaže da treba, normalizovana tabela vrednosti je migracija sa backfill-om iz jsonb-a — ne sad.
- **Brojevi na svakom ekranu** = jedan jeftin upit; ako se izmeri skupim, `SummaryCache` je jedan red.
- **Dva ravna admin ekrana** za polja i opcije su manje elegantni od ugnežđenog uređivanja — radi od prvog dana, poliranje kasnije.

---

## 16. Čega nema (ne crtati, ne praviti)

Tipovi polja osim izbora iz liste · obavezna polja · vrednosti polja na portalu, u Excelu, u listi · kategorije u paleti · druga razina mrvica van reklamacija · presretanje zatvaranja taba · automatsko preskakanje koraka „Vrsta" · izmena `convert-claim-form` · „Tvrdoća posle obrade" i „Stari postupak" iz prototipa (ilustracije stanja, ne polja za seed).
