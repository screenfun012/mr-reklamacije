# Okvir rasporeda za internu aplikaciju — i prevod Servisa na njega

Status: **odobrio Nikola, 30.07.2026.** Grana `feat/vehicle-intake`.
Prethodi V-6-1b, koji je zaustavljen dok ovo ne slegne.

---

## 1. Zašto

Nikola, 30.07., gledajući `/prijem` i `/prijem/novi`:
*„na desktopu sve preveliko izgleda… stvari se ne poklapaju kako treba… nemoj da mi kod
izgleda kao špagete koje se preplićuI i koje nemaju krajnji smisao"*.

Pregled je našao **jedan koren, ne dvadeset problema**.

Ljuska svakom ekranu daje tačno ovo:

```tsx
<main className="relative px-4 pb-[72px] pt-9 sm:px-8">{children}</main>
```

Razmak i ništa više: **nema širine sadržaja**. Pošto okvir ne postoji, svaki ekran ga
izmišlja sam, i izmišljaju različito:

| Ekran | Šta radi danas | Posledica |
| --- | --- | --- |
| `routes/_shell/prijem/index.tsx` | `max-w-[1320px]`, **prepisano tri puta** u istom fajlu (`:77`, `:209`, `:218`) | na 1366px praktično nema granice; tri mesta koja mogu da se raziđu |
| `wizard/intake-wizard.tsx:340` | `-mx-4 -mb-[72px] -mt-9 sm:-mx-8` + `h-[calc(100vh-59px)]` | **poništava razmak ljuske negativnim marginama**, nema nikakvu gornju granicu, i zakucava visinu zaglavlja brojem 59 prepisanim iz drugog fajla |
| `intake-orders-table.tsx:39-40` | `overflow-x-auto` + `min-w-[1080px]`, **nula breakpoint-a** | na telefonu (430) i na tabletu uspravno (820) tabela je 1080px u vodoravnom skrolu |

**Ono što je Nikola video kao „preveliko" nije veličina slova nego odsustvo gornje granice:**
sve se razvlači koliko monitor da.

### Šta NIJE pokvareno (provereno, da se ne popravlja ono što radi)

Prvi nalaz ovog pregleda je bio „lista nema nijedno responzivno pravilo". **To je bilo
netačno i ispravljeno je pre nego što je išta napisano.** Brojanje po fajlu je promašilo da
ruta nema pravila ali njena deca imaju:

- `intake-filter-bar.tsx` — `flex-col lg:flex-row`
- `intake-kpi-cards.tsx` — `grid-cols-2 lg:grid-cols-4`
- svih pet koraka čarobnjaka — `lg:flex-row` / `lg:items-stretch`

Dakle **modul već ima jedno pravilo, na `lg` = 1024px, primenjeno na sedam mesta.**
Nedostaje samo na dva: na tabeli i na gornjoj granici.

Logo je takođe provereno **ispravan**: `/internal/logo-white.png` je 534×144 (odnos 3.708),
kutija je 113×30 (odnos 3.767) — razlika 1.6%, maska je `contain`, ništa se ne gnječi.
Skript „Engines" po dizajnu preseca blok slova „MR"; na 30px visine to se slepi u mrlju.
To je čitljivost na maloj visini, **nije bag i ne dira se u ovoj fazi.**

## 2. Odluke koje je Nikola doneo

1. **Doseg: ljuska + Servis.** Reklamacije, Statistika, Početna, Pristiglo i Mašinska obrada
   se **ne diraju**. Okvir se dodaje kao *nova mogućnost*, ne kao zamena `<main>`-a, pa
   današnji ekrani ne mogu da puknu time što je uveden.
2. **Lista na telefonu postaje kartica po nalogu.** Ne skraćena tabela, ne vodoravni skrol,
   ne poruka „otvori na računaru".
3. **V-6-1b čeka** dok ovo ne bude gotovo. *„ne želim da se vraćam sto puta na ovo"*.

### Odluka koju sam ja doneo i povukao u istom razgovoru

Prvo sam predložio **tri** širine (768 / 1280). **Povučeno pre pisanja koda**: modul već
koristi `lg` = 1024 na sedam mesta, pa bi uvođenje 768 i 1280 pored toga napravilo **treći**
sistem preko dva postojeća — tačno ono na šta se Nikola žalio. Ostaje **jedna granica.**

