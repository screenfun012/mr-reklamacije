# @mr/tailwind-preset

Shared Tailwind CSS v4 design tokens for MR Reklamacije frontends.

MR Engines brandbook (May 2026) mapped to shadcn-compatible CSS variables.
Hex role tokens from brandbook p.14–16; class-based dark mode.

See `docs/15-brand-guidelines.md` for full token reference and source audit.

## Usage

In your frontend's root CSS file (e.g., `src/styles/globals.css`):

```css
@import 'tailwindcss';
@import '@mr/tailwind-preset';

/* per-app overrides go below this line */
```

Toggle dark mode by adding `class="dark"` to the `<html>` element (or
the closest ancestor of the elements you want themed).

## What's included

- Core brand palette: `#ED1C24`, `#FFFFFF`, `#3C3D41`, `#191919`
- Role tokens (light + dark) mapped to `--background`, `--foreground`,
  `--card`, `--border`, `--primary`, `--destructive`, etc.
- Semantic `mr-*` colors for badges (PDF p.15)
- Full neutral scale + derived button-state tokens (`--mr-red-700`,
  `--mr-neutral-400`, `--mr-red-50-wash`)
- `--destructive: #D92D20` (brandbook error red, not shadcn orange)
- Radius scale from `--radius: 0.45rem` (app convention)
- `--shadow-raised` for surface-raised elevation (derived)
- Chart palette — red gradation matching brand
- Sidebar palette — brand red active states

## What's NOT included (per-app)

- **Fonts.** Each frontend installs `@fontsource-variable/figtree` and
  `@fontsource/jetbrains-mono`, imports them in the root layout, and
  defines `--font-sans` / `--font-mono` in globals.css.
- **Animations.** `tw-animate-css` is per-app.

## Adding new tokens

Edit `index.css`. Two-layer pattern:

1. Raw values under `:root` / `.dark` (prefer `--mr-*` role names)
2. Map to Tailwind under `@theme inline` as `--color-*`

## Theme history

- shadcn neutral default → MR Reklamacije OKLCH rebrand (9.1c.1.5a)
- Phase 1 brandbook hex tokens (2026-06): role tokens p.16, destructive
  aligned to error `#D92D20`
