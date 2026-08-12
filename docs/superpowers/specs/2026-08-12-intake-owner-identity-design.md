# Prijem — ko je vlasnik i gde mu ide dokument (deo 1, dizajn)

**Datum:** 2026-08-12 · **Grana:** `feat/vehicle-intake` · **Osnova:** `cff55fd`
**Status:** odobreno u razgovoru (Nikola, 12.08.), migracija odobrena

---

## 0. Odakle ovo dolazi

Nikola, 12.08., pošto je deo C pushovan:

> „Polje u osnovne podatke ide celom dužinom bez razloga to je jedno. Drugo, treba nam da vlasnik
> unese broj lične karte, to nam fali. Posle toga nam ostaje samo kada se generiše dokument da se
> pošalje na mail, ali unos mail moramo da stavimo u osnovne podatke isto. Ako klijent nema mail
> onda ništa, ne šalje se nego samo dobije fizičku kopiju."

Prijem je dokaz o predaji tuđe imovine, a danas na papiru ne stoji **nijedan identifikacioni broj
vlasnika** — samo ime, adresa i telefon. Slanje dokumenta na mejl je zasebna faza (§6), jer traži
dve stvari koje u sistemu ne postoje.

⚠️ Nadređeno pravilo ostaje `docs/25` §3.0 („ekran vodi, radnik se vozi"): svaka odluka ispod bira
ono što traži **manje odluka od radnika**, ne ono što je fleksibilnije.

---

## 1. Odluke

| # | Pitanje | Odluka |
|---|---------|--------|
| ① | Kad ide mejl sa dokumentom? | **Odmah po potpisu, u pozadini.** Ako mreže nema ili slanje padne, **prijem se svejedno završava** — radnik ne sme da stoji pred mušterijom zbog mejla (`docs/25` §3.6). Neposlato se vidi na nalogu i kancelarija šalje ponovo. |
| ② | Je li broj lične karte obavezan? | **Obavezan samo za fizička lica.** Odbijeno „obavezan uvek": firma nema ličnu kartu, pa bi to zaustavilo prijem zbog podatka koji ne postoji. |
| ③ | Šta se traži od firme? | **PIB, neobavezan.** Isto polje, drugi naziv. Odbijeno „ništa": tada papir za firmu ne nosi nijedan identifikacioni broj, a to je pola razloga zbog kog se ovo i radi. |
| ④ | Jedna kolona za broj ili dve? | **Jedna** (`owner_id_number`), uz `owner_type` koji joj daje značenje. Dve nullable kolone od kojih je uvek tačno jedna popunjena su dva stanja koja mogu da se raziđu; jedna ne može. |
| ⑤ | Šta kad radnik promeni tip vlasnika? | **Broj se briše.** Bez toga bi lična karta upisana pre promene tiho postala PIB na dokumentu koji je dokaz. Ovo je jedina brava koju jedna kolona traži, i jeftinija je od druge kolone. |
| ⑥ | Ide li mejl na papir? | **Ne.** To je naša adresa za slanje, a ne podatak o vozilu ni o predaji. Papir nosi ime, adresu, telefon i identifikacioni broj. |
| ⑦ | Je li mejl obavezan? | **Ne.** Prazan mejl znači da se ništa ne šalje i vlasnik dobija samo fizičku kopiju — Nikolina rečenica, doslovno. |

---

## 2. Model podataka

Tri kolone na `intake_orders`, migracija **`0042`** (generisana `drizzle-kit`-om, lanac od nule
dokazan pre primene):

| Kolona | Oblik | Nosi |
|---|---|---|
| `owner_type` | `text NOT NULL DEFAULT 'fizicko_lice'` + CHECK | `fizicko_lice` \| `firma` |
| `owner_id_number` | `text` (nullable) | lična karta ili PIB — značenje daje `owner_type` |
| `owner_email` | `text` (nullable) | gde ide dokument; prazno = ne šalje se |

**Postojeći nalozi:** dobijaju `fizicko_lice` i dva prazna polja. To je pretpostavka, ne podatak —
ali je bezopasna: broj je prazan, pa tip ne opisuje ništa, a papir starih naloga ostaje kakav je bio.

`owner_type` je `text` + CHECK, ne PG enum — kućno pravilo (`CLAUDE.md` §6, „enum-like kolone su
text + CHECK, proširive").

**Obaveznost lične karte je pravilo EKRANA, ne šeme.** Kolona je nullable jer firma legitimno nema
broj, a stari nalozi ga nemaju uopšte. Korak 1 je taj koji ne pušta dalje — isto mesto gde već stoje
registracija, vozilo, vlasnik i telefon.

---

## 3. Ekran — korak 1

`wizard/step-vehicle-owner.tsx`, kartica **VLASNIK**, ispod imena:

- **Vlasnik je**: `IntakeChoiceButtons`, dve opcije — isti obrazac kao „Način dolaska" i „Tip
  vozila", pa radnik ne uči ništa novo.
- **Broj lične karte** / **PIB**: jedno polje; naziv, obaveznost i primer se menjaju po tipu.
- **Mejl**: obično polje, `type="email"`, nikad obavezno.

`step1Complete` dobija još jedan uslov: **fizičko lice mora imati broj**. Firma ne mora ništa novo.
Podnožje već ume da kaže šta fali (`intake_hint_required`) — ta rečenica dobija broj lične karte.

**Promena tipa briše broj** (odluka ⑤), tihо i bez pitanja: polje se isprazni pred radnikom koji je
upravo promenio tip, pa nema šta da se objašnjava.

### 3.1 Popravka koju je Nikola primetio

Ćelija **TELEFON** na detalju ide preko celog reda namerno — uži red je ranije sekao cifre dopisanog
broja (`tab-overview.tsx`, komentar iz V-6-2). Ali samo **polje** nema ograničenje širine, pa se
rasteže preko cele kartice i izgleda kao greška. Polje dobija razumnu najveću širinu; ćelija ostaje
preko reda, jer razlog zbog kog je tako i dalje važi.

---

## 4. Papir

Identifikacioni broj ide **ispod imena vlasnika**, iznad adrese, sa naslovom po tipu:
`LIČNA KARTA` / `PIB` (`ID CARD` / `TAX ID`). Prazan broj se **ne štampa uopšte** — prazan naslov na
dokumentu koji se potpisuje je gore od izostavljenog reda.

Mejl se ne štampa (odluka ⑥).

⚠️ Papir je već pun i meren (`PRINT_MAX_OTHER_DAMAGES`, deo C). Jedan red u zaglavlju je mali dodatak,
ali se **meri isto kao i sve pre njega** — najgori nalog, u režimu štampe, oba potpisa na prvoj strani.

---

## 5. Server

- `owner_type`, `owner_id_number`, `owner_email` ulaze u ulaznu i izlaznu šemu.
- **Nijedna nova straža.** Posle dela H sve što nije na `FREE_AFTER_SIGNING` je posle potpisa
  odbijeno po imenu polja, pa su i ove tri kolone zamrznute time što ih nema na tom spisku.
- **Server NE tera obaveznost lične karte.** To je pravilo koraka 1, i namerno ostaje tamo: kolona je
  nullable zbog firmi i starih naloga, pa bi serverska provera morala da zna tip — a tip radnik može
  da promeni. Ako se ikad pokaže da je potrebno, dodaje se tada, sa istim obrascem kao provera
  zatečenog stanja (`isIntakeConditionRecorded`).

---

## 6. Šta NIJE u ovom delu

**Slanje dokumenta na mejl (deo 2).** Odobreno kao pravac, nije početo. Tri komada, od kojih dva ne
postoje:

1. **Server nema PDF prijemnog lista.** Papir danas postoji samo u pregledaču (`window.print()`).
   Postoji sličan mehanizam za izveštaje o reklamacijama (`claim-report-export-pdf.ts`, deljeni
   Chromium) — odatle se uzima obrazac, ne piše se iznova.
2. **`EmailPort` ume samo tekst** (`{to, subject, html}`) — prilog traži proširenje porta i adaptera.
3. Kolona koja pamti da li je i kad poslato, plus dugme za ponovno slanje.

Zato deo 1 ide sam i pushuje se sam: polja su korisna bez slanja, a slanje nosi rizik koji ne treba
mešati sa njima.

**Prijavljeno, ostaje nedirnuto:** naslovi USLUGE i MATERIJAL se na papiru štampaju i kad nemaju
nijedan red ispod sebe (viđeno na `DEMO-C/26`) — zatečeno, nije od ovog posla.

---

## 7. Šta se mora dokazati

Merenjem u pregledaču:
- najgori nalog i dalje staje na jednu stranu sa novim redom u zaglavlju
- polje dopisanog telefona više ne ide preko cele kartice

Testovima (svaki mora da padne kad se pokvari linija koju pokriva — mutacija, ne argument):
- fizičko lice bez broja **ne može dalje** sa koraka 1; sa brojem može
- firma bez broja **može dalje**
- promena tipa **briše** upisani broj
- prazan broj se **ne štampa**, ni sa naslovom
- naslov na papiru prati tip (lična karta ↔ PIB)
- patch bilo koje od tri kolone na **potpisan** nalog → odbijen