## 3. Dogovor o rasporedu

### 3.1 Jedna granica: `lg` = 1024px

| | ispod 1024 | iznad 1024 |
| --- | --- | --- |
| uređaji | telefon 430, tablet uspravno 820 | tablet položeno 1180, desktop 1366+ |
| čarobnjak | jedna kolona | dve kolone |
| lista | kartica po nalogu | tabela |
| KPI | 2 u redu | 4 u redu |

Telefon i tablet uspravno **namerno dobijaju isti raspored** — tabela od 1080px ne staje ni
u jedan od njih, pa razlikovanje ta dva ne bi kupilo ništa osim trećeg slučaja za održavanje.

Stock Tailwind `lg`. **Nema custom breakpoint-a.**

### 3.2 Gornja granica sadržaja — nova komponenta `InternalPage`

`components/layout/internal-page.tsx`:

```tsx
export type InternalPageWidth = 'wide' | 'narrow'

/**
 * Okvir sadržaja. Ljuska daje razmak, ovo daje širinu — pre ovoga je svaki ekran
 * pisao svoj `max-w`, pa su se razišli (lista 1320 na tri mesta, čarobnjak nijedan).
 * `narrow` je serviserov čarobnjak: formular koji se popunjava na tabletu i na
 * desktopu se samo centrira, bez drugog rasporeda (docs/25, drugi grilling prolaz).
 */
export function InternalPage({ width = 'wide', className, children }: InternalPageProps)
```

- `wide` → `max-w-[1280px]` — liste, tabele, KPI
- `narrow` → `max-w-[980px]` — čarobnjak i formulari

Oba `mx-auto w-full`. Ekran bira jedno od dva i **više ne piše nijedan svoj `max-w`**.

Ovo su gornje granice, **ne breakpoint-i.** Jedina granica je i dalje `lg`.

### 3.3 Šta se briše, ne premešta

- `-mx-4 -mb-[72px] -mt-9 sm:-mx-8` iz `intake-wizard.tsx:340` — **briše se.** Negativne
  margine se ne sele u ljusku; prestaju da postoje.
- `h-[calc(100vh-59px)]` + `overflow-hidden` + unutrašnji `overflow-y-auto` — **briše se.**
  Broj 59 je visina zaglavlja prepisana rukom u drugi fajl i puca čim se zaglavlje promeni.
  Stranica skroluje normalno.
- `max-w-[1320px]` × 3 iz `routes/_shell/prijem/index.tsx` — **briše se**, dolazi iz okvira.

**Traka sa `ODUSTANI / NAZAD / DALJE` ostaje prikovana za dno** — to je zahtev serviserovog
tableta, ne ukras — ali kao `sticky bottom-0` unutar kolone, a ne tako što ekran otme celu
visinu prozora.

⚠️ **Ovo je bilo u sukobu sa izmerenom tvrdnjom u kodu, pa je premereno.**
`intake-wizard-footer.tsx:19-21` tvrdi: *„NOT `sticky` either — measured, it does not pin
inside this shell, whose main column is `overflow-x: clip`."*

Premereno 30.07. u živoj stranici (sinhrono, bez `requestAnimationFrame` — tab je bio
`hidden` pa bi kadar zamrzao merenje): sonda `position: sticky; bottom: 0` u `<main>`-u se
razrešava kao `sticky`, donja ivica joj pada na 1024 pri visini prozora 1024, dakle
**prikovana**. Jedini predak sa `overflow`-om je `overflow-x: clip / overflow-y: visible`, a
to je **jedina kombinacija koju CSS spec namerno čuva** (za razliku od `hidden`, koje bi
drugu osu oborilo na `auto`) — ne obara `sticky`.

Zaključak: stara tvrdnja je bila **tačna po posledici, pogrešna po uzroku.** `sticky` nije
obarala ljuska nego **`overflow-hidden` na korenu čarobnjaka** (`intake-wizard.tsx:340`) —
predak sa `overflow: hidden` obara `sticky` uvek. Pošto ova izmena baš taj `overflow-hidden`
briše, `sticky` postaje ispravan. **Komentar u traci se ispravlja u istoj izmeni**, da ne
zavede sledećeg.

### 3.4 Tabela dobija karticu ispod 1024

