# Reklamacije po kategorijama — V2 (dizajn)

**Status:** predlog, čeka Nikolin pregled · **Datum:** 21.08.2026 · **Aplikacija:** `internal-web` (+ jedan endpoint u `api`, jedna kolona u `db`)

**Izvori istine, po prvenstvu:**

1. **izgled i ponašanje:** `design_handoff_claim_categories/kategorije-prototip.dc.html` — vrednosti se ČITAJU iz fajla (servirati folder preko HTTP-a, `support.js` je pored), nikad ne procenjuju;
2. **odluke vlasnika:** `docs/design-handoffs/2026-08-21-kategorije-prototype-handoff.md` §0 (sedam odluka od 21.08.) + četiri odluke iz ovog dokumenta §2;
3. **funkcija i podaci:** `docs/design-handoffs/2026-08-21-reklamacije-kategorije-handoff.md` + postojeći kod.

Gde se prototip i proza razlikuju, **prototip pobeđuje** (tako je i rešeno pitanje gde se sleće posle čuvanja, §8.7). Gde se prototip razlikuje od koda — ovaj dokument kaže šta važi; ako nešto nije pokriveno, **pitati, ne improvizovati**.

---

## 1. Cilj i okvir

**Problem** (Nikolinim rečima): „Ja sada hoću da unesem novu reklamaciju za mašinsko — kako ja to da uradim? … neću sigurno da idem ovim redosledom, nego ću lepo kao normalan čovek: aha, mašinsko, kliknem, šta ima tu, dobro, idemo, popunjavam."

**Cilj:** kategorija (vrsta posla) postaje ravnopravan, vidljiv ulaz u reklamacije — u meniju, na listi, pri unosu i na detalju — a vrsta (EMOTIVE/DOMAĆE) ostaje jasna jer ona određuje polja, dozvole i portal.

**Šta JESTE u okviru:** meni sa grupom „Reklamacije" i kategorijama iz šifarnika · brojevi nerešenih · mrvice u gornjoj traci · lista u dva režima (sve / jedna kategorija) · jedan čarobnjak za unos sa korakom „Vrsta" · čip kategorije i značka ugašene kategorije na detalju · mesto za „Polja kategorije" · „Servis" → „Prijem vozila".

**Šta NIJE u okviru:** statistika, portal, Excel (ne diraju se) · forma za pretvaranje pristigle prijave u reklamaciju (`convert-claim-form`, ostaje kakva jeste) · izmena detalja mimo dve navedene stvari (§9) · definicije polja po kategoriji u bazi (Faza 2, §10) · druga razina mrvica za Prijem/Statistiku/Početnu (prototip je ne crta, §6).

**Šta NIJE rešenje** (odbačeno sa razlogom, ne vraćati): klonirati listu/formu/detalj po kategoriji. Kategorija je **podatak**, ne grana u kodu — nijedan sloj ne sme da kaže `if (category === 'MASINSKA_OBRADA')`. Interna aplikacija posle ove izmene **ne imenuje nijedan kod kategorije**; `MACHINING_CLAIM_CATEGORY_CODE` i `ENGINE_OVERHAUL_CLAIM_CATEGORY_CODE` ostaju samo zbog dva taba na portalu.

---

## 2. Odluke

### 2.1 Iz handoffa (§0, 21.08., ne preispituju se)

