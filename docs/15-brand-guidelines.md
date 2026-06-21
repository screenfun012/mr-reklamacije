# 15 — MR Engines Brand Guidelines (Developer Reference)

> **Source file:** `MR Engines Brandbook.pdf` (May 2026), repository root.  
> **Extraction method:** Text verified with `pypdf` (28 pages). Page numbers below refer to **brandbook footer labels** (e.g. `09`, `10`), not PDF viewer page index.  
> **Scope:** admin-web, internal-web, portal-web + `@mr/ui` + `@mr/tailwind-preset`.

When this document and `docs/09-ui-ux.md` disagree, **this document wins** until 09 is updated.

---

## How to read this document

| Source tag | Meaning |
|------------|---------|
| **PDF p.X** | Hex or value appears in brandbook text extraction on footer page X |
| **derived** | Computed or inferred from confirmed tokens; not printed as hex in PDF |
| **app** | Reklamacije convention; not specified in brandbook web spec |
| **TBD** | Token name or behaviour in PDF without extractable hex — needs visual confirmation |
| **confirmed (Nikola)** | Product rule explicitly approved by Nikola (see §0) |

**Phase 1 rule:** Implement **only** tokens in §1–§8 (Confirmed). Do **not** wire §9 (Derived / TBD) into theme until Nikola confirms each item.

---

## 0. Confirmed product rules (Nikola)

### Brand red vs error red (PDF p.15 — **confirmed by Nikola, 2026-06-21**)

Brandbook originally marked this as “DECISION NEEDED”. Nikola confirms:

| Rule | Value | Source |
|------|-------|--------|
| Brand / CTA red | `#ED1C24` only for CTAs and marketing | PDF p.15 + **confirmed (Nikola)** |
| Functional error red | `#D92D20` always with **icon + label** | PDF p.15 + **confirmed (Nikola)** |
| Destructive actions | Use error `#D92D20`, not brand red | PDF p.22 + **confirmed (Nikola)** |

**Already in production (do not regress):**

- **Domaća** kind badge → brand red (`mr-brand`)
- **Odbijeno** outcome badge → error red (`mr-error`), not brand red

---

## 1. Confirmed (PDF) — Core brand colors

| Name | Hex | Source | Usage |
|------|-----|--------|-------|
| Brand red | `#ED1C24` | PDF p.14, p.16, p.17 | Primary CTA, marketing, Domaća kind badge |
| White | `#FFFFFF` | PDF p.14, p.16 | Surfaces, primary button text |
| Grey | `#3C3D41` | PDF p.14, p.17 | neutral-600, secondary chrome |
| Dark | `#191919` | PDF p.14, p.17 | text-primary (neutral-800) |

### Red scale (confirmed hex)

| Token | Hex | Source | Usage |
|-------|-----|--------|-------|
| red-400 | `#F0414A` | PDF p.16 | Focus ring (PDF p.22) |
| red-500 / primary | `#ED1C24` | PDF p.16 | CTA fill |
| red-600 / primary-hover | `#C8141B` | PDF p.16 | Primary hover (PDF p.22) |

---

## 2. Confirmed (PDF) — Semantic / state colors

| Role | Base hex | Subtle bg hex | Source | App token |
|------|----------|---------------|--------|-----------|
| Success | `#1FA971` | `#E7F6EF` | PDF p.15 | `mr-success`, `mr-success-subtle` |
| Warning | `#F5A623` | `#FEF3E2` | PDF p.15 | `mr-warning`, `mr-warning-subtle` |
| Error | `#D92D20` | `#FBE9E8` | PDF p.15 | `mr-error`, `mr-error-subtle` |
| Info | `#2E90FA` | `#E8F1FE` | PDF p.15 | `mr-info`, `mr-info-subtle` |

---

## 3. Confirmed (PDF) — Neutral / surface role tokens (light theme)

| Role token | Hex | Source | Notes |
|------------|-----|--------|-------|
| background / neutral-50 | `#F5F5F5` | PDF p.16 | Page background |
| surface | `#FFFFFF` | PDF p.16 | Cards, panels |
| text-primary / neutral-800 | `#191919` | PDF p.16 | Body headings |
| text-secondary / neutral-500 | `#5A5B60` | PDF p.16 | Secondary text |
| border / neutral-200 | `#C8C9CC` | PDF p.16 | Dividers, inputs |
| neutral-300 | `#A3A4A8` | PDF p.16 | — |
| neutral-600 | `#3C3D41` | PDF p.16 | — |
| neutral-700 | `#2A2B2E` | PDF p.16 | Dark surfaces (light-theme token name) |
| surface-raised | white + elevation | PDF p.16 | Elevation mentioned; shadow CSS values → §9 |

