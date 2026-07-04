# Handoff: MR Engines — Interna aplikacija (redesign)

## Overview

Redesign of the **internal claims application** (`apps/internal-web` in the `mr-reklamacije` monorepo). It covers the full app: login, registration, app shell with sidebar, dashboard (Početna), Pristiglo (Phase 2 placeholder), claims list with filters, claim detail with tabs, the "Nova reklamacija" 3-step wizard, and the full Statistika analytics page with filter-driven animated charts and Excel export.

The design language matches the already-implemented **client portal** redesign (see `design_handoff_client_portal`) — same brand palette, typography, dark/light theming, and component styling — so both apps feel like one product family.

## About the Design Files

The files in this bundle are **design references created in HTML** — an interactive prototype showing intended look and behavior, **not production code to copy directly**. The task is to **recreate this design inside the existing codebase** (`apps/internal-web`: React, TanStack Router, TanStack Query, Tailwind, existing `@mr/ui` + `@mr/i18n` packages) using its established patterns:

- Keep all existing routes, data fetching, permissions, and business logic (`@mr/shared` query options, `m()` i18n messages, `CLAIM_KIND_REGISTRY`, `OUTCOME_REGISTRY`, etc.).
- Replace only the **presentation layer**: layout, colors, typography, spacing, component styling, chart styling, and micro-animations.
- Map the design tokens below onto Tailwind config / CSS variables in `@mr/ui` rather than hardcoding hex values per component.

To open the prototype: open `MR Interna.dc.html` in a browser (keep `support.js` and `assets/` next to it). Log in with any credentials; navigate via the sidebar.

## Fidelity

**High-fidelity (hifi).** Colors, typography, spacing, radii, states, and copy are final intent. Recreate pixel-perfectly using the codebase's existing component library, extending it where needed. Data in the prototype is mock — bind real data from existing queries.

## Global structure

### Theming

Two themes via CSS variables on the app root (`data-theme="dark" | "light"`). Dark is the default. All components reference variables, never raw hex (except status/brand accents which stay constant across themes).

| Token                          | Dark                       | Light                      |
| ------------------------------ | -------------------------- | -------------------------- |
| `--bg` (page)                  | `#0b0b0d`                  | `#f4f4f5`                  |
| `--surface` (cards, sidebar)   | `#131316`                  | `#ffffff`                  |
| `--raised` (secondary buttons) | `#1a1a1f`                  | `#fafafa`                  |
| `--border` (hairlines)         | `rgba(255,255,255,.09)`    | `rgba(20,20,25,.1)`        |
| `--border2` (inputs, stronger) | `rgba(255,255,255,.16)`    | `rgba(20,20,25,.2)`        |
| `--text`                       | `#f2f2f3`                  | `#17171a`                  |
| `--text2` (secondary)          | `#9c9da3`                  | `#5c5d63`                  |
| `--red` (brand)                | `#ed1c24`                  | `#ed1c24`                  |
| `--redh` (brand hover/links)   | `#ff4b52`                  | `#c8141b`                  |
| `--inbg` (input bg)            | `rgba(255,255,255,.045)`   | `rgba(20,20,25,.03)`       |
| `--rowhv` (row hover)          | `rgba(255,255,255,.03)`    | `rgba(20,20,25,.03)`       |
| `--hdr` (topbar, blurred)      | `rgba(11,11,13,.78)`       | `rgba(244,244,245,.82)`    |
| primary btn bg `--btn`         | `#f2f2f3` (text `#101013`) | `#17171a` (text `#ffffff`) |

Status colors (constant): accepted `#1fa971`, rejected `#e05c52`, pending `#f5a623`, archived `#6b6c72`, EMOTIVE `#2e90fa`, DOMAĆE `#a78bfa`, info `#2e90fa`.

### Typography

