# Admin panel — Visual Design — Design Handoff

## What it is

`apps/admin-web` — the control plane of MR Engines' warranty-claims system, on
`admin.mrclaims.live`. Only administrators reach it. It is where users are approved, privilege sets
are composed, catalogues (departments, engine types, customers, workers…) are maintained, the audit
trail is read, and system settings are changed.

It is one of three apps that share a brand and a code base:

| App | Who uses it | Design state |
| --- | --- | --- |
| `internal-web` | employees, claims processing | **redesigned** — 545 lines of its own CSS, dark-first, textured |
| `portal-web` | customers | **redesigned** — its own client-facing look ("Precision Engineering") |
| **`admin-web`** | administrators | **never redesigned** — this handoff |

Nikola, 2026-08-19: _"funkcionalnost je tu ali dizajn ne… nekako mi je prazan."_ Asked which of four
things bothered him, he picked **all four**: every screen is a bare table · too much red · the
screens answer nothing · no rhythm, empty space.

## What has already been done (do not redo this)

On 2026-08-18/19 the panel was brought onto internal-web's **palette and skeleton**. That part is
finished and is the baseline you are designing on top of, not a draft to replace:

- **Palette** — admin now wears internal-web's exact colours, dark by default, with a working
  light theme. Table below.
- **Top bar** — `☰ · logo · ADMINISTRACIJA · SECTION` on the left, `EN/SR` + theme toggle on the
  right. Theme and language used to be two clicks deep in a user menu.
- **Sidebar** — thirteen entries, user block at the foot (initials, name, e-mail, Security, Sign
  out). The selected row is a red **tint** (`bg-mr-brand/10`), not the solid red slab it was.
- **Panels** — filters sit in a card; lists sit in a card with a header (`Spisak · Ukupno: 13`) and
  pagination inside it, under a rule.
- **Red was retired as decoration** — row actions are icons (pencil / power / trash), and text
  actions are grey until hover. On the users screen the only red left is a `Rejected` status badge
  and an `Administrator` role badge.
- **Dashboard** — the four stat tiles gained two panels beneath ("Traži tebe" = accounts waiting for
  approval, "Poslednje promene" = last six audit rows) and a "Ko najviše greši" card.

**So the skeleton is right and the colours are right. What is missing is everything that makes
internal-web look designed rather than assembled.**

## What is still missing (this is the job)

1. **No depth, no texture, no identity.** internal-web has a faint grid background, a large gear
   watermark, soft elevation. Admin is flat rectangles on flat background. It reads as a bootstrap
   admin template wearing the right colours.
2. **No motion.** internal-web has `mriFadeUp` / `mriFadeIn` staggered entrances on dashboard
   blocks. Admin has none — screens appear all at once, instantly, which is a large part of "prazan".
3. **The dashboard has no hierarchy.** Four equal tiles, then two equal panels, then one more. It
   does not say what matters most. This is the screen Nikola calls _"kapetanska stolica"_ — the
   captain's chair. It should read as one.
4. **Empty states are one grey sentence** in the middle of a panel. internal-web's are composed.
5. **Typography is shadcn default**, not a scale. Page `<h1>`, panel `<h2>`, table header, cell,
   meta — five sizes chosen ad hoc rather than a system.
6. **The login screen was never touched** at all.
7. **Thirteen catalogue screens are visually identical** to each other. Nothing tells you whether
   you are on Departments or Engine types except the words.

## Design system to match (dark default + `.light`)

⚠ **Admin does NOT use `--mri-*`.** Those tokens exist only inside `internal-web` and will not
resolve here. Admin uses the **shared preset** (`tooling/tailwind/index.css`) whose values are
overridden per-theme in `apps/admin-web/src/styles/globals.css` — that file is the source of truth.

Write Tailwind classes (`bg-card`, `text-foreground`, `border-border`), not raw hex.

