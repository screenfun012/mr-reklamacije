# Prijem vozila — štampani radni nalog (V-7, dizajn)

**Datum:** 2026-08-10 · **Grana:** `feat/vehicle-intake` · **Osnova:** `96ee60b`
**Status:** **odobren u pravcu** — dve odluke donete 10.08. (§1), ostaje pregled pre plana

**Izvor:** Nikolin dokument `2026-08-10-stampa-radni-nalog.md` (iCloud). Ovaj fajl je njegova kopija
u repou plus ono što je provera koda promenila. Gde se razlikuju, **važi ovaj**.
**Vizuelna referenca:** `prijem-prototip-v2.dc.html` → detalj → `⎙ ŠTAMPAJ` (pregled štampe).
**Referenca kuće:** `Obaveze kupca - servisera.pdf` (iCloud, „DIZAJN ZA MR ENGINES/Obaveze kupca").

---

## 0. Šta je ovo i zašto je bilo blokirano

Poslednja nesagrađena stvar u modulu. Dugme `⎙ ŠTAMPAJ` stoji na detalju od V-6-1, **onemogućeno**,
sa natpisom „Štampa naloga se pravi u sledećoj fazi." (`intake_detail_print_unavailable`).

Blokada nije bila tehnička nego premisa: 27.07. je odbijena rečenica iz papirnog uputstva da se
dokument pravi kad se auto završi. Nikolin dokument od 10.08. to zatvara — **prijem se štampa
odmah po potpisu, jedna A4, i taj papir ide vlasniku.**

**Nema migracije, nema nove dozvole, nema posla na serveru.** Provereno na `IntakeOrderDetail`:
ček-lista, gorivo, oštećenja sa zonama, fotografije sa `damageId`, usluge, materijal, primedbe
vlasnika, oba potpisa, tip vozila, `amendedAt`/`amendedByName` — sve je već na žici koju detalj
ionako učitava. V-7 je čist posao na ekranu.

---

## 1. Odluke (Nikola, 10.08.)

| # | Pitanje | Odluka |
|---|---------|--------|
| ⑨ | Izgled: tanke linije (varijanta 2b) ili kao ostali obrasci firme? | **Uskladiti sa „Obavezama kupca":** crna traka u zaglavlju sa logotipom i belim naslovom, **crvene pune trake** kao naslovi sekcija. Ovo menja izabranu varijantu 2b i §5 izvornog dokumenta je i tražio baš to („kad mušterija dobije dva naša dokumenta, moraju izgledati kao iz iste kuće"). |
| ⑩ | Šta piše u okviru „oznaka izmene"? | **Neutralno: „⚠ NALOG JE MENJAN POSLE POTPISA".** Ne „zatečeno stanje ispravljeno" — `amended_at` nema vrstu, pa bi ispravka telefona odštampala neistinu. Vrstu i dalje zna samo Istorija u aplikaciji (odluka ⑥ od 10.08., već upisana u `docs/25` §3.5). |

---

## 2. Osnovna pravila (nepromenjena iz izvornog dokumenta)

| Parametar | Vrednost |
|---|---|
| Format | **A4 portrait**, `794×1123 px` @96dpi |
| Broj strana | **Tačno jedna. Nikada dve.** |
| Margine | `50px` gore/dole, `54px` levo/desno |
| Boje | **samo crna + brend crvena `#ed1c24`** + siva za sporedni tekst |
| Fontovi | Figtree (tekst) + JetBrains Mono (kodovi, brojevi, labele) |
| `@page` | `size: A4 portrait; margin: 0` |
| Obavezno | `print-color-adjust: exact` — inače štampač izbaci crvene trake i markere |

Radi i kao **PDF export** (isti izlaz, kroz isti dijalog štampe).

⚠️ **Jedna strana je pravilo.** Pune trake (odluka ⑨) troše više vertikalnog prostora nego tanke
linije, pa je pravila skraćivanja iz §5 sada **obavezno** primeniti, ne opciono.

---

## 3. Struktura — sedam blokova

Stranica je `flex` kolona, `gap: 16px`. Podnožje sa potpisima na `margin-top: auto`.

### Blok 1 — Zaglavlje (crna traka, po odluci ⑨)
Traka preko cele širine strane (od ivice do ivice, bez bočnih margina), pozadina `#17171a`,
padding `18px 54px`:
- **Levo:** `logo-white.png` (već u repou, `apps/internal-web/public/internal/logo-white.png`,
  534×144, beo natpis na providnom) visine ~30px.