- **Figtree** (Google Fonts, 300–900 + italics): all UI text. Body 14–15px/1.55; H1 32–34px w800, letter-spacing −0.02em; card titles 15–16px w800.
- **JetBrains Mono** (400–700): all numbers, codes (MR broj, claim no., serials, dates), micro-labels/eyebrows (9.5–11px, w600, uppercase, letter-spacing .12–.22em), KPI values (26–27px w700, `font-variant-numeric: tabular-nums`).

### Background texture (main content area)

- 56px grid: two `linear-gradient` layers at `--grid` opacity, masked to fade out ~46% down.
- Decorative rotating cog (masked PNG `assets/icon-cog.png`), ~440px, top-right, color `--gear` (5% fg), `spin 130s linear infinite`, `pointer-events:none`.

### App shell

- **Sidebar** 236px fixed, `--surface`, right hairline border. Top: white-mask logo (128px) + eyebrow "INTERNA APLIKACIJA". Nav items: mono index (`01`–`04`) + label, 11px 13px padding, radius 9px; active = `rgba(237,28,36,.1)` bg + `rgba(237,28,36,.35)` border + red index; badge pill (e.g. pending count) mono 10px on `rgba(237,28,36,.14)`. Bottom: avatar circle (red, initials), name + role, "Odjava →" link.
- **Topbar** 58px sticky, `--hdr` + `backdrop-filter: blur(14px)`, bottom hairline. Left: mono breadcrumb `INTERNO / {SECTION}` (slash in red). Right: EN/SR segmented toggle + theme toggle (both mono 11px, bordered radius 8px; active segment = red bg white text).
- Content column: `max-width: 1280px` (list page 1360px, detail 1080px, wizard 860px), padding `36px 32px 72px`.

## Screens / Views

### 1. Login (`/login`)

Split layout. Left panel (flex 1.22): workshop photo (`assets/bg-workshop.png`) with dark gradient overlay (196deg, .22→.96), faint 56px grid, slow Ken-Burns zoom (`scale 1.02→1.09, 28s alternate`); rotating cog watermark bottom-right; white logo top-left (180px); hero: red mono eyebrow "INTERNA APLIKACIJA — EST. 1968", H1 clamp(34–50px) w800, subtitle, 3 checkmark trust rows (red check icon 16px); bottom marquee strip (mono 10.5px uppercase services list, 36s loop, red diamond separators, blurred dark bg).
Right panel (flex 1, min 460px): centered card 384px on `--bg` with grid + red radial glow top-right. Top-right corner: EN/SR + theme toggles. Content: cog icon + "Prijava" (32px w800), subtitle, Email + Lozinka fields (48px, radius 9px, `--inbg`, border `--border2`; focus: red border + `0 0 0 3px rgba(237,28,36,.18)` ring), "Zaboravljena lozinka?" link right-aligned (redh), primary button 52px ("PRIJAVA →", uppercase 14px w700, radius 10px, hover lift −1px), divider "NOVI ZAPOSLENI?", secondary outline button "REGISTRUJ SE" (hover: red border + red text + faint red bg), footer mono "interno.mrengines.rs · samo za zaposlene".

### 2. Registracija

Same split layout. Fields: Ime i prezime, Email, Lozinka, Potvrda lozinke (46px). Info note (blue): "Nakon registracije nalog čeka odobrenje administratora…" — 13px on `rgba(46,144,250,.09)` bg, `rgba(46,144,250,.26)` border, radius 10px, blue dot bullet. Primary "REGISTRUJ SE →", link back to Prijava. On submit → back to login + toast.

### 3. Početna (dashboard)