| Tailwind class | Underlying token | Dark | Light |
| --- | --- | --- | --- |
| `bg-background` | `--mr-bg` | `#0b0b0d` | `#f4f4f5` |
| `bg-card`, `bg-popover` | `--mr-surface` | `#131316` | `#ffffff` |
| — (raised) | `--mr-surface-raised` | `#1a1a1f` | `#fafafa` |
| `text-foreground` | `--mr-text-primary` | `#f2f2f3` | `#17171a` |
| `text-muted-foreground` | `--mr-text-secondary` | `#9c9da3` | `#5c5d63` |
| `border-border`, `border-input` | `--mr-border` | `rgba(255,255,255,.09)` | `rgba(20,20,25,.10)` |
| `border-mr-border-strong` | `--mr-border-strong` | `rgba(255,255,255,.16)` | `rgba(20,20,25,.20)` |
| `bg-accent` (row hover) | `--mr-list-item-hover` | `rgba(255,255,255,.03)` | `rgba(20,20,25,.03)` |
| `bg-primary`, `text-mr-brand` | `--mr-primary` | `#ed1c24` | `#ed1c24` |

**Semantic hues** (same in both themes, from the brandbook): `mr-brand` red `#ed1c24` ·
`mr-error` `#d92d20` · `mr-warning` `#f5a623` · `mr-success` `#1fa971` · `mr-info` `#2e90fa` ·
`mr-accent` teal `#0e9384` · `mr-neutral` greys.

⚠ **The `-subtle` and `-strong` variants of those hues are fixed LIGHT-theme hexes.** The preset
declares them inside `@theme inline`, so `bg-mr-info-subtle` compiles to a literal and **cannot be
overridden per theme**. Every use needs an explicit `dark:` variant. The house pattern:

```
border-mr-info/45 bg-mr-info-subtle text-mr-info-strong
dark:border-mr-info/55 dark:bg-mr-info/20 dark:text-mr-info
```

**Fonts:** `Figtree Variable` for everything; `JetBrains Mono` for IDs, MR numbers, counts, codes,
timestamps and small uppercase labels. (`.cursor/rules/04-ui.mdc` still says Inter — that is stale.)

**Existing shapes to keep consistent with** (all exported from `@mr/ui`):

| Constant | Value |
| --- | --- |
| `panelClassName` | `rounded-[14px] border border-border bg-card` |
| `panelHeaderClassName` | `flex items-center justify-between gap-3 border-b border-border px-5 py-4` |
| `panelTitleClassName` | `text-[15px] font-extrabold text-foreground` |
| `panelMetaClassName` | `font-mono text-[11px] text-muted-foreground` |
| `dataTableCardClassName` | `overflow-hidden rounded-[14px] border border-border` |
| `BADGE_SHELL_CLASSES` | shared badge pill shell |

If a shape needs to change, change **these constants** — they are what makes all thirteen screens
move together. Do not hand-style one screen.

## Reference — the look to converge on

`apps/internal-web` is the approved design and runs on `localhost:3002`. Its dashboard
(`src/features/dashboard/`) and claims list (`src/features/claims/claims-table.tsx`,
`claims-filters.tsx`) are the closest analogues to what admin needs. Its background texture lives in
`apps/internal-web/src/styles/globals.css` (`mri-grid-bg`, `mri-grid-fade-down`, the gear SVG in
`internal-shell.tsx`).

**Admin is not meant to be a copy of internal-web.** It is the same family, one step calmer: fewer
people use it, they use it deliberately, and it is where irreversible things happen.

## Screens

Fourteen routes. All are live at `localhost:3001` — please look at them rather than working from
this list alone.

| Route | What it is | Priority |
| --- | --- | --- |
| `/` | **Dashboard** — 4 stat tiles, "Traži tebe", "Poslednje promene", "Ko najviše greši" | **highest** |
| `/login` | Split hero + form. Never touched | **high** |
| `/users` | Two cards: pending approvals, all users. Status + role badges, row actions | **high** |
| `/settings/roles` | Privilege sets: name, kind badge, action count, holder count. Editor dialog holds a permission matrix across 12 modules | **high** |
| `/audit` | Filter bar + expandable rows, infinite scroll | medium |
| `/settings/{departments, engine-types, engine-manufacturers, customers, employees, external-parties, claim-sources, intake-checklist}` | **Eight catalogue screens through ONE component.** Search + status filter, table, pagination, add/edit dialogs | medium — design once |
| `/settings/app` | Four settings, form | low |
| `/settings/security` | 2FA + sessions, form | low |