- **Sredina:** beli naslov `22px w900 uppercase letter-spacing −.02em` **„RADNI NALOG"**, ispod
  sivo-beli `10.5px` **„Prijem vozila u servis"**.
- **Desno:** broj naloga mono `20px w700` belo, ispod datum i vreme prijema mono `9.5px` sivo.

⚠️ Okrugli amblem („MADE IN SERBIA") koji „Obaveze kupca" nose pored natpisa **nije u repou** —
za sada se ne koristi. Ako Nikola da fajl, ide levo od natpisa.

### Blok 2 — Vlasnik i vozilo (dve kolone, `gap: 34px`)
Bez trake — ovo je prvi sadržaj ispod zaglavlja.
- Crveni mono nadnaslov `8.5px w700 tracking .2em`: **VLASNIK** · **VOZILO · {TIP}**.
- Ime vlasnika / marka vozila `15px w800`; registracija u istom redu, **mono**.
- Ispod sivo `11.5px`: adresa + telefon (mono) · VIN (mono) + kilometraža (mono) + način dolaska.
- Razdelnik `1px #e6e7e9`.

### Blok 3 — Zatečeno stanje (crvena traka)
Traka preko širine sadržaja, pozadina `#ed1c24`, beli tekst `10px w800 uppercase tracking .16em`,
padding `5px 11px`, radius 0: **ZATEČENO STANJE**.
- **8 stavki ček-liste u 4 kolone** (`gap: 6px 20px`, `11.5px`): mono `✓` crno za DA, mono `✕`
  **crveno** za NE, a **stavka koju niko nije dodirnuo nosi `—` sivo** — ⚠️ treće stanje se štampa,
  jer prijem koji ga guta štampa tvrdnju koju niko nije dao (`docs/25` §4.4).
- Ispod, iza linije `1px`, red od četiri podatka (`gap: 32px`): **GORIVO** `5/8` mono 19px ·
  **NEDOSTACI** mono 19px **crveno** · **FOTOGRAFIJA** mono 19px · **PRIMEDBE VLASNIKA** (flex:1,
  `11.5px`).
- Male labele: mono `8.5px tracking .16em` sivo.

### Blok 4 — Šema i nedostaci (crvena traka + grid `186px 1fr`, `gap: 28px`)
Traka: **ŠEMA I NEDOSTACI**.
- **Levo:** silueta `146×238px`, `viewBox="0 0 340 556"`, **crna linija na belom**
  (`stroke-width 2.4`, `fill-opacity .05`).
  - ⚠️ **Silueta po `order.vehicleType`** — ne uvek auto. Deli isti izvor kao ekran:
    `INTAKE_SILHOUETTES` iz `wizard/intake-silhouettes.ts`. Druga kopija crteža bi se razišla.
  - Markeri: krug `r=17` **pun crveni `#ed1c24`**, beli broj mono 15px. **Svi markeri crveni bez
    obzira na tip** — amber i siva se ne štampaju čitko.
- **Desno:** redovi `broj (mono w700) · tip · zona (sivo, desno)`, donja linija `1px`, font `12px`.
  - Bez oštećenja: italic sivo **„Nema uočenih nedostataka pri prijemu."**
- Pod tim dve kolone (`gap: 22px`): **USLUGE** i **MATERIJAL** — liste `12px`, `line-height 1.8`,
  bez numeracije, bez cena.

### Blok 5 — Fotodokumentacija (crvena traka)
Traka: **FOTODOKUMENTACIJA · {N}**.
- **6 sličica u redu** (grid 6 kolona, `gap: 8px`, `aspect-ratio 4/3`, ivica `1px #c9cacd`).
- Fotografija vezana za oštećenje nosi **crveni krug `15px` sa belim brojem** — isti broj kao na
  šemi i u listi.
- Više od 6: ispod `9.5px` sivo — „Prikazano prvih 6 od {N} fotografija — sve se čuvaju uz
  digitalni nalog."

⚠️ **Slike moraju biti učitane PRE `window.print()`**, inače se štampaju prazni okviri. Pregled
štampe se otvara prvi i dugme „Štampaj" se otključava tek kad se sve sličice učitaju (ili padnu).

### Blok 6 — Oznaka izmene *(samo ako je nalog menjan posle potpisa)*
Okvir `1.5px solid #ed1c24`, pozadina `rgba(237,28,36,.06)`, padding `7px 11px`:
- Levo mono `8.5px w700 tracking .14em` crveno: **„⚠ NALOG JE MENJAN POSLE POTPISA"** (odluka ⑩).
- Desno mono `9px` crno: datum/vreme + ime osobe (`amendedAt`, `amendedByName`; bez imena ide
  `intake_detail_amended_by_unknown`).
- **Nemenjan nalog ovaj blok NE prikazuje i ne rezerviše mu prostor.**

### Blok 7 — Podnožje sa potpisima (`margin-top: auto`)
- Gore: **crvena linija `2.5px`**.
- Pravna rečenica `9.5px` sivo, `max-width 600px`, `line-height 1.5`:
  > „Potpisom se potvrđuje da je zatečeno stanje vozila, opreme i uočenih nedostataka verno
  > prikazano u ovom nalogu, uključujući priloženu fotodokumentaciju ({N} fotografija, arhivirano
  > uz nalog {broj})."
- Dve kolone (`gap: 40px`), svaka: potpis (v. §4), pod njim **crna linija `1px`**, pod linijom red:
  levo mono `8.5px w700 tracking .16em` sivo **SERVISER** / **VLASNIK**, desno ime `11px w700`.

---

## 4. Potpisi

Potpis je putanja u fiksnom prostoru koji ekran već koristi (`SIGNATURE_VIEW_BOX` iz
`wizard/intake-signature-pad.ts` — **uzeti odatle, ne prepisivati brojeve**):

```html
<svg viewBox={SIGNATURE_VIEW_BOX} width="100%" height="50" preserveAspectRatio="xMidYMax meet">
  <path d="{putanja}" stroke="#17171a" stroke-width="4" fill="none" stroke-linecap="round"/>
</svg>
```

**Ne rasterizovati u PNG** — putanja se štampa oštrije i ne zavisi od rezolucije tableta.

---

## 5. Kad sadržaja ima previše — redosled skraćivanja

1. **Usluge i materijal** → prvih **5** po koloni.
2. **Fotografije** → prvih **6** + napomena o ukupnom broju.
3. **Nedostaci** → više od 12 → prvih 12 + red „…i još {N} — vidi digitalni nalog {broj}".
4. **Primedbe vlasnika** → ~180 znakova + „…".

**Nikad se ne skraćuje:** zaglavlje, vlasnik i vozilo, ček-lista (svih 8), šema, oznaka izmene,
pravna rečenica, potpisi.

---

## 6. Gde živi

⚠️ Izvorni dokument imenuje `features/intake/intake-print.tsx`; **taj folder ne postoji** — modul je
`features/intake-orders/`. Ide u `features/intake-orders/print/`:

- `intake-print-sheet.tsx` — sama strana, čita `IntakeOrderDetail`, nema stanja.
- `intake-print-dialog.tsx` — pregled u pravoj veličini + `Zatvori` / `⎙ Štampaj`, otključava se
  kad se slike učitaju.
- `intake-print.css` (ili `@media print` blok) — `@page`, sakrivanje aplikacije pri štampi.
- Zaglavlje detalja: dugme se **otključava** i gubi `intake_detail_print_unavailable`.

Renderuje se **iz podataka naloga**, ne iz ekranskih komponenti — štampa ima svoju tipografsku
skalu i belu podlogu. Silueta i prostor potpisa dele izvor sa ekranom.

---

## 7. Čime se dokazuje

- Staje na **jednu** A4 stranu sa najpunijim nalogom: 9 fotki, 12 nedostataka, po 6 usluga i
  materijala, duga primedba vlasnika.
- Silueta odgovara tipu vozila; brojevi markera = brojevi u listi = brojčići na fotografijama.
- Nalog bez oštećenja: „Nema uočenih nedostataka pri prijemu.", raspored se ne lomi.
- Nemenjan nalog: **nema** oznake. Menjan: oznaka sa neutralnim tekstom, datumom i imenom.
- Ček-lista koju niko nije dodirnuo štampa `—`, ne `✕`.
- Crvene trake i markeri se **odštampaju** (`print-color-adjust`), ne izbeli ih štampač.
- Potpisi oštri kao vektor, poravnati sa linijom.
- PDF export daje isti izlaz.

---

## 8. Šta ovo ne dira

Server · režim izmene (V-6-2) · listu · servisera (on štampa isto što i kancelarija — papir ide
vlasniku odmah po potpisu) · portal · statistiku.

**Ne dodaje se ništa što nije ovde** — logotipi preko onog jednog, QR kodovi, uslovi poslovanja,
polja za cene — bez pitanja.
