# MR Engines — Design Guidelines (Web aplikacije)

Opšti stil-vodič za **sve MR Engines web aplikacije** (klijentski portal, interna aplikacija, admin panel). Ovaj dokument je izvor istine za buduće ekrane i komponente — kada praviš nešto novo, drži se ovoga umesto da izmišljaš novi stil. Za konkretne ekrane vidi README u handoff folderima (`design_handoff_client_portal`, `design_handoff_internal_app`).

---

## 1. Brend i ton

- Brend: **MR Engines** — remont motora, Beograd, od 1968. Industrijski, precizan, pouzdan.
- Vizuelni jezik: taman "workshop" ambijent, crveni brend akcenat, monospace za sve tehničko (brojevi, kodovi, datumi), suptilna mreža (grid) u pozadini, spori rotirajući zupčanik kao vodeni žig.
- Bez emoji-ja u UI. Strelice i simboli: `→ ← ↓ ↑ ✓ ✕ ▲ ▼ ‹ ›`.
- Dvojezično: SR (podrazumevano) + EN. Sav tekst kroz i18n, nikad hardkodovan.

## 2. Boje

### Teme (CSS varijable na root elementu, `data-theme="dark" | "light"`)

Dark je podrazumevana tema. Komponente NIKAD ne koriste sirove hex vrednosti za pozadine/tekst/ivice — samo varijable.

| Varijabla   | Uloga                             | Dark                     | Light                   |
| ----------- | --------------------------------- | ------------------------ | ----------------------- |
| `--bg`      | pozadina stranice                 | `#0b0b0d`                | `#f4f4f5`               |
| `--surface` | kartice, sidebar, tabele          | `#131316`                | `#ffffff`               |
| `--raised`  | sekundarna dugmad, badge pozadine | `#1a1a1f`                | `#fafafa`               |
| `--border`  | tanke linije, separatori          | `rgba(255,255,255,.09)`  | `rgba(20,20,25,.1)`     |
| `--border2` | ivice inputa i outline dugmadi    | `rgba(255,255,255,.16)`  | `rgba(20,20,25,.2)`     |
| `--text`    | primarni tekst                    | `#f2f2f3`                | `#17171a`               |
| `--text2`   | sekundarni tekst, labele          | `#9c9da3`                | `#5c5d63`               |
| `--inbg`    | pozadina inputa                   | `rgba(255,255,255,.045)` | `rgba(20,20,25,.03)`    |
| `--rowhv`   | hover reda/stavke                 | `rgba(255,255,255,.03)`  | `rgba(20,20,25,.03)`    |
| `--hdr`     | sticky topbar (uz blur)           | `rgba(11,11,13,.78)`     | `rgba(244,244,245,.82)` |
| `--grid`    | pozadinska mreža                  | `rgba(255,255,255,.033)` | `rgba(20,20,25,.045)`   |

### Brend

- Crvena: `#ed1c24` (primarni akcenat, aktivna stanja, segmented kontrole)
- Crvena hover/link: dark `#ff4b52`, light `#c8141b` (`--redh`)
- Crveni gradijent (barovi, akcentne linije): `linear-gradient(90deg, #ed1c24, #ff4b52)`
- Crvena se koristi ŠTEDLJIVO: aktivna nav stavka, aktivan segment, linkovi, akcenti, jedan primarni CTA po ekranu maksimalno. Nikad kao pozadina velikih površina.

### Statusne boje (konstantne u obe teme)

| Status                  | Boja                                | Pill pozadina           |
| ----------------------- | ----------------------------------- | ----------------------- |
| Prihvaćeno / uspeh      | `#1fa971` (hover `#27c286`)         | `rgba(31,169,113,.13)`  |
| Odbijeno / greška       | `#e05c52`                           | `rgba(224,92,82,.13)`   |
| Na čekanju / upozorenje | `#f5a623`                           | `rgba(245,166,35,.13)`  |
| Arhivirano / neutralno  | `#6b6c72`–`#96969e`                 | `rgba(150,150,158,.13)` |
| EMOTIVE / info          | `#2e90fa` (gradijent par `#1d6fd6`) | `rgba(46,144,250,.13)`  |
| DOMAĆE                  | `#a78bfa`                           | `rgba(139,92,246,.15)`  |

