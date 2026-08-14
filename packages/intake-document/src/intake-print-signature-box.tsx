import type { CSSProperties, ReactElement } from 'react'

import { SIGNATURE_VIEW_BOX } from './intake-signature-space.js'
import { DOCUMENT_FONT_MONO } from './intake-print-styles.js'

/**
 * One signature box, shared by both papers a vehicle collects here — the work order and the handover
 * record. It is its own file for the same reason the document is its own package: two drawings of the
 * same signature that drift are two documents that disagree about what a signature looks like, on the
 * two pieces of evidence this system exists to produce.
 */
const SIGNATURE_STYLE = {
  space: { height: '50px' },
  /**
   * Load-bearing. Inside a fixed 50px box an inline SVG would sit on the baseline of a line box
   * taller than the box itself, and the signature would drop off its own rule.
   */
  drawing: { display: 'block' },
  rule: { height: '1px', backgroundColor: '#17171a' },
  caption: { marginTop: '5px', display: 'flex', justifyContent: 'space-between' },
  role: {
    fontFamily: DOCUMENT_FONT_MONO,
    fontSize: '8.5px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    color: '#54555b',
  },
  name: { fontSize: '11px', fontWeight: 700 },
} satisfies Record<string, CSSProperties>

export function IntakePrintSignatureBox({
  path,
  role,
  name,
}: {
  path: string | null
  role: string
  /**
   * Null prints the rule and the role alone. That is not a placeholder: the handover is signed by
   * whoever is standing there, and until the wire carries that person's name the paper must not put
   * somebody else's under his signature.
   */
  name: string | null
}): ReactElement {
  return (
    <div>
      <div style={SIGNATURE_STYLE.space} data-testid="print-signature">
        {path === null ? null : (
          <svg
            viewBox={SIGNATURE_VIEW_BOX}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMax meet"
            style={SIGNATURE_STYLE.drawing}
          >
            <path d={path} stroke="#17171a" strokeWidth={4} fill="none" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div style={SIGNATURE_STYLE.rule} />
      <div style={SIGNATURE_STYLE.caption}>
        <span style={SIGNATURE_STYLE.role}>{role}</span>
        {name === null ? null : <span style={SIGNATURE_STYLE.name}>{name}</span>}
      </div>
    </div>
  )
}
