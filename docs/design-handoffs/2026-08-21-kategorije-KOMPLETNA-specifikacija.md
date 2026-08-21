# Reklamacije po kategorijama — KOMPLETNA specifikacija do detalja

**Za:** Claude Code · **App:** `internal-web` · **Datum:** 21.08.2026
**Ovo je ISCRPNA verzija** — piše svaki font, boju, veličinu i razmak. Prethodni handoff-i (`2026-08-21-kategorije-design-handoff.md` + dopune za polja kategorije i promenu kategorije) i dalje važe za funkciju/API; ovaj dokument je merilo IZGLEDA. Vizuelni izvor: `kategorije-prototip.dc.html` (1440×900) — ako ovde nešto nije opisano, čitaj iz njega.

> Prevod u kod: vrednosti dole su iz prototipa. Tamo gde interna app već ima `--mri-*` token sa istom vrednošću — koristi token, ne hardkoduj. Novi tokeni se dodaju u `--mri-*` blok, ne inline.

---

## 0. TEMELJ — tokeni, fontovi, pozadina

### Boje (dark tema)
| Uloga | Vrednost |
| --- | --- |
| Pozadina app | `#0b0b0d` (`--bg`) |
| Kartica / surface | `#131316` (`--surface`) |
| Izdignuto (meniji, sekundarna dugmad) | `#1a1a1f` (`--raised`) |
| Ivica kartica | `rgba(255,255,255,.09)` (`--border`) |
| Ivica inputa/kontrola | `rgba(255,255,255,.16)` (`--border2`) |
| Pozadina inputa | `rgba(255,255,255,.045)` (`--inbg`) |
| Hover reda/stavke | `rgba(255,255,255,.03)` (`--rowhv`) |
| Tekst primaran | `#f2f2f3` · sekundaran `#9c9da3` |
| Brend crvena | `#ed1c24` · hover/link `#ff4d55` |
| EMOTIVE plava | `#2e90fa` · DOMAĆA ljubičasta `#a78bfa` |
| Amber (čeka/upozorenje) | `#eab308` · zelena (potvrda) `#1fa971` |
| Primarno dugme | ispuna `#f2f2f3`, tekst `#141417` |
| Placeholder inputa | `#6b6c72` |
| Toast | bg `#17171b`, ivica `rgba(255,255,255,.14)` |

### Fontovi
- **Figtree** (400–900): sav UI tekst.
- **JetBrains Mono** (400–700): SVE tehničko — MR brojevi, šifre, datumi, brojevi u tabeli, eyebrow labele, labele polja, breadcrumb, značke, brojači.

### Pozadina ekrana
Mreža 56×56px, linije `rgba(255,255,255,.028)` 1px, sa mask fade-om nadole (`linear-gradient(#000, transparent 75%)`), `pointer-events:none`, IZA sadržaja.

### Animacije
- Ulaz ekrana: `fadeUp .45s cubic-bezier(.22,1,.36,1)` (opacity 0→1, translateY 9px→0).
- Toast: `slideUp .35s` isti easing.
- Hover dugmadi: `transform: translateY(-1px)`, tranzicija `.15s`.
- Sve uz `prefers-reduced-motion` isključenje.

### Univerzalni obrasci
- **Kartica:** `--surface` bg + `1px solid --border` + radius **14px**, bez senke. Header: padding `13px 18px`, donja linija `--border`, naslov **14.5px w800**, meta desno mono `10px tracking .13em --text2`.
- **Input:** visina **40px** (u formama 42px), padding `0 12px`, radius **9px**, `--inbg` bg + `1px solid --border2`, tekst `500 13px Figtree`. **Focus:** ivica `--red` + ring `0 0 0 3px rgba(237,28,36,.18)`.
- **Labela polja:** mono `600 9.5px tracking .13em --text2` UPPERCASE, 5px iznad kontrole. Obavezno polje: ` *` crvena (`--redh`).
- **Kind pill:** mono `700 9.5px tracking .08em`, padding `4px 9px`, radius 20px; EMOTIVE `rgba(46,144,250,.13)` bg + `#2e90fa` tekst; DOMAĆA `rgba(167,139,250,.13)` + `#a78bfa`.
- **Ishod pill:** `11px w700`, padding `4px 10px`, radius 20px, tačka 5px + tinta `.13`: Na čekanju amber / Prihvaćeno zelena / Odbijeno `#ff4d55` / Arhivirano siva `#9c9da3`.
- **Primarno dugme:** svetla ispuna `--btn`, tamni tekst, `12px w700 uppercase tracking .06em`, visina 40–42px, padding `0 18-22px`, radius 10px, senka `0 8px 22px rgba(0,0,0,.4)`, hover lift.
- **Outline dugme:** `--raised` bg + `1px solid --border2`, isti tekst.
- **Zeleno dugme (Sačuvaj/Prihvati):** ispuna `#1fa971`, beo tekst.
- **Destruktivno (Odbij):** transparent + `1px solid rgba(237,28,36,.55)` + `--redh` tekst; hover bg `rgba(237,28,36,.1)`. NIKAD puna crvena ispuna.
- **Dashed dugme (+ Dodaj kvar):** visina 44px, `1px dashed --border2`, mono-stil `12px w700 uppercase --text2`; hover: tekst i ivica → `--redh`.
- **Toast:** dole-centar, bottom 24px, bg `#17171b`, radius 11px, padding `13px 20px`, zelen check krug 20px (`rgba(31,169,113,.18)` bg), tekst `14px w600`, senka `0 18px 44px rgba(0,0,0,.5)`, auto-dismiss ~2.8s.