- Header: red mono date eyebrow ("PETAK · 03.07.2026"), H1 "Dobro došao, {ime}" 34px, subtitle with live counts.
- **KPI cards**: auto-fit grid `minmax(150px, 1fr)`, radius 12px, `--surface`; header row = mono uppercase label + status dot; value mono 27px. Status cards get tinted borders (e.g. pending `rgba(245,166,35,.35)`). Optional trend chip (mono 11px, e.g. "▲ 2").
- **Two lists side by side** (1fr 1fr): "Najnovije reklamacije" (link Sve →) and "Najduže otvorene" (hint 30+ dana). Rows: MR broj (mono 12.5px w600) + partner (12.5px muted) | kind pill | date / days-open pill (red tint if >30 days). Row hover `--rowhv`, whole row clickable → detail.
- **Monthly chart card**: stacked bars (accepted/rejected/pending), 190px tall, mono month labels, legend chips top-right, bars animate in (`growH .8s` staggered).

### 4. Pristiglo (Phase 2 placeholder)

Dashed-border card, centered: blue chip "FAZA 2" (mono, pill), H2 "Modul stiže u Fazi 2", explanation paragraph (client-portal requests will land here for translation + one-click claim creation), rotating cog watermark.

### 5. Reklamacije (list)

- Header row: H1 + subtitle left; right: primary "+ NOVA EMOTIVE" + outline "+ NOVA DOMAĆA".
- **Filter card**: kind segmented control (Sve / EMOTIVE / DOMAĆE — active red bg white text), Ishod select, Proizvođač select, date od/do, search input (flex 1). Labels = mono 9.5px uppercase. Controls 40px, radius 9px.
- **Table card**: header "Lista reklamacija" + mono count. Grid columns: Tip pill | MR broj (mono w600) | Br. reklamacije (mono muted) | Ishod pill (dot + uppercase mono 9px) | Partner (w600, ellipsis) | Motor (mono) | Zaposleni | Završena ↓ | Primljena | red → chevron. Column headers mono 9.5px uppercase on `--inbg` strip. Rows 12px 20px padding, bottom hairline, hover `--rowhv`, cursor pointer, whole row → detail. Horizontal scroll below 1180px.
- Pills: kind EMOTIVE = blue tint `rgba(46,144,250,.13)`/`#2e90fa`; DOMAĆA = purple tint `rgba(139,92,246,.15)`/`#a78bfa`. Outcome: pending amber / accepted green / rejected red / archived gray, each `rgba(c,.13)` bg + solid dot.
- Footer: "Prikazano 1–N od M" + pagination squares 32px (active red).

### 6. Detalj reklamacije

- Back link "← Reklamacije".
- Title block: MR broj as H1 in mono 36px, kind pill + outcome pill next to it; meta line partner · motor · datum prijema.
- Action row (only while pending): green solid "✓ PRIHVATI", red outline "ODBIJ", neutral outline "IZMENI". In production these call the existing outcome mutations.
- **Tabs**: Pregled | Kvarovi · n | Prilozi · n | Izveštaj — 13.5px, active w700 + 2px red underline.
- _Pregled_: "Osnovni podaci" card, 4-col grid of label/value pairs (label mono 9.5px uppercase muted; value 14.5px w600, codes in mono); "Nalaz" card (paragraph or italic empty-state); "Zapisnik o inspekciji" card (cog icon in title); footer mono "Poslednja izmena: …".
- _Kvarovi_: one card per fault — mono index, title 16px w700, meta chips (Odeljenje / Zaposleni / Eksterna strana — bordered 9.5px mono chips), description paragraph. Dashed "+ Dodaj kvar" button.
- _Prilozi_: file rows — 38px ext badge (mono red text), filename mono 13px, size · date mono muted, download icon-button (hover red). Dashed drop-zone "↑ Prevucite fajl ili kliknite za dodavanje" (70px).
- _Izveštaj_: pending → amber pulsing chip "NA ČEKANJU" + "Izveštaj još nije generisan" empty state; decided → "Izveštaj je spreman" + primary "PDF ↓".

### 7. Nova reklamacija (wizard, 3 steps)