**Pill obrazac**: pozadina `rgba(boja, .13)` + tekst/tačka u punoj boji. Nikad puna statusna boja kao pozadina pilla.

## 3. Tipografija

- **Figtree** (Google Fonts, 300–900): sav UI tekst.
- **JetBrains Mono** (400–700): sve tehničko — brojevi, MR brojevi, serijski brojevi, datumi, vremena, procenti, KPI vrednosti, eyebrow labele, breadcrumb, kolonske labele tabela.

| Uloga                  | Font           | Veličina / težina    | Napomena                                            |
| ---------------------- | -------------- | -------------------- | --------------------------------------------------- |
| H1 (naslov ekrana)     | Figtree        | 32–34px / 800        | letter-spacing −0.02em                              |
| H1 hero (login)        | Figtree        | clamp(34–50px) / 800 | line-height 1.07                                    |
| Naslov kartice         | Figtree        | 15–16px / 800        |                                                     |
| Body                   | Figtree        | 14–15px / 400–500    | line-height 1.5–1.65                                |
| Sekundarni tekst       | Figtree        | 12.5–13.5px / 400    | boja `--text2`                                      |
| Dugmad                 | Figtree        | 12–14px / 700        | UPPERCASE, letter-spacing .07–.09em                 |
| Eyebrow / labela polja | JetBrains Mono | 9.5–11px / 600       | UPPERCASE, letter-spacing .12–.22em, boja `--text2` |
| KPI vrednost           | JetBrains Mono | 24–27px / 700        | `font-variant-numeric: tabular-nums`                |
| Kod / datum u tabeli   | JetBrains Mono | 11.5–13px / 500–600  |                                                     |
| Sekcijski eyebrow      | JetBrains Mono | 10px / 600           | UPPERCASE, spacing .2em, boja `--redh`              |

## 4. Razmaci, radijusi, senke

- **Razmak**: skala od 4px. Padding kartice 24–28px; gap između kartica 20px; gap između sekcija 34px; sadržaj stranice `padding: 36px 32px 72px`.
- **Širine sadržaja**: standard 1280px; široke tabele 1360px; detalj 1080px; forme/wizard 860px. Uvek centrirano (`margin: 0 auto`).
- **Radijusi**: input 9px · dugme 9–10px · kartica 12–15px · mini stat ćelija 10px · pill/badge 999px.
- **Senke**: kartice NEMAJU senku — definisane su ivicom (`1px solid var(--border)`). Senke samo na: primarno dugme `0 12px 30px rgba(0,0,0,.28)`, crveno dugme `0 10px 26px rgba(237,28,36,.28)`, toast `0 20px 50px rgba(0,0,0,.5)`, modali.

## 5. Komponente

### Dugmad

Sva dugmad: UPPERCASE, w700, radius 9–10px, `cursor: pointer`, hover `translateY(-1px)` + promena boje, active `scale(.99)`.

| Tip                | Stil                                                                                   | Upotreba                                           |
| ------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Primarno**       | bg `--btn` (svetlo na dark temi / tamno na light), tekst `--btnfg`, senka              | glavni CTA — jedan po ekranu/kartici               |
| **Crveno (solid)** | bg `#ed1c24`, tekst `#fff`, hover `#ff4b52`                                            | destruktivno-važne ili brend akcije (Izvezi Excel) |
| **Zeleno (solid)** | bg `#1fa971`, tekst `#fff`                                                             | potvrdne akcije (Prihvati, Sačuvaj)                |
| **Outline**        | bg `--raised`, ivica `--border2`, tekst `--text`; hover: crvena ivica + `--redh` tekst | sekundarne akcije                                  |
| **Outline crveno** | transparent, ivica `rgba(224,92,82,.5)`, tekst `#e05c52`; hover blaga crvena pozadina  | Odbij i sl.                                        |
| **Dashed**         | transparent, `1px dashed --border2`, tekst `--text2`; hover crveno                     | "+ Dodaj X", drop-zone                             |
| **Ghost/link**     | bez pozadine, `--text2` → hover `--redh`                                               | back linkovi, "Sve →"                              |

