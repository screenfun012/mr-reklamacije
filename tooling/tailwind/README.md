# @mr/tailwind-preset

Shared Tailwind CSS v4 design tokens for MR Reklamacije frontends.

Based on the shadcn/ui default `neutral` theme using the OKLCH color
space and class-based dark mode.

## Usage

In your frontend's root CSS file (e.g., `src/styles/globals.css`):

```css
@import "tailwindcss";
@import "@mr/tailwind-preset";

/* per-app overrides go below this line */
```

Toggle dark mode by adding `class="dark"` to the `<html>` element (or
the closest ancestor of the elements you want themed).

## What's included

- shadcn/ui semantic color palette (light + dark) — background,
  foreground, card, popover, primary, secondary, muted, accent,
  destructive, border, input, ring
- Chart palette (chart-1 through chart-5, light + dark)
- Sidebar palette (sidebar, sidebar-foreground, sidebar-primary,
  sidebar-accent, sidebar-border, sidebar-ring — light + dark)
- Radius scale derived from a single `--radius` base (sm, md, lg, xl,
  2xl, 3xl, 4xl)
- Class-based dark mode via `@custom-variant dark (&:is(.dark *))`
- Global base layer applying default border + body colors

## What's NOT included (per-app)

- **Fonts.** Each frontend installs `@fontsource/inter` and
  `@fontsource/jetbrains-mono`, imports them, and defines
  `--font-sans` / `--font-mono` in its own globals.css after the
  preset.
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
