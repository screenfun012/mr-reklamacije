import { m } from '@mr/i18n'
import type { CSSProperties, ReactElement } from 'react'

import { INTAKE_SILHOUETTE_VIEWBOX } from './intake-silhouettes.js'
import type { IntakePrintModel } from './intake-print-data.js'
import {
  DOCUMENT_FONT_MONO,
  PRINT_BAND,
  PRINT_EYEBROW,
  PRINT_HAIRLINE_BOTTOM,
} from './intake-print-styles.js'

/** Past this many the list flows in two columns — see the comment at the list itself. */
const DEFECTS_PER_COLUMN = 6

/** The written-in list is capped at three, so it needs its own, lower threshold (see below). */
const OTHER_DEFECTS_PER_COLUMN = 2

const DAMAGES_STYLE = {
  /**
   * The drawing and the list beside it. A BARE `1fr` here, deliberately — unlike the page's other
   * grids, whose columns hold typed-in strings and need a `minmax(0, …)` floor to wrap them.
   */
  layout: { marginTop: '9px', display: 'grid', gridTemplateColumns: '186px 1fr', gap: '28px' },
  /** `color` is what every `currentColor` in the silhouette paths resolves to. */
  silhouette: { display: 'block', color: '#17171a' },
  lists: { display: 'flex', flexDirection: 'column', gap: '14px' },

  /**
   * The two-column flow, applied only once a list is long enough to need it.
   *
   * The gutter is stated because a multi-column box that is not told one falls back to `normal`,
   * which is 1em — 12px at the rows inside — and the list would silently reflow against a page whose
   * fit was measured at 18px.
   *
   * Only the COLUMN gap. The class this replaced was a `gap` shorthand and set `row-gap: 18px` here
   * too; a multi-column container has no rows to space, and the before/after capture confirms it —
   * that property is the one value on the whole sheet that changed, and not a pixel moved with it.
   */
  columns: { columnCount: 2, columnGap: '18px' },

  damageRow: {
    display: 'flex',
    breakInside: 'avoid',
    gap: '12px',
    ...PRINT_HAIRLINE_BOTTOM,
    paddingTop: '5px',
    paddingBottom: '5px',
    fontSize: '12px',
  },
  damageNumber: { width: '16px', fontFamily: DOCUMENT_FONT_MONO, fontWeight: 700 },
  damageType: { flex: 1 },
  damageZone: { color: '#54555b' },
  /** `margin: 0` because a paragraph carries one by default and this page budgets every pixel. */
  noDamage: { margin: 0, fontSize: '11.5px', fontStyle: 'italic', color: '#54555b' },

  otherBlock: { marginTop: '7px' },
  otherHeading: {
    fontFamily: DOCUMENT_FONT_MONO,
    fontSize: '9px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#54555b',
  },
  /**
   * `overflow: hidden` makes the row monolithic in a multi-column flow, and `overflow-wrap` breaks
   * only the words that would otherwise run past the column — never every word, which is what
   * `word-break` would do to ordinary Serbian.
   */
  otherRow: {
    breakInside: 'avoid',
    overflow: 'hidden',
    ...PRINT_HAIRLINE_BOTTOM,
    paddingTop: '5px',
    paddingBottom: '5px',
    fontSize: '12px',
    overflowWrap: 'break-word',
  },
  overflowNote: { margin: 0, marginTop: '5px', fontSize: '9.5px', color: '#54555b' },

  workGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '22px',
  },
  workRow: { fontSize: '12px', lineHeight: 1.8 },
} satisfies Record<string, CSSProperties>

/**
 * The drawing and what it means. Every marker prints solid red with a white digit, whatever the
 * defect type: the screen's amber and grey do not survive a printer, and a marker nobody can see
 * is a defect the customer never agreed to.
 */