---

## 1. SIDEBAR (pun, 236px)

- `--surface` bg, desna ivica `--border`, padding `16px 10px 12px`.
- **Logo blok:** crveni kvadrat 28px radius 7px sa mono „MR" belo; desno „MR ENGINES" `13px w800` + eyebrow „INTERNA APLIKACIJA" mono `600 7.5px tracking .22em --text2`.
- **Stavke menija:** visina 38px, padding `0 11px`, radius 9px, `13.5px w600 --text2`, mono indeks (`01`–`05`) `500 10px opacity .6`, hover `--rowhv`. Redosled: 01 Početna · 02 Pristiglo · 03 Reklamacije · 04 Prijem vozila („Servis" preimenovan) · 05 Statistika.
- **„Reklamacije" (grupa):** tekst `--text` w700; desno amber badge ukupno nerešenih (mono `600 10px`, `rgba(234,179,8,.13)` bg, padding `2px 7px`, radius 20px) + caret ▾/▸ `9px --text2`. Klik širi/skuplja; stanje se pamti (localStorage); default otvoreno.
- **Pod-stavke:** uvučene `margin-left: 21px`, vodeća linija `border-left: 1px solid --border`; red visina 32px, `12.5px`; prva „Sve reklamacije", pa kategorije **redom iz šifarnika** (ne abecedno). Aktivna: tinta `rgba(237,28,36,.11)` + `inset 2px 0 0 var(--red)` + w700 beo tekst. Broj desno mono `9.5px`: amber pill kad >0, `opacity .45` prigušen kad je 0.
- **Korisnički blok dole** (`margin-top:auto`, gornja linija): crveni avatar 30px sa inicijalima `11px w800`, ime `12.5px w700`, uloga `10.5px --text2`.

## 2. SIDEBAR sužen (60px) + flyout

- Kolona ikonica 38×38px radius 9px, `--text2`, hover `--rowhv`; MR logo gore.
- Ikonica Reklamacija: aktivna tinta `rgba(237,28,36,.11)` + **amber tačka 7px** gore-desno kad ima nerešenih.
- Klik na nju → **flyout**: `left:68px`, širina 200px, `--raised` bg, `1px solid --border2`, radius 12px, padding 7px, senka `0 18px 44px rgba(0,0,0,.55)`; header mono `600 8.5px tracking .18em` „REKLAMACIJE"; iste stavke i brojevi kao pun meni. Esc/klik van zatvara.

## 3. TOPBAR (58px, sticky)

- Bg `rgba(11,11,13,.72)` + `backdrop-filter: blur(14px)`, donja ivica `--border`, padding `0 20px`.
- Hamburger 32px (radius 8, `--border2` ivica) — skuplja/širi sidebar.
- Breadcrumb mono `600 10.5px tracking .16em --text2`: `INTERNO / {SEKCIJA}` — sekcija bela; vrednosti: `REKLAMACIJE`, `REKLAMACIJE / {KATEGORIJA}`, `NOVA REKLAMACIJA`, `REKLAMACIJE / DETALJ`.
- Desno: EN/SR segmented (mono 10px, aktivan `rgba(237,28,36,.13)`) + tema toggle 32px.

## 4. LISTA — dva režima, ista komponenta

### Header stranice
- Eyebrow mono `700 10px tracking .22em --red`: `KATEGORIJA` ili `SVE VRSTE POSLA`.
- H1 `26px w900 tracking -.02em`: ime kategorije ili „Sve reklamacije".
- Podnaslov `13px --text2`: „Nerešeno: N · Ukupno: M" / „Obe vrste, sve kategorije · Nerešeno: 39".
- Desno JEDNO primarno dugme „+ NOVA REKLAMACIJA" (40px).

### Filter kartica
Kartica (padding 14px), flex-wrap, `gap:10px`, `align-items:flex-end`:
- **PRETRAGA** (flex:1, min 220px): input 40px, placeholder „MR broj, partner, motor…".
- **VRSTA**: segmented — jedan okvir `--border2` radius 9px, visina 40px, segmenti `Sve / EMOTIVE / DOMAĆE`; aktivan `rgba(237,28,36,.13)` bg + beo w700 tekst; neaktivni `--text2` w600; mapira na postojeći `kind` search param.
- **ISHOD**, **PROIZVOĐAČ**: selecti u input obrascu (40px, `--inbg`, ▾ 9px) — **svi postojeći filteri iz koda ostaju**, prototip je minimum.
- **Režim „sve":** dodatni select **KATEGORIJA**.
- **Režim kategorije:** umesto selecta — **dashed čip**: `rgba(237,28,36,.09)` bg + `1px dashed rgba(237,28,36,.45)`, mono `600 10.5px`, „KATEGORIJA = {IME}" (ime belo) + ✕ (`--redh`); klik na ✕ → `/reklamacije` (ostali filteri se zadržavaju).

### Tabela
- Kartica sa headerom: naslov „Reklamacije — {kategorija}" / „Sve reklamacije"; desno mono „UKUPNO: N".
- Horizontalni scroll (`min-width:1120px`).
- Kolone (grid): VRSTA 92px · MR BROJ 84px · BR. REKL. 90px · [KATEGORIJA 150px — samo u „sve"] · ISHOD 118px · KLIJENT VIDI 110px · PARTNER/KUPAC minmax(150px,1fr) · MOTOR 118px · ZADUŽENI 110px · PRIJEM 78px · → 26px; `gap: 0 12px`.
- Zaglavlje: mono `600 9px tracking .14em --text2`, padding `9px 18px`, donja linija.
- Red: padding `11px 18px`, donja linija `--border`, hover `--rowhv`, ceo red klik → detalj. MR broj mono `600 12px`; br. rekl. mono `--text2`; kategorija čip (`--inbg` bg + `--border2`, mono `10.5px`, radius 7px; **ugašena kategorija: dashed ivica + ime sa †**); partner `w600`; motor/datum mono `11.5px --text2`; strelica `--redh w700` (u pravoj app: postojeće oko+kanta radnje OSTAJU umesto strelice).
- Paginacija u kartici: mono „STRANA 1 / N"; dugmići 30px radius 8px, aktivna strana `rgba(237,28,36,.13)` + crvena ivica, neaktivne strelice `opacity .45`.

### Prazna stanja
- **Prazna kategorija** (bez ijedne reklamacije, bez filtera): kartica padding `52px 20px`, centrirano — ikonica 44px u `--inbg` kvadratu radius 12, naslov `15px w800` „U ovoj kategoriji još nema reklamacija", italic `12.5px --text2` „Kategorija je aktivna u šifarniku — prva reklamacija je osniva na listi.", ispod primarno dugme „+ Nova reklamacija" (38px).
- **Filteri bez pogotka:** naslov `14.5px w800` „Nijedna reklamacija ne odgovara filterima", italic podtekst, crveni uppercase link „PONIŠTI FILTERE" (hover underline).

## 5. ČAROBNJAK (max-width 820px, centriran)

### Zaglavlje
- „← NAZAD" `12px w700 uppercase --text2` (hover beo) — izlaz uz confirm ako ima unetog.
- Eyebrow `NOVA REKLAMACIJA` (crveni mono) + naslov koraka `22px w900` („Izbor vrste" / „Osnovni podaci" / „Kvarovi" / „Pregled").
- Desno **čip kategorije**: visina 36px, `--inbg` + `--border2`, radius 9px, mono `600 10.5px` — „KATEGORIJA: {IME} ▾" (ime belo). Klik → meni: 196px, `--raised`, radius 12px, padding 6px, senka; stavke 31px radius 8px `12.5px`, aktivna `rgba(237,28,36,.11)` w700. **Promena kategorije menja grupu „Polja kategorije" ODMAH** (confirm ako su stara polja popunjena).

### Stepper
Krug **26px**, mono `700 11px`: aktivan `--red` bg/beo · završen `rgba(31,169,113,.15)` bg + `#1fa971` „✓" · budući `1px solid --border2` + `--text2`. Labele mono `VRSTA · PODACI · KVAROVI · PREGLED` (aktivna bela w700, ostale `--text2`). Spojnice: linija 1px, flex:1, zelena `rgba(31,169,113,.5)` iza završenih, inače `--border2`.

### Korak 1 — VRSTA
- Uvod `13px --text2`: „Kategorija je već izabrana — ostaje samo vrsta…".
- Dve kartice u gridu `1fr 1fr gap 12px`: padding 22px, `--surface` + `--border2`, radius 14px; kind pill gore; naslov `16px w800` („Reklamacija stranog partnera" / „Domaća firma ili privatno lice"); opis `12.5px --text2 lh 1.6` (EMOTIVE: partner iz sistema · portal Primljeno→U obradi→Ishod · nalaz na engleskom; DOMAĆA: kupac kao tekst · bez portala · brojevi računa i iznosi). Hover: `translateY(-2px)` + tint ivica u boji vrste (`rgba(46,144,250,.6)` / `rgba(167,139,250,.6)`). Klik = izbor + odmah korak 2.

### Korak 2 — PODACI (kartica, padding 20px)
- Header: crveni eyebrow `OSNOVNI PODACI` + kind pill.
- Grid `1fr 1fr`, `gap 13px 16px`; inputi 42px. Polja (obavezna po **stvarnoj šemi iz koda**, ne prototipu): MR BROJ* (mono) · BROJ REKLAMACIJE (mono) · PARTNER*/KUPAC* · PROIZVOĐAČ MOTORA* · TIP MOTORA (mono) · BROJ MOTORA (mono) · DATUM PRIJEMA* (mono) · ZADUŽENI RADNIK. **DOMAĆA dodaje:** BROJ RAČUNA · IZNOS ORIGINALNE FAKTURE · IZNOS DELOVA · IZNOS RADA (svi mono).
- **Grupa „POLJA KATEGORIJE"** (dashed okvir `--border2` radius 12 padding 15px): header mono `700 9.5px tracking .18em` „POLJA KATEGORIJE · {KATEGORIJA}"; sadržaj config-driven po kategoriji (2-kol grid; segmented opcije 38px — aktivna crvena tinta `.13` + ivica `.5` w700; inputi 38px); kategorija bez polja → grupa se NE prikazuje. Detalji i ograde u `2026-08-21-polja-kategorije-carobnjak-handoff.md`.

### Korak 3 — KVAROVI
- Kvar-kartica: `1px solid --border2` radius 12 padding 15px; mono header „KVAR 1"; grid 2 kolone: OPIS KVARA* input + KRIVICA PRIPISANA segmented 42px (Radnik / Odeljenje / Spoljna firma — aktivan crvena tinta).
- Ispod: dashed „+ DODAJ KVAR" (44px).

### Korak 4 — PREGLED
- Kartica: header crveni eyebrow `PREGLED PRE SLANJA` + kind pill + mono kategorija.
- Key/value redovi: labela mono `9.5px` širine **190px** + vrednost `13px w600` (kodovi/datumi mono), donja linija `--border`, padding `9px 2px`. Redosled: VRSTA · KATEGORIJA · MR BROJ · PARTNER/KUPAC · MOTOR · [polja kategorije] · KVAROVI.
- Plava info nota: `rgba(46,144,250,.07)` bg + `1px solid rgba(46,144,250,.25)` radius 10: „Reklamacija se otvara sa ishodom **Na čekanju**" + za EMOTIVE „; klijent na portalu vidi „Primljeno"." / za DOMAĆU „; domaća reklamacija se ne prikazuje na portalu.".

### Navigacija koraka
NAZAD outline (42px) levo · DALJE primarno desno (koraci 2-3) · na koraku 4 **„✓ SAČUVAJ" zeleno** (42px). Posle čuvanja: navigacija na listu kategorije + toast „Reklamacija MR NNNN/NN sačuvana — {kategorija}".

## 6. DETALJ REKLAMACIJE

### Naslovni blok
- „← NAZAD NA LISTU" `11.5px w700 uppercase --text2`.
- Red: **MR broj mono `700 25px tracking -.01em`** · kind pill · **čip kategorije** (mono `10.5px`, `--inbg` + `--border2` radius 7px; ugašena: dashed ivica + posebna dashed značka `KATEGORIJA UGAŠENA MM/YY` mono `8.5px`) · ishod pill.
- Podnaslov `12.5px --text2`: „{br} · {partner} · primljeno {datum} · zadužen {radnik}".
- Desno: „✓ PRIHVATI" zeleno (38px) + „ODBIJ" crveni outline (38px) — postojeće mutacije.

### Tabovi
`Pregled · Nalazi · Prilozi · Izveštaj` — `12.5px`, aktivan w700 beo + **crveni underline** `inset 0 -2px 0 var(--red)`; neaktivni w600 `--text2`, hover beo; donja linija `--border` preko cele širine. (Postojeći tabovi/sekcije iz koda OSTAJU — ovo je minimum.)

### Telo — grid `1fr 340px, gap 16px`
**Leva kolona:**
1. **„Osnovni podaci"** kartica — grid **4 kolone**, `gap 15px 14px`; svaka ćelija: labela mono `600 8.5px tracking .14em --text2` + vrednost `13px w600` (MR/br/motor/datum mono). Redosled: MR BROJ · BR. REKLAMACIJE · PARTNER/KUPAC · KATEGORIJA · PROIZVOĐAČ · TIP MOTORA · ZADUŽENI · DATUM PRIJEMA.
2. **„Polja kategorije"** kartica — **dashed ivica** (namerno drugačija), header naslov + mono kategorija; grid 3 kolone. Tri stanja polja: popunjeno (normalno) · „Nije popunjeno" (italic `--text2`) · ukinuto (dashed značka `UKINUTO MM/YY` mono `7.5px` uz labelu, vrednost prigušena `--text2` ali PRIKAZANA). Kategorija bez polja → kartica se ne renderuje. (Za promenu kategorije posle čuvanja + amber „⚠ DOPUNI PODATKE": `2026-08-21-promena-kategorije-handoff.md`.)
3. **„Kvarovi"** kartica — redovi: mono broj `10px --text2` · opis `13px w600` · desno pill krivice mono `9.5px` radius 20 (RADNIK amber tinta / ODELJENJE ljubičasta / SPOLJNA FIRMA po istom obrascu).

**Desna kolona (340px):**
1. **„Klijent vidi"** (samo EMOTIVE) — timeline: tačka 8px (Primljeno zelena / U obradi plava / Ishod prazan krug `opacity .5`) + status `12.5px w600` + datum mono desno; dole outline dugme „OBJAVI ISHOD KLIJENTU" (34px).
2. **„Prilozi"** — grid 3 kolone, sličice `aspect-ratio 4/3` radius 8 `--inbg` + `--border2`; poslednja dashed „+".

## 7. Šta prototip NE pokriva (kod pobeđuje)

Postojeće sekcije detalja (TipTap izveštaj, nalazi, office preview, iznosi domaće), sve radnje tabele, svi filteri i kolone kojih nema u prototipu — ostaju, obučeni po obrascima iz §0. Ništa se ne briše zato što ga nema u prototipu.

## 8. Checklist za prijem (prođi stavku po stavku)

- [ ] Sidebar: grupa Reklamacije + pod-stavke sa brojevima, aktivno stanje, pamćenje, „Prijem vozila" labela.
- [ ] Sužen sidebar: amber tačka + flyout.
- [ ] Lista: oba režima (eyebrow/H1/podnaslov/čip vs select), segmented VRSTA, placeholder pretrage, kolona KATEGORIJA samo u „sve".
- [ ] Tabela: tačne mono/Figtree kombinacije po koloni, hover, paginacija, ugašena kategorija sa †.
- [ ] Oba prazna stanja.
- [ ] Čarobnjak: stepper (3 stanja krugova + zelene spojnice), kartice vrste sa hover tintom, čip kategorije sa menijem, polja kategorije po config-u, segmenti krivice, pregled key/value + plava nota, dugmad NAZAD/DALJE/✓ SAČUVAJ (zeleno!).
- [ ] Detalj: naslovni red (25px mono MR + 3 pilla), tabovi sa crvenim underline, 4-kolonski osnovni podaci, dashed kartica polja sa 3 stanja, kvarovi sa pillovima krivice, Klijent vidi timeline, prilozi.
- [ ] Toast obrazac + fadeUp ulazi + hover lift na svoj dugmadi.
- [ ] Sve boje/veličine iz §0 — nijedno dugme puna crvena ispuna, kind boje plava/ljubičasta svuda.

Handback: screenshotovi svake stavke checkliste. Šта ne možeš da pomiriš sa kodom — pitaj, ne improvizuj.