**Already mapped in code (confirmed hex only):**

| App token | Hex | Source |
|-----------|-----|--------|
| `mr-neutral-subtle` | `#F5F5F5` | PDF p.16 |
| `mr-neutral-muted` | `#5A5B60` | PDF p.16 |
| `mr-neutral-border` | `#C8C9CC` | PDF p.16 |

---

## 4. Confirmed (PDF) — Typography

### Font family

| Token | Value | Source | Notes |
|-------|-------|--------|-------|
| UI font | Figtree Variable | PDF p.9 | Single family for web UI |
| Hosting | `@fontsource-variable/figtree` | app | Self-hosted in each `__root.tsx`; no Google Fonts CDN |

### Web type scale (PDF p.10)

Base: **16px = 1rem**. Build in rem.

| Token | Desktop | rem | Line-height | Weight | Letter-spacing | Source |
|-------|---------|-----|-------------|--------|----------------|--------|
| Display | 64px | 4.0 | 1.05 | 800 | -0.02em | PDF p.10 |
| H1 | 48px | 3.0 | 1.1 | 700 | -0.02em | PDF p.10 |
| H2 | 36px | 2.25 | 1.15 | 700 | -0.01em | PDF p.10 |
| H3 | 28px | 1.75 | 1.25 | 600 | -0.01em | PDF p.10 |
| H4 | 22px | 1.375 | 1.3 | 600 | 0 | PDF p.10 |
| Body Large | 18px | 1.125 | 1.55 | 400 | 0 | PDF p.10 |
| Body | 16px | 1.0 | 1.6 | 400 | 0 | PDF p.10 |
| Caption | 14px | 0.875 | 1.45 | 500 | 0 | PDF p.10 |
| Micro | 12px | 0.75 | 1.4 | 500 | 0 | PDF p.10 |

**Letter-spacing rules (PDF p.10):** Display/H1 `-0.02em`; H2/H3 `-0.01em`; body `0`; uppercase labels/buttons `+0.04em`.

### Mobile type scale (PDF p.11)

| Token | Mobile | Desktop | Source |
|-------|--------|---------|--------|
| Display | 40px | 64px | PDF p.11 |
| H1 | 32px | 48px | PDF p.11 |
| H2 | 28px | 36px | PDF p.11 |
| H3 | 22px | 28px | PDF p.11 |
| H4 | 18px | 22px | PDF p.11 |
| Body, Caption, Micro | unchanged | unchanged | PDF p.11 |

**Rule:** Body never below 16px on mobile (PDF p.11).

---

## 5. Confirmed (PDF) — Buttons

### Variants (PDF p.22)

| Variant | Fill | Text | Border | Source |
|---------|------|------|--------|--------|
| Primary | red-500 `#ED1C24` | white | none | PDF p.22 |
| Secondary | transparent | red-500 | 1.5px red-500 | PDF p.22 |
| Tertiary / ghost | transparent | inherit | none | PDF p.22 |
| Destructive | error `#D92D20` | white | none | PDF p.22 |

### States — confirmed behaviour (PDF p.22)

| State | Primary | Secondary | Source |
|-------|---------|-----------|--------|
| Hover | fill → red-600 `#C8141B` | red-50 wash | PDF p.22 (wash hex → §9) |
| Active | fill → red-700 | — | PDF p.22 (red-700 hex → §9) |
| Focus | 2px ring red-400 `#F0414A`, 2px offset | same | PDF p.22 |
| Disabled | neutral-200 fill, neutral-400 text | not opacity-only | PDF p.22 (hex → §9) |
| Loading | spinner; fixed width | — | PDF p.22 |

### Sizes (PDF p.23)

| Size | Height | Padding X | Text size / weight | Source |
|------|--------|-----------|-------------------|--------|
| Large | 48px | 24px | 16–18px / 600 | PDF p.23 |
| Medium (default) | 40px | 16px | 16px / 600 | PDF p.23 |
| Small | 32px | 12px | 14px / 600 | PDF p.23 |

| Constraint | Value | Source |
|------------|-------|--------|
| Touch target minimum | 44×44px | PDF p.23 |
| 15° sheared buttons | marketing/print only | PDF p.13, p.23 — **not** default app buttons |

**Current gap:** `@mr/ui` Button uses shadcn `h-8`/`h-9`/`h-10` — not brand sizes yet (Phase 3).

---

## 6. Confirmed (PDF) — Spacing scale

