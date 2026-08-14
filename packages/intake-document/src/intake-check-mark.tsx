import type { ReactElement } from 'react'

/**
 * The yes / no / untouched mark, drawn rather than typed.
 *
 * It used to be the characters ✓ and ✗, and no font this document carries contains either of them:
 * U+2713 and U+2717 are outside every subset of Figtree and JetBrains Mono, so every machine drew
 * them from whatever it happened to have — Menlo on the operator's Mac, FreeSans or Unifont in the
 * container that makes the PDF. The marks came out, but never the same marks, on the one part of
 * this paper that says what was in the customer's car. Drawn here, they are the same everywhere:
 * the screen, the printer, and the file that goes out by email.
 *
 * The third state stays a character. An em dash is U+2014, which both families do carry, and it is
 * the one mark that must NOT read as an answer — an untouched row is a row nobody looked at, not a
 * "no" (docs/25 §4.4).
 *
 * Sized in `em` and coloured from `currentColor`, so the caller decides both by styling the element
 * it sits in — which is what lets one drawing serve a print sheet that styles inline and a screen
 * card that styles with classes.
 */
const UNANSWERED = '—'

/**
 * The width of the character this replaces: JetBrains Mono advances 0.6em, and the printed sheet has
 * about a pixel of slack in its four columns. Measured 2026-08-14 — at 1em the four written-in rows
 * wrapped onto a second line and the sheet came out 1126px against a fixed 1123.
 *
 * It is set HERE rather than by shrinking the element around the drawing, because the untouched
 * state is still a character and shrinking its box shrank the em dash into a hyphen.
 */
const MARK_SIZE = '0.62em'

/** Stroked, not filled: a filled glyph at 11.5px turns into a blot when the printer adds ink. */
const STROKE_WIDTH = 2.2

/**
 * The paths reach the edges of the 12x12 box, inset by exactly half the stroke so the round caps
 * land inside it rather than being clipped. That matters because the box is sized to the width of
 * the character this replaces — about 0.6em — and the ink of that character filled nearly all of it.
 * A drawing that used two thirds of its box came out visibly thinner and smaller than the mark the
 * paper used to carry.
 */

export function IntakeCheckMark({ value }: { value: boolean | null }): ReactElement {
  if (value === null) {
    return <>{UNANSWERED}</>
  }

  return (
    <svg
      viewBox="0 0 12 12"
      width={MARK_SIZE}
      height={MARK_SIZE}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      // `block` because an inline SVG sits on the text baseline of a line box taller than itself and
      // drops below the row it belongs to — the same trap the signature drawing carries a note about.
      style={{ display: 'block' }}
      // Hidden from assistive technology — the row's own label already says what it is — but named
      // for the tests, which used to read the glyph out of the text and now have nothing to read.
      aria-hidden="true"
      data-mark={value ? 'yes' : 'no'}
    >
      {value ? (
        <path d="M1.2 6.5 L4.4 9.9 L10.8 2.1" />
      ) : (
        <path d="M1.5 1.5 L10.5 10.5 M10.5 1.5 L1.5 10.5" />
      )}
    </svg>
  )
}