- Stepper: 34px circles (active red bg white, done green tint + ✓, upcoming outlined), connecting hairlines (green when passed), labels 13.5px.
- Step 1 "Osnovni podaci": card, 2-col grid — Partner*, Proizvođač*, MR broj*, Br. reklamacije, Tip motora*, Serijski broj, Datum prijema\*, Zadužen. Inputs 44px; codes/dates in mono.
- Step 2 "Kvarovi": repeatable fault card ("KVAR 01" + remove ✕) — Naziv kvara\* full-width, Odeljenje + Zaposleni selects, Opis textarea. Dashed "+ Dodaj kvar".
- Step 3 "Pregled": key/value review list (label mono uppercase / value w600, hairline separators) + blue info note ("otvara se sa ishodom Na čekanju").
- Footer nav: outline "← NAZAD" left; right: primary "DALJE →" (steps 1–2) or green "✓ SAČUVAJ" (step 3) → returns to list + success toast.

### 8. Statistika

Mirrors every analytics module of the current implementation, restyled. **All charts are driven by the filters and must animate on filter change** (see Interactions).

Order top-to-bottom:

1. **Filter card**: Period select (Poslednja 24 meseca / Poslednjih 12 meseci), Tip segmented (Sve/EMOTIVE/DOMAĆE), Proizvođač select, "✕ Poništi filtere" outline button. Below: mono summary line ("Poslednja 24 meseca · Svi proizvođači · Sve").
2. **KPI row**: Ukupno, EMOTIVE, Domaće, Prihvaćene, Odbijene, Na čekanju, Stopa prihvatanja (%).
3. **Reklamacije po mesecima**: grouped bars per month — EMOTIVE (blue) + DOMAĆE (purple), 176px plot, mono month labels `MM.YY` (every 2nd label hidden at 24-month range), legend top-right.
4. **Po godinama** (paired year bars, totals above) + **Ukupan trend · 12 meseci** (three bordered stat cells: Ukupno / Prethodni period / Promena; direction chip "▲ Obim raste" green tint or "▼ Obim opada" red tint; caption "N reklamacija u odnosu na prethodnih 12 meseci (±X%)"; 12-bar red spark strip, 70px).
5. Section eyebrow **PO PROIZVOĐAČU** (mono red): **Rang proizvođača** (horizontal bars, red gradient `#ed1c24→#ff4b52`, right-aligned labels 128px, mono values) + **Ishod po proizvođaču** (100% stacked green/amber/red bars, 14px tall, legend below).
6. Section **ISHODI I VREME OBRADE**: **Raspodela ishoda** — SVG donut (r=64, stroke 22, track `--inbg`, segments via stroke-dasharray) with mono total in the center + legend (count + %); **Vreme obrade** — note "Procena za starije reklamacije" + three stat cells: Prosek / Medijana / Najduže (amber highlight), values mono 24px, "d" unit.
7. **Stopa prihvatanja po mesecima**: green gradient columns, % value above each bar (mono 9px green), 150px plot.
8. Section **STRUKTURA**: **Po izvoru** (blue gradient bars, subtitle "Samo EMOTIVE reklamacije"; SELMAN / VITOBELLO / Direktno / Nepoznato) + **Po zaduženom zaposlenom** (red gradient bars); **Po tipu motora** full-width (gray gradient bars, mono labels, top 8).
9. Section **IZVOZ PODATAKA**: **Excel izvoz** card (red top accent line) — Obuhvat select (Sve / Samo EMOTIVE / Samo domaće), Godina text input, Datum od/do, Ishod select, red solid "↓ IZVEZI EXCEL" button right-aligned. Wire to the existing export endpoint; keep the legacy-workbook column layout copy.

## Interactions & Behavior

- **Navigation**: sidebar switches sections; list rows and dashboard rows open detail; wizard/detail have back links. Keep existing TanStack routes.
- **Chart filter animations** (Statistika): when any filter changes, recompute the datasets and let the bars/donut transition — do **not** remount charts.
  - Vertical bars: `transition: height .65s cubic-bezier(.22,1,.36,1)`
  - Horizontal/stacked bars: same transition on `width`
  - Donut: transition `stroke-dasharray` and `stroke-dashoffset` `.7s` same easing
  - If the codebase uses a chart library instead of DOM bars, enable its animate-on-update mode with ~600–700ms ease-out to match.