| Token | px | rem | Typical use | Source |
|-------|-----|-----|-------------|--------|
| space-1 | 4 | 0.25 | Icon–text, tight gaps | PDF p.19 |
| space-2 | 8 | 0.5 | Inside small components | PDF p.19 |
| space-3 | 12 | 0.75 | Input/chip padding | PDF p.19 |
| space-4 | 16 | 1.0 | Default gap | PDF p.19 |
| space-5 | 24 | 1.5 | Between cards | PDF p.19 |
| space-6 | 32 | 2.0 | Section inner | PDF p.19 |
| space-7 | 40 | 2.5 | Between sub-sections | PDF p.19 |
| space-8 | 48 | 3.0 | Section padding | PDF p.19 |
| space-9 | 64 | 4.0 | Major sections | PDF p.19 |
| space-10/11 | 80/96 | 5.0/6.0 | Hero vertical | PDF p.19 |

Tailwind default 4px spacing grid aligns with this scale.

---

## 7. Confirmed (PDF) — Grid and breakpoints

| Breakpoint | Min width | Columns | Margin / gutter | Source |
|------------|-----------|---------|-----------------|--------|
| Mobile | < 640px | 4 | 16 / 16px | PDF p.20 |
| sm | 640px | 4 | 16 / 16px | PDF p.20 |
| md | 768px | 6 | 24 / 16px | PDF p.20 |
| lg | 1024px | 8 | 24 / 24px | PDF p.20 |
| xl | 1280px | 12 | 32 / 24px | PDF p.20 |
| 2xl | 1536px | 12 | auto / 24px | PDF p.20 |

| Constraint | Value | Source |
|------------|-------|--------|
| Max content width | 1280px, centred | PDF p.20 |

---

## 8. Confirmed (PDF) — Logo / iconography scope

| Topic | Source | Notes |
|-------|--------|-------|
| Wordmark, crest, badge usage | PDF p.7–8 | Marketing contexts; not UI icon library |
| UI icon library | — | **Not specified in brandbook** → app uses `lucide-react` (§9) |

---

## 9. Derived / TBD (pending Nikola confirmation)

**Do not implement in Phase 1.** These values exist in code or draft docs but are **not** fully confirmed from PDF text extraction.

### 9.1 Token table (current code / draft)

| Token | Current value | Source tag | In production? |
|-------|---------------|------------|----------------|
| `mr-brand-subtle` | `#FDECEF` | derived / TBD | Yes — Domaća badge bg, secondary hover draft |
| `mr-success-strong` | `#157A52` | derived | Yes — badge text |
| `mr-warning-strong` | `#9A6410` | derived | Yes — badge text |
| `mr-error-strong` | `#A82219` | derived | Yes — badge text |
| `mr-info-strong` | `#175CD3` | derived | Yes — badge text |
| red-700 (primary active) | *(no hex in PDF)* | TBD | No |
| red-50 wash (secondary hover) | *(no hex in PDF)* | TBD | Draft mapped to `#FDECEF` |
| neutral-200 (disabled bg) | *(name only in PDF p.22)* | TBD | No |
| neutral-400 (disabled text) | *(name only in PDF p.22)* | TBD | No |
| `--radius: 0.45rem` | ~7.2px | app | Yes — preset since 9.1c.1.5a |
| Card/input radius | `rounded-xl` / `rounded-md` | app | Yes — shadcn defaults |
| Badge shape | `rounded-full` | app | Yes — glow-up decision |
| Elevation / box-shadow | `shadow-sm` on badges | derived / TBD | Yes — no CSS spec in PDF |
| JetBrains Mono | monospace for MR numbers | app | Yes |
| Dark theme role hex map | partial in PDF p.16 table | TBD | Partial — shadcn `.dark` not brand-mapped |
| `--primary` OKLCH | `oklch(0.6 0.2324 26.5)` | derived | Yes — approx `#ED1C24` |
| `--destructive` OKLCH | shadcn default red-orange | app | Yes — intentionally distinct from primary (9.1c.1.5a) |

### 9.2 Questions for Nikola (visual check in brandbook)

Answer each by inspecting the PDF at the listed **brandbook page** (footer number). Reply with hex or “use derived X”.

1. **red-700 (primary button active press)**  
   - **Where:** p.22 — “Active: Primary fill → red-700”  
   - **Question:** What is the exact hex for `red-700`? (PDF text has the token name only.)

2. **red-50 wash (secondary button hover)**  
   - **Where:** p.22 — “Secondary → red-50 wash”  
   - **Question:** Is `#FDECEF` correct for `red-50`, or is there a different swatch on p.16/p.22?

