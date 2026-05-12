# @mr/tailwind-preset

Shared Tailwind CSS v4 design tokens for MR Reklamacije frontends.

MR Reklamacije brand theme: red primary, neutral grays, 0.45rem
base radius. Uses the OKLCH color space and class-based dark mode.

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

- MR Reklamacije brand palette (red primary, light + dark)
- Destructive token deliberately distinct from primary (red-orange
  vs brand red) so destructive actions remain visually clear in
  admin UIs
- Chart palette (chart-1 through chart-5) — red gradation matching
  primary
- Sidebar palette — uses primary red for active states, neutral
  grays for surface
- Radius scale derived from `--radius: 0.45rem` base (sm, md, lg,
  xl, 2xl, 3xl, 4xl) using a linear `+4px` stepping
- Class-based dark mode via `@custom-variant dark (&:is(.dark *))`
- Global base layer applying default border + body colors

## What's NOT included (per-app)

- **Fonts.** Each frontend installs
  `@fontsource-variable/figtree` (variable font — all weights in
  a single file) and `@fontsource/jetbrains-mono`, imports them
  in the root layout, and defines `--font-sans` / `--font-mono`
  in its own globals.css after the preset.
- **Animations.** `tw-animate-css` is per-app
  (`@import "tw-animate-css"` after the preset). The shadcn Dialog and
  similar primitives in `@mr/ui` rely on those animation utilities.

## Adding new tokens

Edit `index.css`. The pattern is two-layered:

1. Define the raw value under `:root` (and override under `.dark`):

   ```css
   :root {
     --warning: oklch(0.84 0.16 84);
     --warning-foreground: oklch(0.28 0.07 46);
   }

   .dark {
     --warning: oklch(0.41 0.11 46);
     --warning-foreground: oklch(0.99 0.02 95);
   }
   ```

2. Map it to a Tailwind utility under `@theme inline`:

   ```css
   @theme inline {
     --color-warning: var(--warning);
     --color-warning-foreground: var(--warning-foreground);
   }
   ```

After this, `bg-warning` and `text-warning-foreground` are valid
utility classes. The raw `var(--warning)` is also available in JSX
(e.g., for Recharts color props).

## Why two layers?

Direct `@theme { --color-x: oklch(...) }` works for utility classes,
but components that consume colors imperatively (charts, inline
styles in JS) need access to the raw `var(--x)`. The two-layer
pattern (`:root` for values, `@theme inline` for utility mapping) is
the shadcn v4 standard and supports both consumption styles cleanly.

## Theme history

Originally derived from shadcn/ui neutral default. Rebranded to the
MR Reklamacije palette (red primary, 0.45rem radius) in 9.1c.1.5a.
