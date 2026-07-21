# Command Palette (⌘K) — Visual Restyle — Design Handoff

**For:** Claude Design · **App:** `internal-web` (operators, dark-default) · **Type:** pure visual restyle, **no behavior change.**

## What it is

A ⌘K / Ctrl+K command palette (built on `cmdk`) that opens a dialog with: fuzzy
navigation commands + live claim search (jump to any claim by MR number /
customer). It works correctly today — **only the look needs work.** The owner's
words: _"radi, ali previše je mali i izgleda kao da je nalepljen na aplikaciji."_

## Why it currently reads as "pasted on" (diagnosis)

It reuses the generic `@mr/ui` Dialog with shadcn-neutral tokens instead of the
internal `--mri-` design language:

- Surface `bg-background` (generic) — not the internal dark surface (`--mri-raised`/`--mri-surface`).
- Overlay `bg-black/80` (harsh), **no backdrop blur** — the rest of the app (topbar) uses `backdrop-blur`.
- `max-w-[560px]`, vertically **centered** (`top-1/2`), modest padding → feels small.
- Generic `shadow-lg` + `border` — not the soft `--mri-shadow` elevation + hairline `--mri-border`.

## Design system to match (dark default + `.light`)

Tokens are Tailwind classes: `bg-mri-*`, `text-mri-*`, `border-mri-*`. Source of
truth: `apps/internal-web/src/styles/globals.css`. Reference the topbar for the
glass + label language: `apps/internal-web/src/components/layout/internal-topbar.tsx`.

| Token | Value (dark) | Use |
| --- | --- | --- |
| `--mri-bg` | `#0b0b0d` | page background |
| `--mri-surface` | `#131316` | cards |
| `--mri-raised` | `#1a1a1f` | **panels / overlays (use this for the palette)** |
| `--mri-border` | `rgba(255,255,255,.09)` | hairline borders |
| `--mri-border2` | `rgba(255,255,255,.16)` | stronger borders |
| `--mri-text` | `#f2f2f3` | primary text |
| `--mri-text2` | `#9c9da3` | secondary / labels / icons |
| `--mri-red` / `--mri-redh` | `#ed1c24` / `#ff4b52` | accent / hover |
| `--mri-hdr` | `rgba(11,11,13,.78)` | glass surface (pair with `backdrop-blur-[14px]`) |
| `--mri-shadow` | `0 24px 60px rgba(0,0,0,.55)` | elevation |
| `--mri-inbg` | `rgba(255,255,255,.045)` | input background |
| `--mri-rowhv` | `rgba(255,255,255,.03)` | row hover |

Label typography used across the app (for group headings): `font-mono uppercase tracking-[0.18em] text-mri-text2`.
**Must work in both dark (default) and `.light`** (`.light` values are in the same file).

## Target look

- **Surface:** panel on `--mri-raised` (or translucent `--mri-hdr` + `backdrop-blur-[14px]`), `border border-mri-border`, `shadow-[var(--mri-shadow)]`, radius ~14px.
- **Overlay:** soft, not harsh — e.g. `bg-black/50 backdrop-blur-sm`.
- **Size & position:** wider (~`max-w-[640px]`), sit **higher** (~15–18% from top, not centered), taller result area (~`max-h-[60vh]`), more generous internal padding.
- **Input row:** larger — ~16px font, ~14px vertical padding, search icon in `--mri-text2`, placeholder `--mri-text2`, bottom hairline `border-mri-border`.
- **Group headings:** the label style above (`font-mono … uppercase … text-mri-text2`).
- **Result rows:** taller (~44px), `text-mri-text`; hover `bg-mri-rowhv`; selected state a touch stronger (e.g. `bg-mri-inbg` + subtle left accent). Claim rows: MR number in `font-mono`, customer in `--mri-text2`, kind badge on the right.
- **Nice-to-have footer:** a thin keyboard-hint bar (↑↓ navigate · ↵ open · esc close) in `--mri-text2` — this alone kills the "pasted-on" feel.

## Constraints — DO NOT CHANGE (this is my logic)

- All behavior: the ⌘K keybinding + open/close, fuzzy nav filtering, debounced (300ms) claim search, permission-based nav filtering, kind-based routing, and the empty-state suppression during in-flight search. Keep every prop/handler.
- The `cmdk` structure (`Command` / `CommandInput` / `CommandList` / `CommandGroup` / `CommandItem`) stays.
- Keep it theme-aware (dark + light) and accessible (the `DialogTitle` stays `sr-only`, focus trap, esc-to-close).

## Files

- `apps/internal-web/src/features/command-palette/command-palette.tsx` — **primary restyle site.** Apply the `--mri-` styling here via `className` overrides, because `--mri-` tokens only resolve inside `internal-web`.
- `packages/ui/src/primitives/command.tsx` — the shared cmdk primitive. It is **app-neutral** — do NOT hardcode `--mri-` tokens here. If the dialog surface/sizing needs to change, either override via `className` from `command-palette.tsx`, or extend `CommandDialog`'s props (e.g. accept a `className`/width) so internal-web can style it without polluting the shared primitive.

## Handback

Return the restyled file(s); I integrate and run the full CI gate. Screenshots in **both** dark and light are appreciated. Do not touch anything outside the two files above.
