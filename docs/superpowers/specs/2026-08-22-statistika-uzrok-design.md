# Statistika „zašto se desilo" — nad poljima kategorije (dizajn)

**Status:** PREDLOG — čeka Nikolino odobrenje (posebno migracija) · **Datum:** 22.08.2026
**Aplikacije:** `api` + `internal-web` + `admin-web` + `db` · **Grana:** `feat/claim-category`

---

## 1. Cilj

Nikolina rečenica koja je pokrenula posao: *„zanima nas statistika koji su kvarovi bili, koji
radnici su najviše imali reklamacije, pa zbog čega su oni najviše imali reklamacije"*, i uz to:
*„moramo da imamo što bogatiji vid statistike i analize, ne mora samo čist grafikon… da možemo
bukvalno za bilo šta da vidimo statistiku — zato smo i menjali reklamacije kako izgledaju i
dodavali one stvari."*

Prva polovina pitanja („ko") **već ima odgovor na ekranu** — `byEmployee` broji reklamacije po
zaduženom radniku i ima ga 108 od 123. Fali druga polovina: **šta je otkazalo**, i **ukrštanje**
te dve stvari.

---

## 2. Odluka koja je oborila prvi predlog (Nikola, 22.08.)

Predložen je bio **nov šifarnik u dva nivoa (DEO → KVAR) sa dve nove kolone** na obe tabele
reklamacija. **Nikola ga je odbio, s pravom:**

> „ne razumem zašto dodaješ polje kada već imaš odakle da vučeš… ujedno znaš ko je radio
> reklamaciju na osnovu zaduženog radnika… plus Polja kategorije znaš gde je centralizovano"

Provereno u bazi — u pravu je. Migracija `0048` je 22.08. zasejala **8 od 14 polja** koja su tačno
taj model:

| kategorija | polje „šta" | polje „kako / zašto" |
| --- | --- | --- |
| REMONT_MOTORA | `sklop_u_kvaru` (11 opcija) | `pojava_kvara` (9) |
| MASINSKA_OBRADA | `obradjeni_deo` (6) | `prijavljena_pojava` (7) |
| NOVI_DELOVI | `vrsta_dela` (12) | `razlog_reklamacije` (7) |
| AUTO_SERVIS | `vrsta_usluge` (7) | `pojava_kvara` (7) |

Ukupno 14 polja / **78 opcija** (⚠ CLAUDE.md §2 kaže 75 — dokument je već netačan, ne prepisivati
taj broj u test).

**Prava rupa nije polje — rupa je statistika nad poljima.** Nijedna od 12 sekcija ne čita
`category_field_values`; podatak se skuplja i nigde ne sabira. U planu
`docs/superpowers/plans/2026-08-21-claims-by-category-v2.md` to stoji kao **Zadatak 9** i nikad
nije napisan. Ovaj spec ga **zamenjuje i proširuje** (Zadatak 9 je pretpostavljao sekciju koja je
`null` dok se ne izabere kategorija; ovde je uvek tu, grupisana po kategoriji).

Treće mesto za istu stvar se ne pravi: uz polja kategorije već postoji i prazan slot
`findings[].type` — prisutan na svih 111 nalaza, **prazan string na svih 111**. Vidi §10.

---

## 3. Nikoline odluke koje spec sprovodi

1. **Uzrok = polja kategorije koja već postoje.** Nema nove tabele reklamacija, nema nove kolone
   na `emotive_claims`/`domace_claims`, nema novog šifarnika.
2. **Kvar zavisi od dela** — spisak kvarova se sužava prema izabranom sklopu (glava → *ventili
   krivi / pukla / vođice istrošene*; blok → *pukao / loše hilznovan*). To je **jedina** nova
   sposobnost šifarnika.
3. **Jedan uzrok po reklamaciji** — polje je jedan izbor, pa se procenti sabiraju na 100 %.
4. **Popunjava se od sada; ko hoće može retroaktivno da dopuni staru reklamaciju.** Ne pravi se
   nikakav alat za masovni unos — reklamacija je i tako uvek izmenjiva.
5. **Statistika pošteno prikazuje šta ne zna:** „Nije upisano" i „Uvedeno posle unosa" su dve
   različite kolone, ne jedna.
6. **Ništa se ne gasi.** „Kako se kvar ispoljio" ostaje — to je ono što je prijavljeno, a ne ono
   što smo našli; dve različite informacije koje se ukrštaju (§7).
7. **Nema novih imena.** Sekcije statistike nose **ime polja iz šifarnika** („Sklop u kvaru",
   „Uzrok kvara"), pa se ne sudaraju sa postojećom sekcijom „Kvarovi" (koja broji pripisanu
   krivicu). Kancelarija preimenuje polje iz admina i naslov na grafikonu se menja sam.

---

## 4. Šta se gradi — četiri dela

### A. Zavisna opcija u šifarniku (jedina izmena baze)

Jedna kolona:

```sql
ALTER TABLE claim_category_field_options
  ADD COLUMN parent_option_id uuid NULL
    REFERENCES claim_category_field_options(id) ON DELETE RESTRICT;
CREATE INDEX idx_claim_category_field_options_parent_option_id
  ON claim_category_field_options (parent_option_id);
```

**Značenje:** opcija sa `parent_option_id` se nudi **samo kad je roditeljska opcija izabrana** u
svom polju. Zavisnost polja se ne upisuje nigde — izvodi se iz dece (sva deca jednog polja
pokazuju na opcije istog roditeljskog polja). Nema nove tabele, nema `depends_on_field_id`, nema
kolone za uslovnu vidljivost.

**Server je sudija** (`apps/api/src/core/claims/validate-category-field-values.ts`, unutar
postojeće petlje):

- izabrana opcija ima roditelja, a odgovor u roditeljskom polju nije taj roditelj → **400**;
- izabrana opcija ima roditelja, a roditeljsko polje nije odgovoreno → **400**;
- **nepromenjena vrednost uvek prolazi** (postojeće pravilo) — pa premeštanje kategorije ili
  gašenje opcije ne obara tuđu izmenu.

**Admin je sudija za sam šifarnik** (`claim-category-field-options.service.ts`): roditelj mora
biti opcija **drugog polja iste kategorije** → inače **422**. Provera je u servisu, ne u SQL CHECK-u
(uslov traži podupit, a CHECK ga ne sme imati).

### B. Sadržaj: novo polje „Uzrok kvara" (samo REMONT_MOTORA)

`sklop_u_kvaru` kaže **gde**, `pojava_kvara` kaže **kako se prijavilo**. Nedostaje **šta je tačno
otkazalo** — to je novo `select` polje `uzrok_kvara` čije su opcije vezane za deo. Predlog
sadržaja (kancelarija ga dalje menja iz admina, ništa nije obavezno):

| deo | kvarovi |
| --- | --- |
| Blok | pukao · deformisana ravan · oštećeno ležišno mesto · loše hilznovan · korozija / kaverne · oštećen navoj |
| Glava | pukla · deformisana ravan · ventili ne zaptivaju · vođice istrošene · sedišta ventila · zaptivka glave popustila |
| Radilica | oštećeni rukavci · brušena van mere · savijena · pukla · oštećena prirubnica |
| Klipnjače | savijena · oštećeno oko / čaura · pukla · popustili zavrtnji |
| Klipovi i karike | polomljene karike · klip zaribao · oštećeno dno klipa · pogrešan zazor |
| Ležajevi | zaribali · oštećeni strugotinom · pogrešan zazor · pomereni |
| Razvod | kaiš / lanac preskočio · zategač popustio · bregasta oštećena · podizači |
| Pumpa za ulje | nedovoljan pritisak · zaribala · usisna korpa zapušena |
| Turbina | propušta ulje · oštećena lopatica · ležaj turbine · loše podmazivanje |
| Zaptivke | zaptivka glave · semering radilice · zaptivka kartera · pogrešno ugrađena |
| Ostalo | ostalo |

Ostale kategorije ne dobijaju zavisno polje — mehanizam im stoji na raspolaganju iz admina kad
zatreba. Mašinska obrada već ima `prijavljena_pojava`, koja ne zavisi od dela i statistika je čita
kao i svako drugo polje.

### C. Statistika — dve stvari, i druga je važnija

**C1 — sekcija „Po poljima kategorije".** Nova sekcija `byCategoryFields`: za svaku kategoriju koja
u tekućem filteru ima ijednu reklamaciju, po jedan blok, a u njemu po jedna rang-kartica za svako
`select` polje te kategorije. Kolone su opcije + dve poštene:

- **„Nije upisano"** — reklamacija je u toj kategoriji, polje je postojalo, odgovora nema;
- **„Uvedeno posle unosa"** — polje je napravljeno posle nego što je reklamacija otvorena
  (`claim.created_at < field.created_at`). Danas je to **svih 123** zatečenih; taj broj sam pada.

Ugašena opcija koju reklamacija i dalje nosi se **imenuje** i nosi oznaku †, kao svuda drugde.

**C2 — odgovor postaje FILTER, i to je celo „ukrštanje".** Umesto matrica (radnik × uzrok,
proizvođač × uzrok, mesec × uzrok — svaka svoja tabela, svoj oblik žice, svoje ograničenje broja
ćelija i svoja rupa u dozvolama), dodaju se **dva parametra filtera**: `fieldCode` + `optionCode`,
i **jedan uslov** u `buildActiveClaimWhere`.

Pošto tu funkciju zove svih 12 sekcija, klik na stubić „Glava" istog trena pretvara **ceo ekran** u
odgovor na „a šta znamo o reklamacijama kojima je pukla glava": ko ih je sklapao (`byEmployee`),
čiji su motori (`byManufacturer`), koji partner (`byCustomer`), koji mesec (`trends.byMonth`), kako
su se završile (`outcomes`), ko je bio kriv (`byFaults`), koliko su trajale (`processingDays`).

To je bogatstvo preseka koje je tražio, a košta **jedan uslov u SQL-u** — bez ijednog novog oblika
podataka, bez ograničavanja broja redova, i bez ijedne nove rupe u dozvolama (svaka sekcija
zadržava svoje uskraćivanje: `domaceAmounts` traži `statistics.view_financial`, `byEmployee` traži
`employees.view_analytics`, i oba se i dalje uskraćuju **posle** čitanja iz keša).

⚠ Kodovi polja su jedinstveni **po kategoriji**, ne globalno (`pojava_kvara` postoji i u remontu i u
auto-servisu). Zato `fieldCode`/`optionCode` **važe samo uz `categoryCode`** — `superRefine` odbija
kombinaciju bez njega. Klik na stubić svejedno postavlja sva tri, jer se kartica crta unutar bloka
svoje kategorije.

Uslov (vrednosti su ugnežđene po kategoriji od migracije `0047`, pa se čita id **polјine sopstvene**
kategorije — isto kao `category-field-usage-sql.ts`):

```sql
c.category_field_values
  -> (SELECT cc.id::text FROM claim_categories cc WHERE cc.code = ${code} AND cc.deleted_at IS NULL)
  ->> ${fieldCode} = ${optionCode}
```

`ponytail:` nad `category_field_values` nema GIN ni izraznog indeksa — na 123 reda se ne primećuje;
ako lista pređe nekoliko desetina hiljada, indeks je sledeći korak, ne prepravka.

### D. Unos — da polje ne bi ostalo prazno

Uzrok se ne zna kad se reklamacija otvara, nego kad se motor rastavi. Zato na tabu **Pregled**, dok
ijedno aktivno `select` polje kategorije nema odgovor, stoji **žuta traka**:

> ⚠ **Nije upisano šta je otkazalo** — statistika ovu reklamaciju ne može da broji. **DOPUNI →**

Dugme otvara **mali prozor sa samo tim poljima** (`CategoryFieldsGroup`, isti kontroleri: ≤3 opcije
segmentovano, >3 padajući spisak sa pretragom) i jednim ČUVAJ. Traka nestaje čim je upisano.
Put kroz „IZMENI PODATKE" ostaje netaknut.

**Ovo je čist frontend** — ekran već učitava i polja kategorije i odgovore, a `PATCH` već prima
samo svoj deo. Nula izmena na serveru.

---

## 5. Šta se NE gradi (i zašto)

- **Nema matrica / pivot tabela.** §C2 daje isti odgovor kroz filter. Matrica bi tražila nov tip
  reda (dva ida, dva koda, dva imena), novo pravilo sažimanja (top-N redova × top-M kolona + red
  OSTALO + kolona OSTALO + ugao), odluku „broji redove krivice ili reklamacije" koja protivreči
  susednoj kartici, i ograničenje broja ćelija koje bi oborilo današnji proračun „OSTALO".
- **Nema drugog endpointa.** Sve ide kroz `GET /api/statistics/summary` — jedan keš, jedan
  prefetch, jedna kapija.
- **Nema nove dozvole** → **nije potreban `db:seed` posle deploja.** Šifarnik uređuje
  `settings.claim_categories.manage`, čitanje ostaje na postojećem spisku od 10 dozvola (u kome su
  i tri `statistics.view_*` — bez njih nalog „samo Statistika" pada na 403 zbog jednog spiska).
- **Nema izvoza u Excel** dok se ne zatraži.
- **Ništa se ne gasi** u zasejanom šifarniku.
- **Nema obaveznih polja.** Odbijen unos se danas vidi kao jedna crvena traka na kraju čarobnjaka,
  ne ispod polja koje fali — prekidač se pali tek kad se ta poruka popravi.

---

## 6. Migracija (traži izričito odobrenje)

Jedna, generisana kroz `drizzle-kit` (nikad ručno pisan SQL), dokazana `migrate`-om od nule:

1. `claim_category_field_options.parent_option_id` + indeks (§A);
2. seje polje `uzrok_kvara` u REMONT_MOTORA sa ~50 opcija vezanih za `sklop_u_kvaru` (§B).

Bez brisanja podataka, bez diranja zatečenih redova, unapred-samo. Posle `db:generate` **odmah i
`db:migrate` u razvojnu bazu** — 22.08. je izostavljen taj korak i pregledač je vraćao 500 dok su
HTTP testovi prolazili (test-baza migrira od nule).

---

## 7. Šta ekran ume posle ovoga (primeri koje danas niko ne može da dobije)

- „Od 114 remonta: **glava 31 · blok 22 · radilica 14** · nije upisano 40."
- Klik na **Glava** → „od toga: sklapao **Petar 9**, Miloš 6 · proizvođač **MAN 12** · prihvaćeno
  18 od 31 · prosek obrade 12 dana · krivica: **SKLAPANJE 7**, GLAVE 4."
- „Od reklamacija koje su prijavljene kao **gubi ulje**, u 8 slučajeva je zaista bila zaptivka
  glave, a u 5 semering radilice" — veza između prijavljenog i nađenog, koja je jedini razlog što
  se polje „Kako se kvar ispoljio" ne gasi.
- „**Mašinska obrada**: mera van tolerancije 4, loša površina 2" — ista mašinerija, druga
  kategorija, bez ijednog `if`-a po kodu kategorije.

---

## 8. Testovi i dokazi

- **Integracioni** (`statistics.integration.test.ts`, izolacija po sopstvenom proizvođaču): sekcija
  broji opcije · „Nije upisano" · „Uvedeno posle unosa" · poštuje period i sve zatečene filtere ·
  imenuje ugašenu opciju sa `isActive: false` · filter po odgovoru menja **drugu** sekciju
  (`byEmployee`) — to je dokaz da uslov stvarno stoji u `buildActiveClaimWhere` · `fieldCode` bez
  `categoryCode` je 400 · uskraćivanje `byEmployee` se dešava i kad je filter po odgovoru aktivan
  (dokaz da nova sekcija nije zaobilaznica za staro pravilo).
- **Validacija zavisnosti** (`validate-category-field-values` testovi): dete bez roditelja → 400 ·
  dete uz pogrešnog roditelja → 400 · nepromenjena vrednost prolazi · roditelj iz druge kategorije
  na admin ulazu → 422.
- **Mutaciono dokazivanje** obavezno za dva čuvara: uslov filtera u `buildActiveClaimWhere` i
  provera roditelja. Zeleni test ne vredi dok se linija koju pokriva ne slomi.
- **Kroz pregledač** (Playwright iz `apps/api/node_modules/playwright`): unos kroz žutu traku,
  zavisni spisak koji se sužava, klik na stubić koji filtrira ceo ekran.

---

## 9. Zamke prenete iz mape koda (ne otkrivati ih ponovo)

1. **Nov filter se dodaje na 6 mesta**, ne na 5: `StatisticsSummaryFilters` ·
   `StatisticsSearchSchema` · `statisticsFiltersFromSearch`/`…FromFilters` ·
   `serialize-statistics-params.ts` · ključ keša u `statistics.service.ts` · **i literal
   `const kept = { kind, manufacturerId, categoryCode }` u `statistics-analytics-filters.tsx`** —
   bez poslednjeg filter tiho nestaje čim korisnik promeni period.
2. **Uskraćivanje ide POSLE čitanja iz keša** — inače prvi čitalac odlučuje šta vidi drugi.
   `null` znači „nemaš pravo", prazna lista znači „nema takvih reklamacija"; ne mešati.
3. **Server ne ograničava broj redova** ni u jednoj sekciji — top-10 + OSTALO + NEPOZNATO računa
   pregledač (`collapseRankRowsForDisplay`). Ograničenje na serveru bi slagalo tri broja iznad
   svake kartice.
4. **Ugašeni redovi se i dalje čitaju** (`listForCategory`, `activeOnly: false`, `LEFT JOIN` bez
   filtera na obrisane) — inače stara reklamacija prestane da ume da imenuje ono što nosi.
5. **Broj opcija bira kontrolu** (≤3 segmentovano, >3 padajući spisak sa pretragom) — zavisni
   spisak menja broj vidljivih opcija, pa kontrola mora da se bira **posle** sužavanja.
6. **`field_type` se ne menja posle nastanka** — odgovori su upisani po njemu.
7. **Nijedan sloj ne sme da grana po kodu** kategorije ni polja. Filtriranje putuje kodom.

---

## 10. Otvoreno (ne u ovom poslu)

- **`findings[].type`** — prazan na svih 111 nalaza. Ili dobije spisak i uđe u statistiku, ili se
  gasi. Dok se ne odluči, to je treće mesto za „zašto" koje niko ne puni. Sopstvena odluka.
- **Indeks nad `category_field_values`** — kad broj reklamacija poraste.
- **Excel** — vrednosti polja se i dalje ne izvoze.
