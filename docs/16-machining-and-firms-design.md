# 16 — Dizajn: Mašinska obrada + Firme/Klijenti

> **Status: PREDLOG — čeka Nikolino odobrenje. Nijedna linija koda još nije napisana.**
> Nastao 2026-07-06 iz razgovora sa Nikolom + mapiranja postojeće arhitekture (4-agentna analiza koda).
> Kad se odluke potvrde, ovaj dokument postaje obavezujući za implementaciju (kao docs/04 za motore).

---

## 1. Ključna postavka: dve nezavisne ose

Sistem danas ima jednu osu: **EMOTIVE / DOMAĆE** (= *ko je kupac*: inostrani partner / domaći).
Mašinska obrada uvodi drugu osu: **vrsta posla** (= *šta se radi*: ceo motor / deo — glava, blok, radilica…).

Te dve ose su **nezavisne** — brušenje radilice može biti i za domaćeg i za inostranog kupca.
Zato mašinska obrada **NIJE treći „kind"** pored EMOTIVE/DOMAĆE, nego **nova familija reklamacija**.

**ODLUKA (predlog): JEDNA tabela `machining_claims`** za mašinsku obradu, bez cepanja na
emotive/domace varijante. Razlozi:

- Nikola: „iskreno ne znam šta će sve da nam treba" → krećemo od jednostavnog, jedna tabela se
  lako širi; naknadno cepanje na dve bilo bi bolna migracija u suprotnom smeru.
- Cepanje motora na dve tabele postoji jer se polja stvarno razlikuju (izvor, iznos, kupac
  FK vs slobodan tekst). Za delove tu razliku pokrivamo kolonama (v. §3), ne dupliranjem
  ~1300 linija modula.
- Ako se ikad pokaže da inostrana i domaća mašinska obrada divergiraju, cepamo TADA, sa
  stvarnim znanjem — ne unapred na slepo.