**Jedan `<li>`, jedan `<Link>`, jedna lista, dva rasporeda istih vrednosti.** Vrednosti se
izvuku jednom iznad povratka; unutar linka stoje dva omotača:

- `hidden lg:grid` — današnji red od sedam kolona, netaknut
- `lg:hidden` — kartica

Prebacivanje je **CSS-om, ne JavaScript-om**: kuka za širinu bi se razišla između servera i
brauzera pri hidraciji.

Kartica po nalogu, tri reda:

1. broj naloga (mono, podebljano) **·** status (pilula), razmaknuti na krajeve
2. registracija (mono) **·** vozilo · vlasnik
3. serviser **·** datum prijema, sitno, `--mri-text2`; oznaka za fotke i za „menjano posle
   potpisa" gde postoje

`overflow-x-auto` i `min-w-[1080px]` važe **samo od `lg` naviše.** Zaglavlje kolona se ispod
`lg` ne prikazuje — kartica nosi svoje oznake u samom rasporedu.

### 3.5 Tri teksta koja su takođe pogrešna

Nađena pri istom pregledu, ista faza jer su na istim ekranima:

1. **„Prikazano 1–3 od 3 reklamacija"** na ekranu Servisa — preuzeta rečenica sa reklamacija.
   Nalozi nisu reklamacije. Novi ključ, formulisan tako da broj ne kvari gramatiku
   (CLAUDE.md: bez ICU plurala u ovom repou).
2. **„ЧЕТВРТАК"** ćirilicom dok je sav ostali tekst latinicom — `Intl.DateTimeFormat('sr')`
   vraća ćirilicu. Traži se latinica izričito (`sr-Latn`), na jednom mestu.
3. **`Prikaz: Aktivni` je goli sistemski `<select>`**, van dizajna. **Ovo NE ide u ovu fazu** —
   dolazi iz nedovršenog Zadatka 5 koji stoji nekomitovan u radnom stablu; popravlja se tamo,
   pri njegovom dovršavanju, da se dve izmene ne prepletu preko istog fajla.

## 4. Šta se menja

**Novo:** `apps/internal-web/src/components/layout/internal-page.tsx`

| Fajl | Zašto |
| --- | --- |
| `routes/_shell/prijem/index.tsx` | tri `max-w-[1320px]` → `<InternalPage>`; ispravka „reklamacija"; latinični dan |
| `features/intake-orders/wizard/intake-wizard.tsx` | negativne margine i `100vh` matematika se brišu; `<InternalPage width="narrow">`; donji razmak za lepljivu traku |
| `features/intake-orders/wizard/intake-wizard-footer.tsx` | `sticky bottom-0` umesto oslanjanja na roditeljev `overflow-hidden` |
| `features/intake-orders/intake-orders-table.tsx` | kartica ispod `lg`; `overflow-x-auto` i `min-w` samo od `lg` |
| `packages/i18n/src/messages/{sr,en}.json` | ključ za brojač liste |

**Ne dira se:** pet koraka čarobnjaka (već rade `lg:flex-row` kako treba), `intake-panel`,
`intake-stepper-strip`, KPI kartice, filter traka, `<main>` u ljusci, i nijedan ekran van
Servisa.

## 5. Provera

1. Pun gate zelen.
2. Komponentni testovi: kartica se prikazuje ispod `lg` a red iznad (kroz klase, jer jsdom
   ne računa raspored) · brojač liste ne kaže „reklamacija" · dan je latinicom.
3. **Merenje u brauzeru na tri širine — 430, 820, 1180, plus desktop 1366.** Ovo je
   **jedini deo koji ne mogu sam**: `resize_window` u ovom okruženju javlja uspeh a prozor
   ostane 1366×1024 (provereno dva puta, `window.innerWidth` se ne pomeri), a prijava kroz
   Playwright bi tražila da negde ukucam lozinku, što ne radim. Nikola bira širinu iz
   DevTools `Dimensions`, ja merim `scrollWidth` prema `clientWidth` i svaku ćeliju prema
   desnoj ivici njene kolone.

⚠️ **Pregled je urađen na dva ekrana i samo na 1366px.** Koraci 2–5 čarobnjaka nisu viđeni
ni na jednoj širini. Dijagnoza gore je iz koda, gde je raspored jednoznačan — ali merenje
može da nađe još stvari, i to se očekuje, ne izuzima.