- **Entry animations**: cards fade-up `fadeUp .5s` staggered ~60ms; bars `growH/growW .8s` on mount only.
- **Hovers**: buttons lift `translateY(-1px)`; primary bg lightens; outline buttons gain red border + red text; rows/list items get `--rowhv`; links underline or turn `--redh`.
- **Focus**: inputs get red border + `0 0 0 3px rgba(237,28,36,.18)` ring.
- **Toasts**: bottom-center dark pill (radius 11px, green check icon, 14px), slide-up `.35s`, auto-dismiss ~2.8s. Used for: save success, export started, registration submitted.
- **Empty states**: italic muted line inside cards (Nalaz/Zapisnik); full placeholder card with chip for Pristiglo/Izveštaj.
- **Language toggle** (SR/EN) and **theme toggle** live in the topbar; both persist per user. All strings run through the existing `@mr/i18n` `m()` system — the prototype's `dict()` object in `MR Interna.dc.html` contains the full SR/EN copy deck to reuse.

## State Management

Keep the existing state architecture (router search params for list filters, TanStack Query for data). The design implies:

- List: kind / outcome / manufacturer / date-range / search — already in `ClaimsSearchSchema`; segmented kind control maps to the same param.
- Statistika filters: period (12/24), kind, manufacturer → drive every module; "Poništi filtere" resets all three.
- Detail tabs via search param (existing `ClaimDetailTab`).
- Wizard step state local; save → mutation → navigate to list + toast.
- Theme + language: persisted user preference (localStorage or profile).

## Design Tokens

### Colors

See theming table above, plus: success `#1fa971` (hover lighter `#27c286`), danger `#e05c52`, warn `#f5a623`, info/EMOTIVE `#2e90fa` (gradient pair `#1d6fd6`), DOMAĆE purple `#a78bfa` / `rgba(139,92,246,.15)`, archived `#6b6c72`–`#96969e`, brand red gradient `#ed1c24 → #ff4b52`. Tinted pill pattern: `rgba(statusColor, .13)` bg + solid status color text/dot.

### Spacing

Base 4px scale. Card padding 24–28px; card gap 20px; section gap 34px; input padding-x 12–16px; content top padding 36px.

### Radii

Buttons 9–10px · inputs 9px · cards 12–15px · mini stat cells 10px · pills/badges 999px · file/ext badges 8–9px.

### Component sizes

Primary/secondary buttons 46–52px (forms) / 40–46px (toolbars); inputs 40–48px; table rows ~46px; sidebar 236px; topbar 58px; pagination squares 32px.

### Shadows

Primary button `0 12px 30px rgba(0,0,0,.28)`; red button `0 10px 26px rgba(237,28,36,.28)`; toast `0 20px 50px rgba(0,0,0,.5)`; cards rely on borders, not shadows.

### Motion

Easing `cubic-bezier(.22,1,.36,1)` (ease-out-quint feel). Durations: hover .15–.2s, chart transitions .65–.7s, entry .5s, marquee 36s, cog spin 70–150s, Ken-Burns 28s.

## Assets

In `assets/`: `logo-white.png` (used via CSS mask so it can be tinted — white in dark theme, red in light), `bg-workshop.png` (login hero photo), `icon-cog.png` + `icon-check.png` (masked, tinted via `background: currentColor`). In production prefer the existing `MrEnginesLogo` component from `@mr/ui` and SVG icons (lucide) matching these shapes.

## Files

- `MR Interna.dc.html` — the full interactive prototype (all 8 screens; template + logic + full SR/EN copy deck in `dict()`)
- `support.js` — runtime for the prototype (needed only to open the HTML; ignore for implementation)
- `assets/` — images listed above
- See also `DESIGN-GUIDELINES.md` (same folder or project root) — the general style guide for building **any future screen** in this design language.