Pravilo iz docs/04 („nikad zajednički ClaimDetail koji grana po kind-u") ostaje na snazi:
mašinska obrada dobija **svoje** rute/forme/loadere, odvojene od motora.

## 2. Šta se maksimalno PONOVO KORISTI (ne izmišlja se)

| Postojeće | Kako ga mašinska obrada koristi |
| --- | --- |
| `FaultsRepository` (parametrizovan tabelom) | treća instanca za `machining_claim_faults` — krivica radnik/odeljenje/eksterni identična |
| Ishod + zaključavanje (`core/claims/*`) | isti životni ciklus: pending → accepted/rejected/archived |
| Prilozi + TipTap izveštaj (`ClaimContextService`) | dobija i machining repo — slike/dokumenti/izveštaj rade odmah |
| Audit + SSE event bus | isti obrasci: svaki upis se audituje, `claim_*` događaji nose `kind + id` |
| Šifarnik-obrazac (kao `engine_types`) | novi šifarnik `machining_part_types` — admin CRUD skoro besplatan (deklarativna definicija) |
| `engine_manufacturers` | **ponovo se koristi** za „od kog motora je" (BMW, Audi, VW…) |
| `engine_types` | opciono „u koji motor ide" |
| Portal pripremljeni UI | `claimServiceType()` + filter „Mašinska obrada" + i18n ključevi (glava/blok/radilica) već postoje — samo se ožiče |

## 3. Model podataka

### 3.1. Šifarnik: `machining_part_types` (novi, admin CRUD)

Sedma instanca postojećeg šifarnik-obrasca (id/code/name/sortOrder/isActive/timestamps/
deletedAt/usageCount). Seed: **glava, blok, radilica** (proširivo iz admina — nikad hardkodovano,
po docs/13). FK sa reklamacije je `RESTRICT` + usageCount čuva od brisanja korišćenog tipa —
identično zaštiti tipova motora.

### 3.2. Tabela: `machining_claims`

**Sidro forme je RADNI NALOG** (Nikola: „u formi važno polje je samo radni nalog jer se to
vezuje za deo") — jedino obavezno poslovno polje pri unosu.

| Polje | Tip | Obavezno | Napomena |
| --- | --- | --- | --- |
| `work_order_number` | text | **DA** | radni nalog — sidro, tretman kao MR broj kod motora |
| `part_type_id` | FK → machining_part_types | DA | glava / blok / radilica / … |
| `manufacturer_id` | FK → engine_manufacturers | ne | „od kog motora je" (BMW, Audi…) |
| `article_code` | text | ne | artikal broj (AH01, N47…) |
| `engine_type_id` | FK → engine_types | ne | „u koji motor ide" (opciono) |
| `customer_id` | FK → customers | ne | kupac-firma (kad postoji u bazi → portal radi) |
| `customer_name` | text | ne | slobodan tekst za kupce van baze (kao DOMAĆE) |
| `total_amount` | decimal(14,2) | ne | koliko je koštalo |
| `analysis_notes` | text | ne | analiza rada/dela — interno |
| `linked_emotive_claim_id` | FK → emotive_claims, SET NULL | ne | veza na reklamaciju motora (v. §3.3) |
| `linked_domace_claim_id` | FK → domace_claims, SET NULL | ne | isto, za domaću; CHECK: najviše jedan od dva |
| + zajednički kičmeni stub | | | sequence_number, claim_number, warranty_report, date_of_claim, date_of_finish, outcome (+resolved_at), claim_year, employee_id, internal_notes, inspection_report (klijentu vidljiv EN rezime), created/updated/deleted_at, faults tabela |

**Mere/tolerancije (brušenje, skidanje glave…):** SVESNO počinjemo sa `analysis_notes`
(slobodan tekst) + prilozi (fotke/merni listovi). Strukturirana polja po tipu dela dodajemo
tek kad Nikola donese papirni proces — da ne izmišljamo kolone koje ćemo brisati.
(Nikola: „sve možemo da dodamo, posle nešto ćemo da uklonimo".)

### 3.3. Veza deo ↔ motor (ključni zahtev)

Scenario: klijent vrati motor na reklamaciju → zaključi se da je motor dobar, ali je jedan deo
loš → otvara se **nova reklamacija mašinske obrade sa NOVIM radnim nalogom** (Nikolina
procena — potvrditi) i **veže se** za reklamaciju motora.

- Veza = `linked_emotive_claim_id` **ili** `linked_domace_claim_id` (CHECK: najviše jedan) —
  isti „one-of" obrazac kao krivica.
- **Obostrani prikaz:** detalj reklamacije dela pokazuje karticu „Vezana reklamacija motora"
  (klik vodi na nju); detalj motora pokazuje sekciju „Vezane reklamacije delova".
- Veza se bira u formi/detalju pretragom po MR broju (postojeći indeksirani FTS).
- `ON DELETE SET NULL` — brisanje motora ne ruši reklamaciju dela.

### 3.4. Dozvole (nova familija)

`machining_claims.view / view_own_customer / create / update / delete / change_outcome /
restore` + `settings.machining_part_types.create / manage`. Uloge: operator/admin puna,
viewer view, client view_own_customer (kad ima `customer_id`). Seeds + admin role bypass
po postojećem obrascu.

## 4. Slojevi

- **API:** novi modul `apps/api/src/modules/machining-claims/` po obaveznoj anatomiji
  (schema/validators/repository/service/controller/routes + DI). Kreiranje/izmena = jedna
  transakcija (claim + faults + usageCount). Audit + SSE isto kao motori.
- **Ujedinjena lista + statistika:** `machining` postaje treća grana UNION-a; `ClaimKind`
  registar dobija treći ključ (labela „Mašinska", boja iz mr-* tokena — predlog uz dizajn).
  Interna lista dobija filter Tip: SVE | EMOTIVE | DOMAĆE | MAŠINSKA. Napomena za
  implementaciju: union grane se grade na ~7 mesta (claims + statistics + excel/dashboard) —
  razmotriti registry-driven petlju da treća familija bude dodatak, ne N ručnih izmena.
- **Interna aplikacija:** odvojen route tree `reklamacije/masinska/` ($id, nova) — po docs/04.
  Forma minimalna (radni nalog obavezan), detalj kao kod motora + kartica veze (§3.3).
- **Portal:** `serviceFamily` se svesno dodaje u klijentski whitelist (`client-claim.schema.ts`),
  `claimServiceType(claim)` čita stvarno polje, filter „Mašinska obrada" postaje serverski
  (ne klijentsko pražnjenje). Fine oznake (glava/blok/radilica) iz `part_type` — i18n ključevi
  već postoje.

## 5. Firme / klijenti

### 5.1. Header firme na portalu (izvor istine)

Danas: ime firme gore desno = firma **prve reklamacije na listi** (pogrešan izvor: nov klijent
bez reklamacija video bi svoje lično ime). **Popravka:** postojeći scoped endpoint
`/api/dashboard/client-summary` dobija `firmNames` iz veze klijent↔firma (`customer_users` →
`customers.name`) — server to već računa za bezbednost, samo se nikad ne šalje portalu.
Header čita to. Ništa vizuelno se ne menja.

### 5.2. Nova firma pri odobrenju klijenta (inline)

Danas: admin mora da izađe iz odobrenja → Podešavanja → Firme → napravi → vrati se.
**Popravka:** u dijalogu odobrenja, pored padajuće liste firmi, dugme **„+ Nova firma"** koje
poziva **isti** `customers.create` endpoint kao tab Firme. Garancija konzistencije (Nikolin
uslov): ista tabela `customers`, isti audit, isti SSE `ResourceChanged(Customers)` → firma se
istog trena pojavljuje u tabu Firme i u svim padajućim listama u adminu. Nula paralelnih puteva.

Uz to: `requested_company` (ono što je klijent ukucao pri registraciji) ostaje predlog imena u
dijalogu; po odobrenju se **briše** (razrešeno u pravu firmu — da ne ostaje mrtav tekst).

### 5.3. Više firmi po jednom nalogu (priprema, ne gradnja)

Baza to VEĆ podržava (veza je više-na-više; scoping već čita SVE firme naloga). **Odluka
(prepušteno meni):** norma ostaje **1 nalog = 1 firma**; ne gradimo switcher sada. Priprema:

- dijalog odobrenja i backend već rade sa listom (`customerIds[]`) — UI zasad nudi jednu;
- header (§5.1) prima **listu** imena i prikazuje prvu + „+N" ako ih je više — radi ispravno
  onog dana kad se druga firma doda, bez izmene koda;
- ekran za naknadno vezivanje/odvezivanje firmi u adminu = zaseban budući zadatak
  (dozvola `customers.link_users` već postoji).

## 6. Otvorena pitanja (Nikola potvrđuje pre/tokom gradnje)

1. Deo vezan za vraćeni motor: **novi radni nalog** (Nikolina procena) ili nasleđuje? → dizajn
   podržava oba (veza je eksplicitna kolona), ali potvrditi za formu.
2. Da li mašinska obrada za inostrane partnere ide na portal odmah (čim ima `customer_id`)
   ili tek kasnije? (Tehnički radi odmah — poslovna odluka.)
3. Strukturirana merenja po tipu dela — čeka Nikolin papirni proces (v. §3.2).
4. Naziv i boja badge-a za treću familiju („MAŠINSKA"?) — uz dizajn-pregled.

## 7. Faze gradnje (svaka: predlog → odobrenje → kod → pun gejt → commit)

| Faza | Sadržaj | Napomena |
| --- | --- | --- |
| **F-A** | Header firme (§5.1) + brisanje `requested_company` po odobrenju | ✅ **URAĐENO 2026-07-22** — bez migracije |
| **F-B** | „+ Nova firma" u dijalogu odobrenja (§5.2) | bez migracije |
| **M-0** | Šifarnik `machining_part_types` + admin CRUD + seed | **migracija — eksplicitno odobrenje** |
| **M-1** | Tabele `machining_claims` + faults + API modul + dozvole | **migracija — eksplicitno odobrenje** |
| **M-2** | Interna: lista (filter), forma, detalj + veza deo↔motor | najveća faza |
| **M-3** | Portal (whitelist + ožičavanje) + statistika/Excel | portal se „pali" |

Redosled: F-A → F-B odmah po odobrenju; M-faze kad Nikola kaže „kreni sa mašinskom".

**Otvoreno posle F-A (2026-07-22):** portal je i dalje **samo EMOTIVE**. Domaća reklamacija
nema vlasnika — samo tekstualno `customer_name` — pa `DomaceClaimsRepository.list` vraća
prazno svakom `own_customer` akteru. Zato privatno lice ili domaća firma danas **ne mogu da
koriste portal**, bez obzira što šifarnik već poznaje vrstu `domestic_individual` i što bi
zaglavlje firme radilo za njih bez izmene. Da to prorada treba prava veza (`customer_id` na
`domace_claims` + povezivanje postojećih redova + proširenje portala) — Nikola je 2026-07-22
odlučio da se radi drugom prilikom.