Visine: 46–52px (forme/CTA), 40–46px (toolbar), 32–36px (ikonice, paginacija).

### Inputi i selecti

- Visina 40–48px, padding-x 12–16px, radius 9px, bg `--inbg`, ivica `1px solid --border2`, font 14–15px (kodovi/datumi u mono).
- Labela IZNAD polja: mono 9.5px uppercase `--text2`, gap 7px. Obavezno polje: ` *` u labeli.
- Focus: `border-color: #ed1c24` + `box-shadow: 0 0 0 3px rgba(237,28,36,.18)`. Bez podrazumevanog outline-a.
- Placeholder: trenutna boja teksta na 38% opacity-ja.
- Date inputi: `color-scheme: dark` na tamnoj temi.

### Segmented kontrola (izbor 2–4 opcije)

Spojena dugmad u okviru `1px solid --border2`, radius 8–9px, separatori `--border`. Aktivan segment: bg `#ed1c24`, tekst `#fff`. Neaktivan: transparent + `--text2`. Koristi se za: SR/EN, tip reklamacije, temu.

### Kartice

`background: var(--surface); border: 1px solid var(--border); border-radius: 12–15px`. Header kartice: naslov 15px w800 + opcioni link/meta desno, često odvojen donjom linijom (`--border`) uz padding `16px 20px`. Akcentna varijanta: 3px gradijentna linija preko vrha (`linear-gradient(90deg, #ed1c24, transparent 70%)`).

### Tabele / liste

- Kolonske labele: mono 9.5px uppercase na traci `--inbg`.
- Redovi: padding `12px 20px`, donja linija `--border`, hover `--rowhv`, ceo red klikabilan (strelica `→` u `--redh` na kraju).
- Vrednosti: identifikatori mono w600, sekundarno `--text2`, statusi kao pill.
- Paginacija: kvadrati 32px radius 8px, aktivna crvena.

### Pill / badge

`padding: 3–5px 10–13px; border-radius: 999px`, mono 9–10.5px w600, letter-spacing .09–.12em, uppercase; pozadina `rgba(boja,.13)` + tekst u boji; ishodi imaju tačku 6–7px ispred teksta.

### KPI kartica

Radius 12px; red: mono uppercase labela + statusna tačka 7px desno; ispod vrednost mono 24–27px w700 tabular-nums. Statusne KPI dobijaju tonirani border (`rgba(boja,.3)`).

### Tabovi

Horizontalni red na donjoj liniji; tab: `padding: 11px 18px`, 13.5px; aktivan w700 + 2px crveni underline; broj u tabu kao ` · n`.

### Toast

Fiksiran dole-centar: tamna pilula (`#17171b`, ivica `rgba(255,255,255,.14)`, radius 11px), zelena check ikonica, 14px tekst, slide-up `.35s`, auto-dismiss ~2.8s.

### Empty state

U kartici: italic `--text2` rečenica. Ceo modul: dashed kartica, centrirano — pill chip (npr. "FAZA 2" plavi), H2 22–24px w800, pasus `--text2` max 480px, zupčanik vodeni žig u uglu.

### Grafikoni (bez chart biblioteke — DOM/SVG)

