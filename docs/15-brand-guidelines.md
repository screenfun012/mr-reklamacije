# 15 — MR Engines Brand Guidelines (Developer Reference)

> **Source file:** `MR Engines Brandbook.pdf` (May 2026), repository root.  
> **Extraction:** `pypdf` text + **Nikola visual confirmation** (2026-06-21, pages 15–16, 22–23).  
> **Scope:** admin-web, internal-web, portal-web + `@mr/ui` + `@mr/tailwind-preset`.

When this document and `docs/09-ui-ux.md` disagree, **this document wins** until 09 is updated.

---

## How to read this document

| Source tag | Meaning |
|------------|---------|
| **PDF p.X** | Value from brandbook footer page X |
| **confirmed (Nikola)** | Explicitly approved by Nikola (screenshots / product rule) |
| **derived (Nikola visual confirm pending)** | No hex in PDF; wired in code; Nikola confirms on running app |
| **app** | Reklamacije convention; not in brandbook web spec |

**Phase 1 (done):** Confirmed tokens wired in `tooling/tailwind/index.css`. Derived tokens wired but flagged for visual review.

---

## 0. Confirmed product rules (Nikola)

### Brand red vs error red (PDF p.15 — **confirmed by Nikola, 2026-06-21**)

| Rule | Value | Source |
|------|-------|--------|
| Brand / CTA red | `#ED1C24` only for CTAs and marketing | PDF p.15 + **confirmed (Nikola)** |
| Functional error red | `#D92D20` always with **icon + label** | PDF p.15 + **confirmed (Nikola)** |
| Destructive actions | Use error `#D92D20`, not brand red | PDF p.22 + **confirmed (Nikola)** |

**In production:** Domaća → `mr-brand`; Odbijeno → `mr-error`.

---

## 1. Core brand colors (4 primaries — **confirmed (Nikola)**)

| Name | Hex | Source | Usage |
|------|-----|--------|-------|
| Brand red | `#ED1C24` | PDF p.14, p.16 | CTA, marketing, Domaća badge |
| White | `#FFFFFF` | PDF p.14, p.16 | Surfaces, primary button text |
| Grey | `#3C3D41` | PDF p.14, p.16 | neutral-600, dark surface-raised |
| Dark | `#191919` | PDF p.14, p.16 | text-primary light / bg dark |

### Red scale

| Token | Hex | Source |
|-------|-----|--------|
| red-400 | `#F0414A` | PDF p.16 |
| red-500 / primary | `#ED1C24` | PDF p.16 |
| red-600 / primary-hover (light) | `#C8141B` | PDF p.16, p.22 |
| primary-hover (dark) | `#F0414A` | PDF p.16 **confirmed (Nikola)** |

---

## 2. Semantic / state colors (PDF p.15 — **confirmed (Nikola)**)

| Role | Base | Subtle bg | Source | App token |
|------|------|-----------|--------|-----------|
| Success | `#1FA971` | `#E7F6EF` | PDF p.15 | `mr-success`, `mr-success-subtle` |
| Warning | `#F5A623` | `#FEF3E2` | PDF p.15 | `mr-warning`, `mr-warning-subtle` |
| Error | `#D92D20` | `#FBE9E8` | PDF p.15 | `mr-error`, `mr-error-subtle` |
| Info | `#2E90FA` | `#E8F1FE` | PDF p.15 | `mr-info`, `mr-info-subtle` |

---

## 3. Role tokens — light / dark (PDF p.16 — **confirmed (Nikola)**)

| Role token | Light | Dark | Source | shadcn var (Phase 1) |
|------------|-------|------|--------|----------------------|
| bg / background | `#F5F5F5` | `#191919` | PDF p.16 | `--background` |
| surface | `#FFFFFF` | `#2A2B2E` | PDF p.16 | `--card`, `--popover` |
| surface-raised | white + elevation | `#3C3D41` | PDF p.16 | `--popover` (dark), `--accent` (dark) |
| text-primary | `#191919` | `#FFFFFF` | PDF p.16 | `--foreground` |
| text-secondary | `#5A5B60` | `#A3A4A8` | PDF p.16 | `--muted-foreground` |
| border | `#C8C9CC` | `#3C3D41` | PDF p.16 | `--border`, `--input` |
| primary / CTA | `#ED1C24` | `#ED1C24` | PDF p.16 | `--primary` |
| primary-hover | `#C8141B` | `#F0414A` | PDF p.16 | `--mr-primary-hover` |
| focus ring | `#F0414A` | `#F0414A` | PDF p.22 | `--ring` |
| destructive | `#D92D20` | `#D92D20` | PDF p.15, p.22 | `--destructive` |

### Neutral scale (PDF p.16)

| Token | Hex | Source |
|-------|-----|--------|
| neutral-50 / bg | `#F5F5F5` | PDF p.16 |
| neutral-200 / border | `#C8C9CC` | PDF p.16 |
| neutral-300 | `#A3A4A8` | PDF p.16 |
| neutral-500 | `#5A5B60` | PDF p.16 |
| neutral-600 | `#3C3D41` | PDF p.16 |
| neutral-700 / dark surface | `#2A2B2E` | PDF p.16 |
| neutral-800 / text-primary | `#191919` | PDF p.16 |

**App aliases (unchanged):** `mr-neutral-subtle` `#F5F5F5`, `mr-neutral-muted` `#5A5B60`, `mr-neutral-border` `#C8C9CC`.

---

## 4. Typography (PDF p.9–11 — confirmed text)