1. Meni = stablo: „Reklamacije" je grupa koja se širi, kategorije su pod-stavke.
2. Broj uz kategoriju = **nerešeno** (ishod „Na čekanju"); podatak se dodaje na API.
3. U meniju stoje **sve aktivne** kategorije, i prazne; ugašene se ne prikazuju u meniju, stare reklamacije ih i dalje nose.
4. „Servis" → **„Prijem vozila"** (samo labela; ruta `/prijem` ostaje).
5. **Jedno** dugme „+ Nova reklamacija"; vrsta je **prvi korak** čarobnjaka.
6. Kategorija u čarobnjaku se **može promeniti u hodu** — čip u zaglavlju sa menijem.
7. **Obe vrste kroz isti čarobnjak** (Vrsta → Podaci → Kvarovi → Pregled); duga DOMAĆA forma se penzioniše.

### 2.2 Donete danas (21.08., Nikola)

8. **Čarobnjak = jedna ljuska, dve forme.** Ljuska (ruta, korak „Vrsta", stepper, čip kategorije, izlaz) posle izbora vrste renderuje **EMOTIVE set koraka** (postojeći) ili **DOMAĆE set koraka** (nov, od postojećih polja) — svaki sa svojom šemom, formom i slanjem na svoj endpoint. Ovo poštuje zaključano pravilo iz `docs/04` („odvojene forme, nikad jedna koja grana po vrsti"): ljuska je „layout shell", koji pravilo izričito dozvoljava da se deli. `docs/04` dobija jednu rečenicu koja to kaže, da se ne preispituje opet.
9. **„Polja kategorije" se grade sad kao prazan, config-driven kontejner** (protiv preporuke, Nikolina odluka): komponenta sa tri stanja postoji i testira se fixture-ima, spisak definicija je prazan, pa se na ekranu ne prikazuje ništa dok Faza 2 ne da prvo pravo polje.
10. **Migracija sad:** `claim_categories.deactivated_at` da značka „KATEGORIJA UGAŠENA MM/YY" može da nosi datum.
11. **Mrvice u gornjoj traci sad, za celu aplikaciju** — mono, kao u prototipu i admin panelu.

### 2.3 Donete po pravilima koja već važe (rečeno Nikoli, bez prigovora)

12. Ruta kategorije nosi **kod**, ne id: `/reklamacije/kategorija/$categoryCode` (spec Faze 1 §4.2; handoff je `$id` napisao kao predlog).
13. Brojevi za meni dolaze iz **jednog endpointa u modulu reklamacija**, koji poštuje dozvole i osvežava se na iste događaje kao lista (§4.3).
14. Stare rute `/reklamacije/emotive/nova` i `/reklamacije/domace/nova` → `/reklamacije/nova?kind=…`; fajlovi se brišu (interna aplikacija, nema spoljnih linkova); komande palete prelaze na novu rutu i preskaču korak „Vrsta".
15. Posle čuvanja → **lista kategorije sa kojom je reklamacija sačuvana** + toast (prototip `wizSave`; proza je rekla „iz koje je unos krenuo", prototip pobeđuje — i logičnije je: ako je kategorija promenjena u hodu, reklamacija se vidi tamo gde jeste).
16. Jučerašnja mašinerija za „ko svetli u meniju" (`explicitUndefined`, `paintsAsActive`, `search: { categoryCode: undefined }`) se **briše** — kategorije dobijaju svoju putanju pa razlog nestaje; `NavItem.search` se briše sa njom.
17. Sve ide na **istu granu `feat/claim-category`**, jedan merge, jedan `db:seed`. Razlog nije samo praktičan: migracija Faze 1 je `0045` i živi samo na toj grani; nova grana sa `main`-a bi napravila drugi `0046` koji bi se sudario pri spajanju (ista zamka koju je prijem jedva izbegao).

---

## 3. Rečnik u kodu

| Na ekranu | U kodu |
| --- | --- |
| kategorija / vrsta posla | `claim_categories`, `categoryCode` (URL), `categoryId` (payload), `ClaimCategoryRef` (žica) |
| vrsta (EMOTIVE / DOMAĆE) | `ClaimKind` |
| nerešeno | `outcome = 'pending'` |
| ugašena kategorija | `is_active = false`, `deactivated_at` postavljen |
| Polja kategorije | `ClaimCategoryFieldDefinition` (§10) |

---

## 4. Podaci i API

### 4.1 Migracija `0046` — `claim_categories.deactivated_at`

- `deactivated_at timestamptz NULL`. Postupak iz CLAUDE.md §3: proveriti journal → `drizzle-kit generate` (nikad ručni SQL) → dokaz migrate-from-zero na praznoj bazi → potvrditi da je u fajlu samo ova jedna kolona. Nema backfill-a (sve četiri su aktivne).
- **Servis šifarnika** (`claim-categories.service.ts` → repo): kad `isActive` pređe `true → false`, `deactivated_at = now()`; kad pređe `false → true`, `deactivated_at = NULL`. Ništa drugo ga ne piše. Audit već beleži before/after.
- `ClaimCategoryListItem` (admin) dobija `deactivatedAt: string | null` — admin ekran ga ne prikazuje (nije u prototipu); samo putuje.

### 4.2 `ClaimCategoryRef` na reklamaciji

`{ id, code, name }` → `{ id, code, name, isActive: boolean, deactivatedAt: string | null }`. Oba repoa već spajaju ceo red; dodaju se dve kolone u `select`. Klijentska žica (portal) i dalje nosi samo `categoryCode` — nepromenjeno.

### 4.3 Novi endpoint: `GET /api/claims/category-counts`

- **Modul:** `claims` (isti koji servira objedinjenu listu) — tu već živi `resolveListScope(actor)`, pa brojevi poštuju iste dozvole kao lista: ko vidi samo DOMAĆE, broji samo DOMAĆE.
- **Dozvola:** isti `viewClaimsPermissions` kao `GET /api/claims`. Nema nove dozvole → **nema novog seed-a** zbog ovoga.
- **Odgovor:**
  ```json
  {
    "items": [
      { "id": "…", "code": "MASINSKA_OBRADA", "name": "Mašinska obrada", "sortOrder": 20,
        "isActive": true, "total": 14, "pending": 9 }
    ],
    "totals": { "total": 120, "pending": 39 }
  }
  ```
- **Koji redovi:** kategorije sa `deleted_at IS NULL` **i** (`is_active` **ili** `total > 0` u opsegu čitaoca). Ugašena kategorija bez ijedne vidljive reklamacije nikog ne zanima i ne šalje se. Redosled: `sort_order`, pa `name`.
- **Brojanje:** UNION obe tabele po opsegu, `deleted_at IS NULL`; `total` = sve (uključujući arhivirane — lista ih prikazuje, pa „Ukupno" na listi mora da se slaže sa listom; statistika koja arhivirane isključuje je drugi ekran); `pending` = `outcome = 'pending'`. Jedan upit, `COUNT(*) FILTER`.
- **Keš:** bez server-side keša (dva grupisana brojanja, jeftino). Klijent: `claimKeys.categoryCounts()` = `[...claimKeys.all, 'category-counts']`, `staleTime` kao lista. **Osvežavanje** na dva puta, oba već postoje: (a) `invalidateInternalClaimQueries` (posle svake mutacije reklamacije i na SSE događaj reklamacije) dobija još jedan `invalidateQueries` za ovaj ključ; (b) `ResourceChangedKey.ClaimCategories` (preimenovanje/gašenje iz admina) mapira i na ovaj prefiks u `resource-query-map.ts`.
- **Ko ga čita:** meni (aktivne), zaglavlje liste kategorije („Nerešeno: N · Ukupno: M"), podnaslov liste „Sve" („Nerešeno: 39"), grupa „Ugašene" u filteru kategorije, mrvice (ime kategorije po kodu). Filter kategorije na listi **prestaje** da čita šifarnik direktno — jedan izvor za sve.

### 4.4 Šta se NE menja

`GET /api/claims` (filter `categoryCode` već postoji) · obe create/update rute i njihove šeme · statistika · portal · Excel.

---

## 5. Meni (sidebar)

Vrednosti (visine, razmaci, boje, senke) iz prototipa — ovde samo ponašanje.

- **Redosled:** 01 Početna · 02 Pristiglo · 03 **Reklamacije** (grupa) · 04 Prijem vozila · 05 Statistika. Numeracija i gate po dozvolama kao danas (`filterVisibleNavItems`); grupa nosi `CLAIMS_LIST_VIEW_PERMISSIONS`.
- **Konfiguracija** (`config/navigation.ts`): `NavItem` dobija opcioni `children: 'claim-categories'` marker (ne statičku decu — deca su upit). Jučerašnji `search` na `NavItem` se briše.
- **Deca grupe** (iz `claimCategoryCountsOptions()`): prvo **„Sve reklamacije"** (→ `/reklamacije`, broj = `totals.pending`), pa **aktivne** kategorije redom `sortOrder` (→ `/reklamacije/kategorija/$categoryCode`, broj = `pending`). Broj: amber kad > 0, prigušen (`opacity .45`) kad je 0 — po prototipu. Ime preko ~20 karaktera: ellipsis + pun naziv u `title`.
- **Zaglavlje grupe:** klik **širi/skuplja**, ne navigira; badge = `totals.pending`; caret ▾/▸. Stanje se pamti u `localStorage` ključem `mrr:internal:nav:reklamacije-open` (obrazac kao `mrr:internal:sidebar-collapsed`); podrazumevano otvoreno.
- **Aktivna pod-stavka** — jedno čisto pravilo, `activeClaimsEntry(location)`, testirano bez DOM-a:
  - `/reklamacije/kategorija/<code>` → ta kategorija;
  - tačno `/reklamacije` → „Sve reklamacije";
  - bilo šta drugo pod `/reklamacije/…` (detalj, čarobnjak) → `search.categoryCode` ako postoji, inače „Sve reklamacije".
  - Zaglavlje grupe je istaknuto kad god je neko dete aktivno. Ovo zamenjuje TanStack `activeProps` za decu grupe; ostale stavke ostaju na `activeProps`.
- **Sužen meni (icon-rail, lg+):** ikonica grupe sa amber tačkom kad `totals.pending > 0`; klik otvara **flyout** (`Popover` iz `@mr/ui`, već se koristi za zvono) sa istom listom; Esc / klik van zatvara; klik na stavku navigira i zatvara.
- **Mobilni drawer:** grupa se širi inline, isto kao pun meni.
- **Učitavanje:** loader `_shell` rute warm-uje `category-counts` **samo kad korisnik drži neku od `CLAIMS_LIST_VIEW_PERMISSIONS`** (serviser bi dobio 403, a njemu grupa i ne postoji); meni čita upit kroz `useQuery`, ne suspense — greška ili kašnjenje daju grupu bez brojeva i bez dece osim „Sve reklamacije". Meni ne sme da padne zbog brojača.
- **Paleta komandi:** i dalje lista pet stavki + Bezbednost; kategorije **nisu** u paleti (nije traženo; ako zatreba, svoja odluka). Jučerašnji test „mašinska vodi na filtriranu listu" se briše sa stavkom.

---

## 6. Mrvice u gornjoj traci (cela aplikacija)

- Zamenjuje današnji `sectionLabel` if-lanac u `internal-topbar.tsx` **istim mehanizmom kao admin** (najduži prefiks iz `internalNavItems` pobeđuje; `/settings/security` imenovano ručno) + druga razina za reklamacije.
- Oblik: `INTERNO / <SEKCIJA>[ / <DRUGA RAZINA>]`, mono, uppercase, kao prototip (`font:600 10.5px 'JetBrains Mono'`, `letter-spacing:.16em`, kosa crta `opacity:.5`, poslednji deo `--text`).
- Druga razina — samo ono što prototip crta:
  - `/reklamacije/kategorija/<code>` → ime kategorije (iz `category-counts`, po kodu; dok ne stigne — ništa);
  - detalj reklamacije → `DETALJ`;
  - `/reklamacije/nova` → ceo crumb je `NOVA REKLAMACIJA` (prototip tako crta, bez „REKLAMACIJE /");
  - Prijem, Statistika, Pristiglo, Početna, Bezbednost → jedna razina (prototip ih ne crta dublje; ne izmišlja se).
- Ispod `sm` se krije kao i danas (H1 ekrana kaže isto).
- Čista funkcija `breadcrumbFor(pathname, search, categoryName)` sa testovima; i18n ključ `topbar_app_name` = „INTERNO" / „INTERNAL".

---

## 7. Lista — jedan ekran, dva režima

### 7.1 Rute

- `/reklamacije` — režim **„Sve"** (postojeća ruta i `ClaimsSearchSchema`; `categoryCode` u search-u ostaje kao običan filter).
- `/reklamacije/kategorija/$categoryCode` — režim **„Kategorija"**; ista `ClaimsSearchSchema` minus `categoryCode` (kod dolazi iz putanje); loader: lista sa `categoryCode` iz putanje + `category-counts` + proizvođači. Nepoznat kod → prazna lista i zaglavlje bez imena (endpoint vraća prazno, ne grešku) — isto ponašanje kao filter; **ugašen kod sa zapisima** radi normalno (nije greška).
- **Jedna komponenta** (`ClaimsListContent` + `ClaimsFilters` + `ClaimsTable`) sa `mode: 'all' | 'category'` i `category?: { code, name, counts }` — ne dve.

### 7.2 Zaglavlje (iz prototipa)

- **Kategorija:** eyebrow `KATEGORIJA` (crveni mono) · H1 ime kategorije · podnaslov „Nerešeno: N · Ukupno: M" (iz `category-counts`).
- **Sve:** eyebrow `SVE VRSTE POSLA` · H1 „Sve reklamacije" · podnaslov „Obe vrste, sve kategorije · Nerešeno: N".
- Desno jedno dugme **„+ NOVA REKLAMACIJA"** (svetla ispuna `--mri-btn`), vidljivo ako korisnik sme da kreira **bar jednu** vrstu; vodi na `/reklamacije/nova` sa `categoryCode` iz režima (u „Sve" bez njega).
- Kartica tabele: naslov „Reklamacije — <kategorija>" / „Sve reklamacije" + `UKUPNO: n` (n = `total` iz odgovora liste pod trenutnim filterima — to je broj redova koje tabela zaista ima).

### 7.3 Filteri

- **Sve:** svi današnji filteri; select **Kategorija** čita `category-counts`: aktivne kao obične opcije, pa grupa **„Ugašene"** sa onima koje imaju zapise (ako `SearchableSelect` nema grupe, dobija ih — cmdk ih podržava; ne suffiks u imenu).
- **Kategorija:** selecta **nema**; na njegovom mestu dashed čip `KATEGORIJA = MAŠINSKA OBRADA ✕` (prototip `isCat`); **✕ vodi na `/reklamacije`** i prenosi ostale filtere (pretraga, vrsta, ishod, proizvođač, datumi, strana 1). „Poništi filtere" u režimu kategorije **ne dira** kategoriju (ona nije filter, ona je mesto).
- Sve ostalo (pretraga, segment VRSTA, ishod, proizvođač, datumi, veličina strane, pamćenje veličine) — kao danas, **prototip je minimum**.

### 7.4 Tabela

- Kolona **Kategorija** samo u režimu „Sve" (čip: `--mri-inbg` + `border2`, mono 10px). U režimu kategorije je nema — svaki red je ta kategorija.
- **Ugašena kategorija na redu:** čip sa `†`, dashed ivica, prigušen tekst (čita `category.isActive`).
- Sve postojeće kolone, čekiranje, sortiranje i radnje ostaju; prototipsko `→` je placeholder, naše radnje (oko, kanta) ostaju.
- Red vodi na detalj sa `search: { ...CLAIM_DETAIL_DEFAULT_SEARCH, categoryCode }` **samo u režimu kategorije** — to je ono što meniju i mrvicama kaže odakle si došao. `ClaimDetailSearchSchema` zato dobija opcioni `categoryCode` (oba detalja ga već dele); čarobnjak ga ima u svom search-u (§8.1).

### 7.5 Prazna stanja

- **Kategorija bez ijedne reklamacije** (nema nijednog filtera osim kategorije i `total === 0`): kartica sa ikonicom, „U ovoj kategoriji još nema reklamacija", italic rečenica, dugme „+ Nova reklamacija" (ide sa kategorijom).
- **Filter bez pogotka** (bilo koji filter aktivan): „Nijedna reklamacija ne odgovara filterima" + „Poništi filtere".
- Razlika se računa na klijentu iz search-a (kao u prototipu `emptyCat`), bez novog podatka.

---

## 8. Čarobnjak — jedna ljuska, dve forme

### 8.1 Ruta i ulazi

- `/reklamacije/nova`, search `{ kind?: 'emotive' | 'domace', categoryCode?: string }`.
- Ulazi: dugme na listi (nosi `categoryCode` iz režima), prazno stanje kategorije, paleta (`?kind=`; korak „Vrsta" preskočen, u stepperu označen završenim, „Nazad" vraća na njega).
- Loader: `prefetchClaimEditReferences` (već uključuje kategorije i zadužene radnike) + `category-counts`.
- Stari fajlovi `emotive/nova.tsx` i `domace/nova.tsx` se **brišu**; `DomaceClaimCreateForm` i njeni testovi se brišu **tek kad novi DOMAĆE tok prođe svoje testove** (isti komit, ali tim redom u radu).

### 8.2 Ljuska (`ClaimCreateWizard`)

- Drži: `kind` (null dok se ne izabere), `categoryId` (iz `categoryCode` u search-u → id preko šifarnika; bez koda — prazno), `step`.
- **Zaglavlje:** „← Nazad" · eyebrow `NOVA REKLAMACIJA` · naslov koraka · desno **čip kategorije** `KATEGORIJA: MAŠINSKA OBRADA ▾` (prototip `toggleCatMenu`): meni svih **aktivnih** kategorija (šifarnik), promena važi odmah. Bez izabrane kategorije čip piše `KATEGORIJA: IZABERI ▾` i **čuvanje je nemoguće** dok se ne izabere (korak „Pregled" to kaže rečenicom, dugme mrtvo — ista vrsta mrtvog dugmeta kao na prijemu: imenuje šta fali).
- **Stepper:** 4 koraka `VRSTA · PODACI · KVAROVI · PREGLED`; krug 26px, aktivan crven, završen zelena tinta + ✓, budući outline; spojnice zelene kad je korak završen (prototip `steps`). Postojeći `WizardStepper` se proširuje na ovo stanje (završen/aktivan/budući) umesto da se piše drugi.
- **Izlaz** („← Nazad" i „Nazad" sa koraka 1 na „Vrsta" kad je forma prljava): `<ConfirmDialog>` — „Izgubićeš uneto". Osvežavanje/zatvaranje taba se **ne** presreće (nije traženo; beleži se kao odluka).
- **Promena vrste** posle unetih podataka: isti `<ConfirmDialog>`, jer su forme odvojene i druga ne nasleđuje ništa.
- Kind-specifična forma dobija od ljuske: `categoryId` (kontrolisano — polje kategorije **nestaje iz koraka „Podaci"**, čip ga zamenjuje), `categoryFields` (§10, danas prazno), `onSaved(claim)`.

### 8.3 Korak „Vrsta"

- Dve velike kartice (prototip `w0`): EMOTIVE (plavi pill; partner iz sistema, portal Primljeno → U obradi → Ishod, nalaz na engleskom) i DOMAĆA (ljubičasti pill; kupac kao tekst, bez portala, iznosi). Hover: lift + tinta ivice u boji vrste. **Klik = izbor + odmah korak 2.**
- Kartica vrste koju korisnik **ne sme** da kreira (nema `<kind>_claims.create`) je onemogućena sa rečenicom zašto; nema automatskog preskakanja kad je dozvoljena samo jedna (jedno pravilo, manje koda).
- Rečenica iznad kartica kad je kategorija već izabrana: „Kategorija je već izabrana — ostaje samo vrsta…" (prototip); bez kategorije: rečenica da se bira čipom.

### 8.4 EMOTIVE koraci (postojeći, `StepBasicFields` → `StepFaultsFields` → `StepReview`)

- Nepromenjeni osim: kategorija više nije polje u koraku „Podaci" (stiže od ljuske); `StepReview` dobija red `KATEGORIJA`; dugmad (NAZAD outline · DALJE primarno · ✓ SAČUVAJ zeleno) su ljuskina. **Zaštita od čuvanja na prelazu kvarovi → pregled** (dugme nije `type="submit"`, komentar u današnjem čarobnjaku) ostaje — i važi za obe forme jer je dugme u ljusci.
- Obavezna polja (crvena zvezdica) po **stvarnoj Zod šemi** (`emotiveClaimStepBasicSchema`), ne po prototipu.

### 8.5 DOMAĆE koraci (novi, od postojećih delova)

- `DomaceBasicFields` (postoji; iznosi, broj računa, kupac kao tekst) → `StepFaultsFields` (već deljen) → **novi `DomaceStepReview`** po obrascu EMOTIVE pregleda (key/value redovi, labela mono 190px, mono za kodove/datume, plava nota „otvara se sa ishodom Na čekanju; domaća reklamacija se ne prikazuje na portalu").
- Šema, serializer (`serializeDomaceCreateBody`) i hook (`useCreateDomaceClaim`) **ostaju isti** — payload ka `/api/domace-claims` je nepromenjen, što test dokazuje upoređivanjem sa današnjim (§12).
- DOMAĆE i dalje lista **sve** aktivne radnike za zaduženog (DOMAĆE izuzetak od pravila „samo sklapanje"), kao danas.

### 8.6 Hook-ovi za kreiranje

- Oba hook-a rade isto: POST + `invalidateInternalClaimQueries` (koja sad osvežava i brojače). **Navigacija i toast izlaze iz hook-ova u ljusku**, jer samo ona zna kategoriju i poruku. EMOTIVE hook danas navigira na `/reklamacije` iz `onSuccess` — to se seli.

### 8.7 Posle čuvanja

`navigate({ to: '/reklamacije/kategorija/$categoryCode', params: { categoryCode: <sačuvana> } })` + `showInternalToast` „Reklamacija MR 7168/25 sačuvana — Mašinska obrada". Nema više info-note sa linkom (DOMAĆA) ni sletanja na opštu listu (EMOTIVE).

---

## 9. Detalj

Detalj **ostaje kakav jeste** (tabovi, sekcije, radnje, TipTap). Prototipski detalj je skica našeg; uzimaju se samo:

1. **Čip kategorije u naslovnom redu**, odmah uz `KindPill` (oba zaglavlja: EMOTIVE i DOMAĆE): mono, `--mri-inbg` + `border2` (prototip `dCatSt`). Ako je kategorija ugašena: dashed ivica + značka `KATEGORIJA UGAŠENA MM/YY` (datum iz `deactivatedAt`, format `MM/YY` preko `Intl`), informativno, ne greška.
2. **Kartica „Polja kategorije"** (dashed ivica, namerno drukčija) — §10; renderuje se **samo ako kategorija ima definisana polja**, što je danas nikad.

Ne dodaje se: „← Nazad na listu" link (meni i mrvice već kažu gde si; ako zatreba, svoja odluka), „Prihvati/Odbij" dugmad iz prototipa (postojeće radnje ishoda ostaju), desna kartica „Klijent vidi" (postoji u drugom obliku).

Read-only `DetailItem` „Kategorija" u osnovnim podacima ostaje gde je.

---

## 10. „Polja kategorije" — prazan kontejner sada, sadržaj u Fazi 2

Zahtev §9 (Nikola): polja mašinske će se menjati; sakrivanje nije odgovor; stara reklamacija ne sme da izgleda kao da je neko zaboravio polje; statistika mora da zna nad čime broji.

**Šta se gradi sad** (odluka 9):

- `@mr/shared`: tip `ClaimCategoryFieldDefinition { id, categoryId, key, labelSr, labelEn, retiredAt: string | null }` i spisak `CLAIM_CATEGORY_FIELD_DEFINITIONS: readonly ClaimCategoryFieldDefinition[] = []`. **Prazan, i u kodu samo privremeno** — Faza 2 ga seli u šifarnik (tabela koju admin uređuje) i daje vrednostima kolonu. Komentar u fajlu to kaže doslovno.
- Čista funkcija `resolveCategoryFieldStates(definitions, values) → Array<{ key, label, state: 'filled' | 'empty' | 'retired', value }>` sa testovima za **tri stanja**: popunjeno → vrednost; postoji a prazno → italic „Nije popunjeno"; `retiredAt` postavljen → značka `UKINUTO MM/YY` uz labelu, vrednost sačuvana i prikazana prigušeno. **Ukinuto polje sa vrednošću se nikad ne sakriva.**
- Komponente: `CategoryFieldsGroup` (dashed okvir u koraku „Podaci", naslov `POLJA KATEGORIJE · <KATEGORIJA>`) i `CategoryFieldsCard` (detalj). Obe primaju **već filtrirane** definicije (po `categoryId`, data-driven) i vrednosti; obe **ne renderuju ništa** kad nema definicija — nikad prazan okvir (to bi bio ekran-obećanje, a to je baš ono što je Nikola ubio).
- Korak „Pregled" dobija redove za ta polja (danas nijedan).
- Polje „Obrađeni deo" (Glava/Blok/Radilica) iz prototipa se **ne pravi** — ne postoji u bazi, i handoff to izričito zabranjuje.

**Šta je Faza 2:** tabela definicija u šifarniku + CRUD u adminu · kolona za vrednosti na reklamaciji · `retiredAt` kao pravi datum ukidanja · statistika koja uz presek piše nad kojim poljem broji.

---

## 11. i18n

Svi novi nizovi kroz Paraglide, SR + EN, bez brojevne množine („Nerešeno: 9", nikad „9 reklamacija"). Grupe ključeva: meni (grupa, „Sve reklamacije", „Prijem vozila", flyout naslov) · mrvice (`INTERNO`, `DETALJ`, `NOVA REKLAMACIJA`) · lista (eyebrow ×2, H1 „Sve reklamacije", podnaslovi, naslov kartice, čip `KATEGORIJA =`, „Ugašene", prazna stanja ×2 + „Poništi filtere") · čarobnjak (koraci, naslovi koraka, kartice vrste sa opisima, čip `KATEGORIJA:` / `IZABERI`, poruka o obaveznoj kategoriji, potvrda izlaza, nota pregleda ×2, toast sa kategorijom) · detalj (`KATEGORIJA UGAŠENA`, „Polja kategorije", „Nije popunjeno", `UKINUTO`). EN je do ~35% duži — meni i čipovi ellipsis + `title`. Posle izmene poruka: `compile` za dev, `build` za gejt.

---

## 12. Testovi — šta se dokazuje (i šta se mutira)

Svaki zadatak: test prvo (crven), pa kod; mutacija tamo gde je označeno ⚙.

- **API `category-counts`:** ⚙ opseg (korisnik samo sa `domace_claims.view` ne dobija EMOTIVE brojeve — ukloniti filtriranje po opsegu → crveno) · ugašena bez zapisa se ne vraća, ugašena sa zapisima se vraća sa `isActive:false` · `pending` broji samo „Na čekanju", `total` i arhivirane · 403 bez dozvole.
- **Šifarnik:** ⚙ gašenje postavlja `deactivated_at`, paljenje ga briše (ukloniti jedno → crveno); migracija od nule prolazi (integracioni setup).
- **Invalidacija:** posle kreiranja reklamacije ključ brojača je invalidiran; SSE `ClaimCategories` ga invalidira.
- **Meni:** ⚙ `activeClaimsEntry` za pet putanja · grupa gate po dozvolama (serviser ne vidi grupu) · pamćenje otvorenosti · flyout se otvara u suženom stanju i zatvara na izbor · paleta lista pet stavki bez kategorija.
- **Mrvice:** ⚙ `breadcrumbFor` za sve sekcije i tri druge razine.
- **Lista:** režim kategorije krije select i kolonu, ✕ vodi na `/reklamacije` sa prenetim filterima · „Poništi" ne dira kategoriju · † čip za ugašenu · dva prazna stanja se razlikuju · dugme „Nova" nosi kategoriju.
- **Čarobnjak:** ⚙ čip postavlja `categoryId` u payload **obe** vrste (ukloniti prosleđivanje → crveno) · bez kategorije čuvanje mrtvo i rečenica imenuje šta fali · `?kind=` preskače korak i stepper ga označava · kartica bez dozvole onemogućena · izlaz sa prljavom formom traži potvrdu · DOMAĆE payload identičan današnjem (snapshot istog ulaza kroz stari i novi tok) · posle čuvanja: navigacija na kategoriju + toast.
- **Detalj:** čip uz `KindPill` u oba zaglavlja · značka sa `MM/YY` kad je `deactivatedAt` postavljen · kartica „Polja kategorije" se ne renderuje bez definicija · ⚙ `resolveCategoryFieldStates` tri stanja (fixture, jer je config prazan).

---

## 13. Redosled rada

Svaki zadatak: pun gejt zelen (format · build/typecheck/lint `--force` · testovi u svom prolazu · depcruise · integracija, sve pod `TZ=UTC`) → jedan komit. Plan (`writing-plans`) razrađuje korake.

1. **Podaci i API:** migracija `0046` + `deactivatedAt` kroz šifarnik · `ClaimCategoryRef` proširenje · endpoint `category-counts` + shared upit + invalidacija.
2. **Meni:** grupa, deca iz upita, brojevi, flyout, pamćenje, `activeClaimsEntry`, „Prijem vozila"; brisanje jučerašnje mašinerije i stavke „Mašinska obrada"; paleta.
3. **Mrvice** u gornjoj traci, cela aplikacija.
4. **Lista:** ruta kategorije, dva režima, čip, kolona, „Ugašene" u filteru, prazna stanja, link ka detalju sa kategorijom.
5. **Čarobnjak:** ljuska + „Vrsta" + čip + EMOTIVE koraci uvezani · DOMAĆE koraci + pregled · seljenje navigacije/toasta iz hook-ova · brisanje starih ruta i duge forme · paleta na novu rutu.
6. **Detalj + Polja kategorije:** čip i značka u oba zaglavlja · tip, prazan spisak, resolver, dve komponente, red u pregledu čarobnjaka.
7. **Završetak:** prolazak kroz pregledač (Playwright, `TZ=UTC`, oba jezika, tamna + svetla) sa screenshotovima iz handoffa §8 · `docs/04` rečenica o ljusci · CLAUDE.md (§2 invarijanta kategorije, §5 brisanje jučerašnjeg pravila o dve stavke, §9 stanje) · završni pregled grane.

Posle: merge `feat/claim-category` → `main` (= deploj; migracije `0045` + `0046` idu same kroz `db:migrate:deploy`), pa **jednom** `pnpm --filter @mr/db run db:seed` u api Console (dozvola iz Faze 1; ništa novo odavde).

---

## 14. Rizici i kako se drže pod kontrolom

- **Najveći zalogaj je čarobnjak.** Zato DOMAĆE tok dobija test identičnosti payload-a pre nego što se stara forma obriše, i zato dugmad i zaštita od preranog čuvanja žive u ljusci — jedno mesto, obe vrste.
- **Brojevi u meniju na svakom ekranu** = jedan upit više po učitavanju ljuske. Jeftin (dva grupisana brojanja), keširan na klijentu, osvežava se samo na događaje. Ako se pokaže skupim, server-side keš kroz postojeći `SummaryCache` je jedan red — ne sad.
- **Dve stavke na istoj ruti** više ne postoje — ali ako se nekad opet pojave, pravilo iz jučerašnje beleške (TanStack podskup) i dalje važi; u CLAUDE.md ostaje jedna rečenica upozorenja, ne ceo mehanizam.
- **Prazan kontejner „Polja kategorije"** je kod koji čeka. Da ne bude ekran-obećanje, nikad se ne renderuje bez definicija, a resolver je testiran fixture-ima pa je spreman kad Faza 2 da podatke.

---

## 15. Čega nema (ne crtati, ne praviti)

Definicije polja u bazi · „Obrađeni deo" · kategorije u paleti · druga razina mrvica van reklamacija · „← Nazad na listu" na detalju · presretanje zatvaranja taba · automatsko preskakanje koraka „Vrsta" · izmena forme za pretvaranje pristigle prijave · bilo šta na portalu, statistici, Excelu.