export function IntakePrintDamages({ model }: { model: IntakePrintModel }): ReactElement {
  const { locale } = model

  return (
    <section>
      <div style={PRINT_BAND}>{m.intake_print_section_scheme({}, { locale })}</div>

      <div style={DAMAGES_STYLE.layout}>
        <svg
          data-testid="print-silhouette"
          width={146}
          height={238}
          viewBox={INTAKE_SILHOUETTE_VIEWBOX}
          fill="none"
          preserveAspectRatio="xMidYMid meet"
          style={DAMAGES_STYLE.silhouette}
        >
          {model.silhouette.map((path, index) => (
            <path
              key={index}
              d={path.d}
              fill="currentColor"
              fillOpacity={path.op === '0' ? '0' : '.05'}
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {model.markers.map((marker) => (
            <g
              key={marker.number}
              data-testid={`print-marker-${marker.number}`}
              fontFamily="JetBrains Mono, monospace"
              fontSize={15}
              fontWeight={700}
              textAnchor="middle"
            >
              <circle cx={marker.x} cy={marker.y} r={17} fill="#ed1c24" />
              <text x={marker.x} y={marker.textY} fill="#fff">
                {marker.number}
              </text>
            </g>
          ))}
        </svg>

        <div style={DAMAGES_STYLE.lists}>
          <div>
            <div style={PRINT_EYEBROW}>{m.intake_print_section_defects({}, { locale })}</div>
            {/*
              Two columns once the list is long. Measured 2026-08-10 in the browser: a defect row
              is 30px, and twelve of them in a single column push the sheet to 1247px against a
              fixed 1123 — the page overflows by 124px and the footer with both signatures walks
              onto a second sheet. Two columns fit the same twelve.
              The alternative was cutting the cap to the seven that fit, and defects are the one
              thing on this paper that must not be silently left off it.
            */}
            <div
              style={model.damages.length > DEFECTS_PER_COLUMN ? DAMAGES_STYLE.columns : undefined}
            >
              {model.damages.map((damage) => (
                <div
                  key={damage.id}
                  data-testid={`print-damage-${damage.number}`}
                  style={DAMAGES_STYLE.damageRow}
                >
                  <span style={DAMAGES_STYLE.damageNumber}>{damage.number}</span>
                  <span style={DAMAGES_STYLE.damageType}>{damage.type}</span>
                  <span style={DAMAGES_STYLE.damageZone}>{damage.zone}</span>
                </div>
              ))}
            </div>
            {model.damages.length === 0 && model.otherDamages.length === 0 ? (
              <p style={DAMAGES_STYLE.noDamage}>{m.intake_print_no_damage({}, { locale })}</p>
            ) : null}

            {/* Wheels, interior, exhaust — nothing the silhouette can show. No number, because a
                number on this paper points at the drawing. */}
            {model.otherDamages.length === 0 ? null : (
              <div style={DAMAGES_STYLE.otherBlock}>
                <div style={DAMAGES_STYLE.otherHeading}>
                  {m.intake_print_section_other_damages({}, { locale })}
                </div>
                {/* Two columns from the third row on — NOT the markers' threshold of six, because
                    this list is capped at three and would never reach it. Measured: three rows at
                    the schema's 200-character ceiling need 1154 px in one column against the A4
                    box's 1123, and fit in two. `break-inside: avoid` keeps a wrapped row whole. */}
                <div
                  style={
                    model.otherDamages.length > OTHER_DEFECTS_PER_COLUMN
                      ? DAMAGES_STYLE.columns
                      : undefined
                  }
                >
                  {model.otherDamages.map((text, index) => (
                    <div key={`${text}-${index}`} style={DAMAGES_STYLE.otherRow}>
                      {text}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {model.damagesOverflow > 0 ? (
              <p style={DAMAGES_STYLE.overflowNote}>
                {m.intake_print_damages_more(
                  { count: model.damagesOverflow, number: model.orderNumber },
                  { locale },
                )}
              </p>
            ) : null}
          </div>

          <div style={DAMAGES_STYLE.workGrid}>
            <div>
              <div style={PRINT_EYEBROW}>{m.intake_print_section_services({}, { locale })}</div>
              {model.services.map((service) => (
                <div key={service} style={DAMAGES_STYLE.workRow}>
                  {service}
                </div>
              ))}
            </div>
            <div>
              <div style={PRINT_EYEBROW}>{m.intake_print_section_materials({}, { locale })}</div>
              {model.materials.map((material) => (
                <div key={material} style={DAMAGES_STYLE.workRow}>
                  {material}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