3. **`mr-brand-subtle` for Domaća badge**  
   - **Where:** Compare p.15 semantic subtle backgrounds vs Domaća red usage on sample UI if shown  
   - **Question:** Confirm `#FDECEF` as brand-red subtle background, or provide correct hex.

4. **`*-strong` text colors for badges**  
   - **Where:** p.15 shows base + subtle bg only (no strong/dark text hex)  
   - **Question:** Confirm or replace: `#157A52`, `#9A6410`, `#A82219`, `#175CD3` for success/warning/error/info badge text.

5. **Disabled button neutrals**  
   - **Where:** p.22 — “neutral-200 fill, neutral-400 text”  
   - **Question:** What hex values map to neutral-200 and neutral-400? (Are they `#C8C9CC` / `#A3A4A8`, or different disabled-specific swatches?)

6. **Global border radius (buttons, inputs, cards)**  
   - **Where:** p.22–23 button specs (no radius in extracted text); compare with any component screenshots in PDF  
   - **Question:** Should app use a single `--radius` (currently `0.45rem` from partner project), and what value matches brandbook visuals?

7. **Elevation / shadows for `surface-raised`**  
   - **Where:** p.16 — “surface-raised white + elevation”  
   - **Question:** Provide shadow token (offset, blur, spread, opacity) or approve `shadow-sm` as interim.

8. **Dark theme complete map**  
   - **Where:** p.16 — “Role token Light theme / Dark theme” table (two columns)  
   - **Question:** For each role (bg, surface, text-primary, text-secondary, border, primary-hover), confirm dark-column hex values visually — text extraction lists some neutrals but not a complete verified dark set.

9. **Destructive vs primary in admin UI**  
   - **Where:** p.15 rule + p.22 destructive = `#D92D20`  
   - **Question:** Phase 3 will switch `--destructive` to error `#D92D20`. Confirm we drop the current shadcn red-orange distinction from 9.1c.1.5a (rely on icon/label + variant instead).

---

## 10. Already aligned (do not regress)

| Area | Status | Source | Location |
|------|--------|--------|----------|
| Figtree font | Loaded | PDF p.9 + app | `@fontsource-variable/figtree`, `globals.css` |
| Semantic badge base/subtle hex | In code | PDF p.15 | `tooling/tailwind/index.css`, `outcome-colors.ts`, `kind-colors.ts` |
| Brand vs error rule | Confirmed | PDF p.15 + **confirmed (Nikola)** | Badges + future destructive buttons |
| Tailwind scan for `mr-*` | Fixed | app | `@source` shared in `globals.css` + safelist |
| Domaća = brand, Odbijeno = error | Correct | **confirmed (Nikola)** | `kind-colors.ts`, `outcome-colors.ts` |

---

## 11. Phase roadmap (reference)

| Phase | Scope | Token source |
|-------|-------|--------------|
| **0** | This document + source audit | — |
| **1** | Central tokens in preset | **§1–§7 Confirmed only** |
| **2** | Typography scale in UI | **§4 Confirmed** |
| **3** | Button component | **§5 Confirmed** + §9 after answers |
| **4** | Card, input, table primitives | **§3, §6 Confirmed** + §9 radius/shadows |
| **5** | Page-by-page audit | All confirmed + resolved §9 |

Before each phase commit: `pnpm typecheck && pnpm lint && pnpm build && TZ=UTC pnpm test`. Restart `dev:all` for visual review.

---

## 12. Implementation map (code locations)

| Concern | File(s) |
|---------|---------|
| Theme tokens | `tooling/tailwind/index.css` |
| App font binding | `apps/*/src/styles/globals.css`, `apps/*/src/routes/__root.tsx` |
| Shared components | `packages/ui/src/primitives/*` |
| Badge colors (frozen until §9 confirms strong/subtle) | `packages/shared/src/constants/outcome-colors.ts`, `kind-colors.ts` |
| Tailwind content scan | `@source` in `globals.css` for `packages/ui` + `packages/shared` |

---

## 13. Brandbook page index

| Topic | Brandbook page (footer) |
|-------|-------------------------|
| Logos & usage | 7–8 |
| Figtree typography | 9 |
| Web type scale | 10 |
| Mobile type scale | 11 |
| Print type (ignore for app) | 12 |
| 15° shear (marketing) | 13 |
| Core colors | 14 |
| Semantic colors | 15 |
| Role tokens (light/dark) | 16 |
| Print CMYK/Pantone | 17 |
| Spacing | 19 |
| Grid & breakpoints | 20 |
| Button variants & states | 22 |
| Button sizes | 23 |

**PDF viewer note:** Brandbook footer page `09` is approximately PDF file page 12 (offset varies by cover/TOC). Always use footer labels when discussing with design.