| Token | Desktop | Mobile | Weight | Source |
|-------|---------|--------|--------|--------|
| Display | 64px | 40px | 800 | PDF p.10–11 |
| H1 | 48px | 32px | 700 | PDF p.10–11 |
| H2 | 36px | 28px | 700 | PDF p.10–11 |
| H3 | 28px | 22px | 600 | PDF p.10–11 |
| H4 | 22px | 18px | 600 | PDF p.10–11 |
| Body | 16px | 16px | 400 | PDF p.10 |
| Caption | 14px | 14px | 500 | PDF p.10 |
| Micro | 12px | 12px | 500 | PDF p.10 |

Font: **Figtree Variable** (PDF p.9). Monospace: **JetBrains Mono** (app).

Phase 2 applies this scale in components.

---

## 5. Buttons (PDF p.22–23 — **confirmed (Nikola)**)

### Variants

| Variant | Fill | Text | Border | Source |
|---------|------|------|--------|--------|
| Primary | `#ED1C24` | white | none | PDF p.22 |
| Secondary | transparent | red-500 / white (dark) | 1.5px `#ED1C24` | PDF p.22 |
| Tertiary / ghost | transparent | red-500 | none | PDF p.22 |
| Destructive | `#D92D20` | white | none | PDF p.22 |

### States

| State | Value | Source |
|-------|-------|--------|
| Hover primary | `#C8141B` (light) / `#F0414A` (dark hover token) | PDF p.16, p.22 |
| Active primary | red-700 → `#A8111A` | **derived (Nikola visual confirm pending)** |
| Secondary hover | red-50 wash → `#FDECEF` | **derived (Nikola visual confirm pending)** |
| Focus | 2px `#F0414A` ring, 2px offset | PDF p.22 |
| Disabled bg | `#C8C9CC` (neutral-200) | PDF p.16 + p.22 **confirmed (Nikola)** |
| Disabled text | `#7F8084` (neutral-400 derived) | **derived (Nikola visual confirm pending)** |

### Sizes (Phase 3 — not yet in Button component)

| Size | Height | Pad X | Text | Source |
|------|--------|-------|------|--------|
| Small | 32px | 12px | 14px / 600 | PDF p.23 |
| Medium | 40px | 16px | 16px / 600 | PDF p.23 |
| Large | 48px | 24px | 16–18px / 600 | PDF p.23 |

Touch target min **44×44px** (PDF p.23).

---

## 6. Spacing (PDF p.19)

| Token | px | rem | Source |
|-------|-----|-----|--------|
| space-1 … space-9 | 4 … 64 | 0.25 … 4.0 | PDF p.19 |
| space-10/11 | 80/96 | 5.0/6.0 | PDF p.19 |

---

## 7. Grid (PDF p.20)

Breakpoints: 640 / 768 / 1024 / 1280 / 1536px. Max content **1280px** centred. Gutters 16px mobile, 24px tablet+.

---

## 8. Derived / app (Nikola visual confirm pending)

Wired in Phase 1 preset; **do not change badge `*-strong` / `mr-brand-subtle`**.

| Token | Value | Source | CSS var |
|-------|-------|--------|---------|
| red-700 / primary active | `#A8111A` | derived (Nikola visual confirm pending) | `--mr-primary-active`, `--color-mr-red-700` |
| red-50 wash | `#FDECEF` | derived (Nikola visual confirm pending) | `--mr-red-50-wash`, `mr-brand-subtle` |
| neutral-400 (disabled text) | `#7F8084` | derived between `#A3A4A8` and `#5A5B60` | `--mr-disabled-text`, `--color-mr-neutral-400` |
| Elevation shadow | `0 1px 3px …` | derived (Nikola visual confirm pending) | `--mr-shadow-raised`, `--shadow-raised` |
| Border radius | `0.45rem` | app (not in brandbook) | `--radius` |
| Badge `*-strong` hex | see preset | derived (Nikola visual confirm pending) | frozen — badge code |
| Badge `rounded-full` | — | app | — |
| UI icons | lucide-react | app | — |

---

## 9. shadcn mapping (Phase 1 — `tooling/tailwind/index.css`)

| shadcn var | Maps to | Light hex | Dark hex |
|------------|---------|-----------|----------|
| `--background` | `--mr-bg` | `#F5F5F5` | `#191919` |
| `--foreground` | `--mr-text-primary` | `#191919` | `#FFFFFF` |
| `--card` | `--mr-surface` | `#FFFFFF` | `#2A2B2E` |
| `--primary` | `--mr-primary` | `#ED1C24` | `#ED1C24` |
| `--destructive` | `--mr-error` | `#D92D20` | `#D92D20` |
| `--border` | `--mr-border` | `#C8C9CC` | `#3C3D41` |
| `--ring` | `--mr-focus-ring` | `#F0414A` | `#F0414A` |
| `--muted-foreground` | `--mr-text-secondary` | `#5A5B60` | `#A3A4A8` |

---

## 10. Phase roadmap

| Phase | Status | Scope |
|-------|--------|-------|
| **0** | Done | This doc + source audit |
| **1** | Done | Preset tokens + shadcn mapping |
| **2** | Done | Typography scale in UI (`Heading`, page H1, section H3, list H2, body 16px) |
| **3** | Pending | Button sizes/states |
| **4** | Pending | Card, input, table surfaces |
| **5** | Pending | Page audit |

---

## 11. Do not regress

- Badge semantic colors (`outcome-colors.ts`, `kind-colors.ts`)
- Brand vs error rule (§0)
- `@source` shared in `globals.css` + badge safelist

---

## 12. Brandbook page index

| Topic | Page |
|-------|------|
| Figtree | 9 |
| Web / mobile type | 10–11 |
| Core colors | 14 |
| Semantic colors | 15 |
| Role tokens light/dark | 16 |
| Spacing | 19 |
| Grid | 20 |
| Buttons | 22–23 |
