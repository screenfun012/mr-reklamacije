import type { CSSProperties } from 'react'

/**
 * The printed sheet is the ONE place in this system where literal hex is correct. It is white paper
 * with no dark mode, so the theme-dependent `mri-*` tokens would print whatever theme the operator
 * happened to be sitting in. Everywhere else CLAUDE.md §5 still applies.
 *
 * The solid red band replaces the prototype's thin red eyebrow: Nikola's decision (2026-08-10) is
 * that this paper must look like the other forms the customer already gets ("Obaveze kupca"),
 * which carry solid black and red bands.
 *
 * INLINE STYLES, NOT CLASSES (2026-08-13). A utility class only exists where a Tailwind build ran,
 * and this document is now rendered by the API as well — where no such build exists and the class
 * names would be inert strings. The values were already literals (`#17171a`, `11.5px`, `794px`), so
 * this is a rename rather than a redesign, and it is what finally makes the monospace font REAL
 * outside internal-web: `font-mono` resolved through that app's `--font-mono`, and anywhere else it
 * silently fell back to whatever the consumer happened to have.
 */

/**
 * Named here rather than inherited. The sheet used to take both families from internal-web's
 * `<html>`; the API's wrapper has no such ancestor, so the document states them and whoever renders
 * it embeds the font files under exactly these names — which is why they are exported.
 */
export const DOCUMENT_FONT_SANS = "'Figtree Variable', ui-sans-serif, system-ui, sans-serif"
export const DOCUMENT_FONT_MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace"

/**
 * The band that titles a section, edge to edge.
 *
 * `fontWeight: 800` against a family that ships no 800 monospace face is deliberate — the browser
 * synthesises it, and that synthesised weight is what the paper has looked like since 2026-08-10.
 */
export const PRINT_BAND: CSSProperties = {
  backgroundColor: '#ed1c24',
  paddingLeft: '11px',
  paddingRight: '11px',
  paddingTop: '5px',
  paddingBottom: '5px',
  fontFamily: DOCUMENT_FONT_MONO,
  fontSize: '10px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: '#fff',
}

/** The small red caption above a block that carries no band of its own. */
export const PRINT_EYEBROW: CSSProperties = {
  fontFamily: DOCUMENT_FONT_MONO,
  fontSize: '8.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.2em',
  color: '#ed1c24',
}

export const PRINT_FIGURE_LABEL: CSSProperties = {
  fontFamily: DOCUMENT_FONT_MONO,
  fontSize: '8.5px',
  letterSpacing: '0.16em',
  color: '#54555b',
}

export const PRINT_FIGURE: CSSProperties = {
  fontFamily: DOCUMENT_FONT_MONO,
  fontSize: '19px',
  fontWeight: 700,
}

export const PRINT_RULE: CSSProperties = { height: '1px', backgroundColor: '#e6e7e9' }

/**
 * The grey hairlines — above the figures row, and under every defect row.
 *
 * The STYLE is spelled out beside the width, and that is not belt-and-braces: `border-style` starts
 * at `none`, and a border with no style has no width whatever the width says. Tailwind's `border-t`
 * only ever looked solid because it read a variable registered with `initial-value: solid`. Written
 * by hand, dropping the style would quietly delete three rules from the paper and nothing anywhere
 * would report it.
 *
 * The colour is set on all four sides, as the class it replaces did: only one side has a width, so
 * only one side draws — and the other three can then never inherit a colour from a host application.
 */
export const PRINT_HAIRLINE_TOP: CSSProperties = {
  borderColor: '#e6e7e9',
  borderTopStyle: 'solid',
  borderTopWidth: '1px',
}

export const PRINT_HAIRLINE_BOTTOM: CSSProperties = {
  borderColor: '#e6e7e9',
  borderBottomStyle: 'solid',
  borderBottomWidth: '1px',
}
