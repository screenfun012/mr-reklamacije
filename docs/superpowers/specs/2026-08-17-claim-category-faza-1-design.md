# Kategorija reklamacije (Faza 1) — dizajn

**Datum:** 2026-08-17
**Grana:** nova, iz `main`
**Prethodi mu:** sastanak u firmi 16.08.2026 — četiri zaključane odluke (kategorija = polje;
obaveznost po fazi; uzrok = DEO+KVAR; nova uloga „radnik")
**Status:** **ODOBREN — Nikola, 20.08.2026.** Migracija `0045` izričito odobrena, backfill potvrđen
(§10). Kod kreće od Z-1.

---

## 1. Zašto

Sa sastanka: reklamacije prestaju da budu tabela koju popunjava jedan operater i postaju mesto gde
cela firma beleži **zašto se nešto desilo**. Prvo pitanje svakog izveštaja je **na čemu** se desilo:
mašinska obrada, generalni remont motora, novi delovi, auto-servis. Danas se to ne beleži nigde, pa
se ne može ni filtrirati ni prebrojati.

Odluka sa sastanka je da je kategorija **polje, ne nova familija reklamacija**. To ubija fazu M-1 iz
`docs/16` (mašinska obrada kao treća tabela, ~5.500 linija) i odgovara na otvoreno pitanje iz
`docs/22` §2.1 („unutra ili pored?") sa **unutra, kao polje**.

Faza 1 je namerno mala. Ona ne uvodi uzrok (Faza 2), ne uvodi prijavu od bilo kog radnika (Faza 3) i
ne uvodi uslovno zatvaranje (Faza 4). Ona uvodi **jedno polje i sve što od njega živi**, jer 50 ljudi
koji prijavljuju pre nego što šifarnik postoji proizvode hiljade slobodnih tekstova koje niko ne može
da prebroji — a to je tačno ono zbog čega ceo projekat postoji.

## 2. Šta je provereno u kodu (a ne pretpostavljeno)

Šest nalaza menja koliko posla Faza 1 stvarno jeste:

1. **Šifarnik se ne piše od nule.** Admin ima generički `ResourceListPage` i osam gotovih
   `resources/*.definition.ts` (lista, forma, deaktivacija, reaktivacija, tvrdo brisanje kad je
   `usageCount` nula). API modul kataloga je izmereno **6 fajlova / ~450 linija**
   (`modules/engine-manufacturers`). Novi katalog je popunjavanje šablona, ne izmišljanje.
2. **Filter u statistici je JEDNO mesto.** Svaka sekcija zove `buildActiveClaimWhere`
   (`statistics-claim-filter.ts:120`), a filter po proizvođaču je tamo jedan uslov (`:133`). Isti
   uslov za kategoriju znači da **sve postojeće sekcije** (trend, ishodi, po zaposlenom, po tipu
   motora, iznosi, po partneru, kvarovi) odmah poštuju kategoriju — bez ijedne izmene u njima.
3. **Filter u listi je DVA mesta.** Objedinjena lista je UNION dve tabele, pa proizvođač ima uslov u
   obe grane (`claims.repository.ts:231` i `:338`). Kategorija ide isto — dva uslova, ne jedan.
4. **Statistika po kategoriji ima gotov oblik.** `byManufacturer` već vraća `{id, code, name, total,
   pending, accepted, rejected}` i crta se kao rang-lista („Po partneru"). Sekcija `byCategory` je
   isti oblik i isti grafikon.
5. **Ekran „Mašinska obrada" je prazan placeholder** (`routes/_shell/masinska-obrada.tsx`) — nema
   tabelu, API ni formu, i gejtovan je istim dozvolama kao reklamacije (`navigation.ts:52`).
   Nema šta da se migrira, samo da se zameni.
6. **Portal već ima pripremljen filter, ali mu je lista TVRDO prazna:**
   `filter === 'machining' ? [] : list.items` (`portal-web/src/routes/claims/index.tsx:80`).
   ⚠ Njegov finiji `PortalServiceType` (`'head' | 'block' | 'crank'`) **nije ista osa** — to je DEO
   iz Faze 2. Gruba podela „remont / mašinska" jeste kategorija i može da se poveže sada.

Ostalo zatečeno stanje, korisno za gradnju:

- Katalozi su svi istog oblika: `id, code, name, sort_order, is_active, timestamps, deleted_at` +
  `uniqueIndex` na `code` (`schema/catalogs.ts`). `sortOrder` ide 10, 20, 30… (seed konvencija).
- Dozvole kataloga su `settings.<ime>.manage`, i tri najnovija (prijem) su **namerno van**
  `OPERATOR_PERMISSIONS` — Nikolina rečenica „jer ako to ne uradimo onda admin deo gubi smisla"
  (`permissions.ts:141-145`).
- `catalog_added` notifikacija postoji samo za tri kataloga koja **blokiraju unos** (kupci, tipovi
  motora, proizvođači).
- Poslednja migracija je **`0044`** → nova je `0045`.
- Excel listovi su preslikani pravi poslovni fajlovi (EMOTIVE 12 kolona, DOMAĆE 15,
  `build-reklamacije-workbook.ts:12` i `:28`).

## 3. Model

### 3.1 Šifarnik `claim_categories`

Isti oblik kao `engine_manufacturers` — jedno ime, ne dva.

| kolona | tip |
| --- | --- |
| `id` | `uuid` PK |
| `code` | `text` NOT NULL, unique |
| `name` | `text` NOT NULL |
| `sort_order` | `integer` NOT NULL default 0 |
| `is_active` | `boolean` NOT NULL default true |
| `created_at` / `updated_at` / `deleted_at` | kao svi katalozi |

Četiri reda, redosledom sa sastanka:

| code | name | sort_order |
| --- | --- | --- |
| `REMONT_MOTORA` | Generalni remont motora | 10 |
| `MASINSKA_OBRADA` | Mašinska obrada | 20 |
| `NOVI_DELOVI` | Novi delovi | 30 |
| `AUTO_SERVIS` | Auto-servis | 40 |

### 3.2 Kolona na reklamacijama

`category_id uuid` na **obe** tabele (`emotive_claims`, `domace_claims`), strani ključ na
`claim_categories(id)` sa `ON DELETE RESTRICT`, **indeksiran** u obe (Drizzle ne pravi indeks nad
stranim ključem sam, a ovo postaje WHERE i GROUP BY kolona i u listi i u statistici).

**U bazi je NULL dozvoljen, u aplikaciji nije.** Baza mora da primi 134 postojeće reklamacije koje
kategoriju nemaju; Zod na unosu je taj koji je traži. Server je sudija — kao svuda.

### 3.3 Pravilo

- **Kreiranje:** `categoryId` je obavezan (obe familije, obe forme). To je „Prijava" faza iz odluke
  br. 2 sa sastanka.
- **Izmena:** `categoryId` je takođe obavezan — reklamacija koja se dira ne sme da izađe iz izmene
  nekategorisana.
- Faza 1 **ne uvodi** `claimMissingForClose` ni bilo kakvu mašinu faza. To je Faza 4.

⚠ Pravilo iz izmene ima smisla samo uz backfill (§7, pitanje 1). Bez njega bi otvaranje stare
reklamacije radi ispravke slova tražilo da se prvo izabere kategorija.

### 3.4 Mašinska reklamacija ne dobija nijedno novo polje

Nikolina reč, 17.08.2026:

> „Možda se desi da neke stvari iskoristimo i sada ovde za mašinsku — tipa koji je tip motora, N47,
> ili proizvođač ili tako nešto, radnik. Ti podaci su nam svakako bitni."

Znači forma ostaje jedna: tip motora, proizvođač, zaduženi radnik, datumi, MR broj — sve to važi i
za mašinsku obradu i vredi zabeležiti. **Faza 1 ne dodaje nijednu kolonu osim `category_id`.** To je
i dokaz da je odluka „kategorija = polje, ne familija" tačna: da su polja različita, tražila bi
svoju tabelu.

⚠ Jedno ograničenje, zabeleženo da se ne otkrije usput: `emotive_claims.engine_type_id` je **NOT
NULL** (`schema/claims.ts:36`), dok je kod DOMAĆIH nullable. Dok god svaka kategorija ima tip motora
— a po gornjem ima — to ništa ne menja. Ako se ikad pojavi kategorija koja ga nema (recimo čist
auto-servis bez motora), to ograničenje je prvo na šta se nailazi i traži svoju migraciju.

## 4. Odluke — i šta je odbijeno

1. **Jedno ime, ne `name_sr` + `name_en`.** Katalozi prijema nose dva imena jer je odštampani nalog
   dvojezičan; kategoriju u Fazi 1 ne čita nijedna dvojezična površina. Ako ikad ode na portal ili u
   Excel, `name_en` je jedna migracija nad četiri reda. Odbijeno: dva imena odmah — svaki admin bi
   od danas kucao englesko ime koje niko ne čita.
2. **Filter u URL-u je `categoryCode`, ne `categoryId`.** Odstupanje od `manufacturerId` je namerno:
   stavka menija „Mašinska obrada" mora da bude običan link, a uuid u linku nije stabilan između
   baza i nije čitljiv u obeleživaču. Kod je već stabilan ključ ovog repoa za kataloge na koje se
   veže (isti razlog zbog kog nalog prijema čuva kod ček-liste, ne id). Upit filtrira poluspojem
   (`category_id IN (SELECT id FROM claim_categories WHERE code = $1 AND deleted_at IS NULL)`) —
   nepoznat kod vraća praznu listu, ne grešku.
3. **Četiri reda ulaze migracijom, ne seed fajlom.** Backfill (§7) mora da ima šta da pokaže u
   trenutku migracije, a `db:seed` se pušta tek posle nje. Dva mesta koja proglašavaju iste četiri
   kategorije bila bi krpljenje. Presedan: migracija `0034` je isto tako sama upisala `SKLAPANJE`.
   Posledica: **posle deploja NIJE potreban `db:seed` zbog kataloga** — jeste zbog nove dozvole.
4. **Dozvola je `settings.claim_categories.manage`, admin-only.** Van `OPERATOR_PERMISSIONS`, po
   presedanu kataloga prijema i po Nikolinoj rečenici o smislu admin dela. Čitanje kataloga ide uz
   dozvole koje ionako čitaju reklamacije (isti spisak kao `GET /api/engine-manufacturers`).
5. **Bez `catalog_added` notifikacije.** Ta notifikacija postoji za kataloge na kojima operater
   zapne usred unosa. Kategorija se seeduje jednom i peta se dodaje planski, iz admina.

## 5. Zadaci — svaki se završava svojim komitom

| # | Šta | Gde |
| --- | --- | --- |
| Z-1 | **Migracija `0045`**: tabela, dve kolone, dva indeksa, četiri reda, backfill | `packages/db` |
| Z-2 | API modul `claim-categories` (6 fajlova, šablon proizvođača) + dozvola + Zod šeme + reference query + `ResourceChangedKey.ClaimCategories` + mapa ključeva za SSE | `apps/api`, `packages/shared` |
| Z-3 | Admin ekran: `claim-categories.definition.ts` + ruta pod `settings/` + i18n ključevi | `apps/admin-web` |
| Z-4 | Polje na reklamaciji: create/update validatori, mapiranja u repou, EMOTIVE čarobnjak + DOMAĆE forma + oba detalja, kolona u tabeli liste | `apps/api`, `apps/internal-web` |
| Z-5 | Filter: `ClaimListQuerySchema`, `ClaimsSearchSchema`, dva uslova u repou, jedan `SearchableSelect` u traci filtera | `packages/shared`, `apps/api`, `apps/internal-web` |
| Z-6 | Statistika: jedan uslov u `buildActiveClaimWhere` + sekcija `byCategory` + rang-grafikon | `apps/api`, `packages/shared`, `apps/internal-web` |
| Z-7 | „Mašinska obrada": stavka menija vodi na prefiltriranu listu, placeholder ruta se briše (uz `routeTree.gen.ts` i test palete) | `apps/internal-web` |
| Z-8 | *(opciono, vidi §6)* Portal: kartica „machining" čita pravu kategoriju umesto tvrde prazne liste | `apps/portal-web`, `packages/shared` |

## 6. Šta Faza 1 NE dira

- **Excel.** Oba lista su preslikani fajlovi koje kancelarija zna po kolonama; kolona više je tvoja
  odluka i prirodno pripada Fazi 5 (izveštaji). Reci ako hoćeš suprotno.
- **Uzrok, deo, kvar** — Faza 2. Kategorija odgovara na „na čemu", uzrok na „zašto".
- **Portal, ako Z-8 otpadne.** Tada kartica „machining" ostaje tvrdo prazna, što od dana kad
  mašinske reklamacije postoje **prestaje da bude istina**. Zato Z-8 postoji: 20-ak linija koje
  uklanjaju laž. U Fazi 2 se ista površina samo profinjuje (glava/blok/radilica), ne prepravlja.
- **Mašina faza i uslovno zatvaranje** — Faza 4.

## 7. Pitanja — dva odgovorena, jedno otvoreno

1. ✅ **Backfill: DA, sve postojeće → „Generalni remont motora".** Nikola, 17.08.2026: *„Ovo što smo
   do sada unosili i koristili je bilo za reklamacije celog motora."* Time nema kofe „Bez
   kategorije", statistika po kategoriji ima smisla od prvog dana, i pravilo iz §3.3 (kategorija
   obavezna i pri izmeni) ne blokira nijednu staru reklamaciju.
2. ✅ **„Mašinska obrada" ostaje stavka u meniju** i dobija sadržaj — prefiltriranu listu
   reklamacija. Nikola: *„mislim da smo se već dogovorili u vezi ovoga."* Poklapa se sa tabelom faza
   sa sastanka („mašinska prestaje da bude ekran u pripremi") — ekran ostaje na svom mestu, samo
   prestaje da bude prazan.
3. ✅ **Imena su potvrđena, četiri, nema pete** (Nikola, 17.08.2026): **Generalni remont motora ·
   Mašinska obrada · Novi delovi · Auto-servis**. Tabela u §3.1 je konačna. Peta se, ako zatreba,
   dodaje iz admina bez migracije.

## 8. Migracija i produkcija

- `0045`, generisana kroz `drizzle-kit` (nikad ručni SQL), sa dokazanim lancem od nule na praznoj
  bazi pre primene. **Traži tvoje izričito odobrenje** — migracije i auth se ne diraju bez njega.
- Backfill je deo iste migracije (forward-only; ispravka bi bila nova migracija).
- **Posle deploja, JEDNOM: `pnpm --filter @mr/db run db:seed`** — zbog nove dozvole
  `settings.claim_categories.manage`. Seed je aditivan; admin je ionako ima preko resolvera.
- Katalog **ne** traži seed (odluka 4 u §4).

## 9. Dokaz pre komita

- Integracioni testovi: kreiranje bez kategorije → 400 (obe familije, Zod na granici — repo tako
  mapira svaki `ZodError`, nikad 422 za ovo); filter po kodu vraća samo tu
  kategoriju; nepoznat kod vraća praznu listu; `byCategory` broji ishode isto kao `byManufacturer`;
  brisanje kategorije u upotrebi → 409 (`ON DELETE RESTRICT`).
- Mutaciono testiranje na dva mesta koja se lako razlaze: uslov u `buildActiveClaimWhere` i **oba**
  uslova u objedinjenoj listi (grana `dc` se najlakše zaboravi).
- Pun gejt zelen pre svakog komita; prolaz kroz pregledač za unos i filter.

---

## 10. Potvrđeno 20.08.2026 (pre prve linije koda)

Admin panel je tog dana otišao na live (`588d3e9`) i Faza 1 je puštena u rad. Šta je rečeno, jer
menja ili potvrđuje ono gore:

1. **Backfill potvrđen, i ne broji redove.** Nikolina reč: sve što je do sada uneto bio je generalni
   remont motora. Svaka zatečena reklamacija u obe tabele dobija `REMONT_MOTORA`. ⚠ Broj **134** iz
   §2 je slika baze iz avgusta; na produkciji ih je više. Migracija pokriva **sve redove kojima je
   kolona prazna**, nikad nabrojane.
2. **Migracija `0045` odobrena** izričito — dogovor traži njegovu reč za svaku.
3. **Menjivost je uslov, ne želja.** Njegova rečenica: ne smemo da zabodemo u jednosmernoj ulici,
   kod mora biti sređen da se sutra može menjati — ali bez priplitanja bez razloga. Praktično, i
   proverljivo pri pregledu koda: kategorija je red u šifarniku i nikad `enum`; **nijedan ekran ne
   grana po kategoriji** (`if (category === 'MASINSKA_OBRADA')` je zabranjen — kategorija je podatak,
   ne tok); kategorija se gasi, ne briše; nikakva mašinerija za buduće kategorije (generator formi,
   podesive kolone) — širina dolazi od toga što je kategorija obično polje.
4. **Redosled faza potvrđen:** 1 → 2 → 3 → 4 → 5 → 6, s tim da je Faza 3 dobila sadržaj (tačka 5).
5. **Dve odluke koje pripadaju Fazi 3, zabeležene sada da se ne izgube:** sistem hvata **sve**
   probleme, uključujući one koje majstor reši na licu mesta (forma mora biti kraća od Viber poruke);
   i **interna prijava i reklamacija kupca su dve stavke koje se kače jedna na drugu** — broje se
   odvojeno (izveštaj ne sme da sabere 380 internih sitnica i 20 pravih reklamacija u „400"), a dele
   isti rečnik uzroka.
6. **Razgovor u aplikaciji + push na telefon su ZASEBAN posao, posle faza** (njegova odluka).
   Rešeno usput, da se ne istražuje ponovo: **Firebase ne treba** — push je W3C standard (VAPID +
   service worker + `web-push`), bez vendora i bez cene po poruci; na iPhone-u radi tek kad se
   aplikacija doda na početni ekran, na Androidu i bez toga. **OpenWA otpada** — nezvanično vozi
   WhatsApp Web, protivno uslovima, trenutno polomljeno obaveznim passkey-em, i ne rešava traženo
   (razgovor uz reklamaciju). Kad taj posao dođe na red, dve stvari ulaze u njegov spec: realtime
   kanal dobija **svestan izuzetak** od pravila „samo signal" (poruka putuje sama, inače svaka poruka
   tera svakog gledaoca da ponovo povuče ceo razgovor), i **razgovor je interni — klijent ga ne sme
   videti nikada**, sa testom, kao interne beleške.