- **Vertikalni barovi**: kolone flex-end; bar `border-radius: 4px 4px 2px 2px`; mono ose/labele 9–10px.
- **Horizontalni barovi**: track `--inbg` visine 9–14px radius 6px; fill gradijent (crveni = rang/količina, plavi = EMOTIVE/izvor, sivi = neutralno); labela desno poravnata levo od tracka, mono vrednost desno.
- **Stacked 100%**: segmenti zeleno/žuto/crveno u istom tracku.
- **Donut**: SVG krug r=64, `stroke-width: 22`, track `--inbg`, segmenti kroz `stroke-dasharray/-offset`, ukupno mono u sredini.
- **Legende**: čip 9px kvadrat radius 3px + 12px tekst `--text2`.
- Boje serija = statusne/kind boje, nikad nove.

## 6. Layout obrasci

- **App shell**: sidebar 236px (`--surface`, desna linija; logo + eyebrow aplikacije gore; nav sa mono indeksima `01`, `02`…; aktivna stavka crvena tinta + border; user blok dole) + sticky topbar 58px (`--hdr` + `backdrop-filter: blur(14px)`; mono breadcrumb `APLIKACIJA / SEKCIJA` sa crvenom kosom crtom; SR/EN + tema desno).
- **Auth ekrani**: split — levo foto radionice sa tamnim gradijentom, Ken-Burns zumom, hero tekstom, trust redovima i marquee trakom; desno forma max 384–396px na `--bg` sa mrežom i crvenim radial glow-om.
- **Pozadinska tekstura** (glavni sadržaj): 56px mreža (`--grid`) koja bledi nadole + veliki rotirajući zupčanik (~440px, 5% opacity, 130s, `pointer-events: none`) gore-desno.
- **Sekcije unutar stranice**: crveni mono eyebrow (npr. `PO PROIZVOĐAČU`) iznad grupe kartica, margina 34px gore / 14px dole.

## 7. Animacije i interakcije

- **Easing standard**: `cubic-bezier(.22,1,.36,1)`.
- **Ulaz sadržaja**: `fadeUp .5s` (opacity + translateY 18px), stagger ~60ms po kartici; barovi `growH/growW .8s` samo pri montiranju.
- **Promena podataka (filteri)**: NE remount-uj grafikone — tranzicije na postojećim elementima: visina/širina barova `.65s`, donut dasharray `.7s`.
- **Hover**: dugmad lift −1px; redovi `--rowhv`; linkovi → `--redh`/underline. Tranzicije boja `.15–.2s`.
- **Dekorativno**: zupčanik `spin 70–150s linear infinite`; marquee 36s; Ken-Burns 28s alternate. Uvek sporo i suptilno.
- Puls upozorenja (npr. "na čekanju" indikator): box-shadow ring `1.8s infinite` u žutoj.

## 8. Pisanje (copy)

- Kratko i direktno, bez marketinškog tona u internim alatima.
- Naslovi ekrana: imenica ("Reklamacije", "Statistika"). Dugmad: glagol ("Sačuvaj", "Izvezi Excel", "Dodaj kvar").
- Datumi `DD.MM.YYYY`, meseci u grafikonima `MM.YY`, vremena `HH:MM` — uvek mono.
- Srpski: latinica, prirodne dijakritike (č, ć, š, ž, đ). EN prevodi u istom registru.
- Empty state: prva rečenica šta nedostaje, druga šta će se desiti / šta uraditi.

## 9. Pristupačnost i kvalitet

- Kontrast: `--text2` na `--surface` je minimum za sekundarni tekst; nikad svetliji od toga za bitne informacije.
- Klik mete ≥ 40px (32px izuzetno za guste kontrole poput paginacije).
- Fokus uvek vidljiv (crveni ring). Ne oslanjati se samo na boju — statusi imaju i tekst.
- `prefers-reduced-motion`: isključiti marquee, Ken-Burns i spin; zadržati funkcionalne tranzicije skraćene.
- Sve slike imaju alt; ikonice dekorativne prirode `aria-hidden`.