⚠ The eight catalogues render from a single shared component
(`apps/admin-web/src/lib/resource/resource-list-page.tsx`). Design **one** and all eight follow. Do
not design eight variants.

## Constraints — DO NOT CHANGE (this is my logic)

- **No behaviour changes.** Every screen keeps what it does: which permission gates it, which
  mutation it fires, which dialog it opens, what it validates. Layout and looks only.
- **Every user-facing string goes through Paraglide `m.*`**, with keys in BOTH `sr.json` and
  `en.json` (CI fails on a missing pair). **No ICU plurals** — they crash this repo's Paraglide
  compile. Phrase counts so no grammatical form depends on the number: `Ukupno: 12`, never
  `{count} stavki` (that reads "1 stavki" in Serbian). Serbian is primary, informal "ti".
- **Both themes, always.** Dark is the default; `.light` on `<html>` must work everywhere.
  A colour defined only for one theme is a bug.
- **Colours only via tokens.** Never a raw Tailwind palette colour (`violet-500`), never `bg-[#…]`.
  Opacity modifiers on a token (`bg-mr-brand/10`) are correct.
- **Red is not a default.** `@mr/ui`'s `<Button>` maps `default` to brand red and `outline` to a
  red border. That is the shared button system for all three apps and **is not being changed here** —
  but admin should reach for it sparingly. Red means brand, danger, or "this is the administrator";
  it does not mean "this is a button". If you believe the button system itself should change, say
  so in the handback rather than changing it — it is a three-app brandbook decision and Nikola's.
- **Icons: `lucide-react` only.** Every icon-only control needs `title` AND `aria-label`.
- **Libraries:** shadcn via `@mr/ui`, `@tanstack/react-table`, `recharts`, `sonner`. Anything else
  needs Nikola's approval before you use it.
- **Destructive actions go through `<ConfirmDialog>`** — never `confirm()`.
- **Skeletons, not spinners.** Every list needs empty, loading and error states designed.
- ⚠ **`recharts` is deliberately absent from admin.** It was split out of internal-web's bundle
  (269 → 143 KB gz). If a chart is worth adding here, it must be `React.lazy`-loaded, and say so.

## Files

- `apps/admin-web/src/styles/globals.css` — theme tokens. Add new ones in **both** blocks.
- `apps/admin-web/src/components/layout/` — shell, topbar, sidebar.
- `apps/admin-web/src/lib/resource/` — the shared catalogue screen (**eight screens at once**).
- `apps/admin-web/src/routes/_shell/index.tsx` + `src/components/dashboard/` — the dashboard.
- `apps/admin-web/src/components/{users,roles,audit,app-settings}/` — the five hand-written screens.
- `apps/admin-web/src/routes/login.tsx` — the login screen.
- `packages/ui/src/lib/field-control-styles.ts` — `panelClassName` and the `dataTable*` family.
  Shared by three apps: changing a value here moves internal-web and portal-web too, so flag it.

## Handback

Return the changed files (or a prototype `.dc.html` plus the values). I integrate them and run the
full gate.

Useful in the handback:

- **Screenshots in both dark and light** for every screen you touched.
- A note on **anything you needed but could not find a token for** — do not invent a hex; name the
  token you want and where it should live.
- A note on **anything in "DO NOT CHANGE" you think is wrong.** Several of those are decisions with
  reasons behind them, but two have already turned out to be worth reopening, so say so.

⚠ **The prototype is the specification, not this prose.** Where a returned prototype and this
document disagree, the prototype wins and I build to its actual values — read from its own CSS, not
estimated. That rule exists because I once built "in the spirit of" a handoff and missed a dozen
values (Nikola, 2026-07-27). So: whatever you decide, put it in the file rather than only in the
description.
