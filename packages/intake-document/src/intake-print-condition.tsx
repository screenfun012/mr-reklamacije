import { m } from '@mr/i18n'
import type { CSSProperties, ReactElement } from 'react'

import type { IntakePrintModel } from './intake-print-data.js'
import {
  DOCUMENT_FONT_MONO,
  PRINT_BAND,
  PRINT_FIGURE,
  PRINT_FIGURE_LABEL,
  PRINT_HAIRLINE_TOP,
} from './intake-print-styles.js'

const CONDITION_STYLE = {
  empty: { marginTop: '9px', fontSize: '11.5px', color: '#54555b' },
  /**
   * `minmax(0, 1fr)` and not a bare `1fr`: a long written-in equipment name would otherwise widen
   * its column past a quarter of the page instead of wrapping inside it.
   *
   * The gaps are asymmetric on purpose — 20px between the columns, 6px between the rows — and the
   * two are written as separate properties rather than the `gap` shorthand, whose argument order is
   * row-then-column and reads backwards to everyone who has ever typed `gap: x y`.
   */
  grid: {
    marginTop: '9px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    columnGap: '20px',
    rowGap: '6px',
    fontSize: '11.5px',
  },
  row: { display: 'flex', gap: '8px' },
  mark: { fontFamily: DOCUMENT_FONT_MONO, fontWeight: 700 },
  note: { marginTop: '7px', fontSize: '11.5px', lineHeight: 1.5, color: '#54555b' },
  figures: {
    marginTop: '12px',
    display: 'flex',
    gap: '32px',
    ...PRINT_HAIRLINE_TOP,
    paddingTop: '11px',
  },
  remarksBlock: { flex: 1 },
  remarks: { marginTop: '2px', fontSize: '11.5px', lineHeight: 1.5 },
} satisfies Record<string, CSSProperties>

/** A "no" and an untouched row print their text grey; a "yes" prints it black. */
const MUTED_ROW: CSSProperties = { ...CONDITION_STYLE.row, color: '#54555b' }

const DEFECT_FIGURE: CSSProperties = { ...PRINT_FIGURE, color: '#ed1c24' }

/**
 * The recorded condition. The equipment rows — as many as the order recorded, in four columns — and a
 * row nobody touched prints `—`: collapsing the third state to ✕ puts a statement nobody made onto a
 * document the customer signs (`docs/25` §4.4).
 */
export function IntakePrintCondition({ model }: { model: IntakePrintModel }): ReactElement {
  const { locale } = model

  return (
    <section>
      <div style={PRINT_BAND}>{m.intake_print_section_condition({}, { locale })}</div>

      {/* A band with nothing under it is a heading over a void on a document the customer signs, so
          the absence is stated instead of hidden. Since 2026-08-12 an intake cannot be signed without
          recording SOMETHING, so this sentence is no longer a normal outcome: it is reachable only
          when the catalog was empty at the moment the order was taken, and it must not appear when a
          note is carrying the record instead — saying nothing was recorded over a written note calls
          the serviser a liar on the customer's own copy. */}
      {model.checklist.length === 0 && model.equipmentNote === null ? (
        <div style={CONDITION_STYLE.empty}>{m.intake_print_condition_empty({}, { locale })}</div>
      ) : (
        <div style={CONDITION_STYLE.grid}>
          {model.checklist.map((row) => (
            <div
              key={row.key}
              data-testid={`print-check-${row.key}`}
              style={row.muted ? MUTED_ROW : CONDITION_STYLE.row}
            >
              <span
                style={{ ...CONDITION_STYLE.mark, color: row.mark === '✗' ? '#ed1c24' : '#17171a' }}
              >
                {row.mark}
              </span>
              {row.label}
            </div>
          ))}
        </div>
      )}

      {/* Under the rows, because it is about the same equipment — and on the paper at all because a
          note alone can be the whole record of what was in the car. */}
      {model.equipmentNote === null ? null : (
        <div style={CONDITION_STYLE.note}>{model.equipmentNote}</div>
      )}

      <div style={CONDITION_STYLE.figures}>
        <div>
          <div style={PRINT_FIGURE_LABEL}>{m.intake_print_fuel({}, { locale })}</div>
          <div style={PRINT_FIGURE}>{model.fuelLevel}/8</div>
        </div>
        <div>
          <div style={PRINT_FIGURE_LABEL}>{m.intake_print_defects({}, { locale })}</div>
          <div style={DEFECT_FIGURE}>{model.damageCount}</div>
        </div>
        <div>
          <div style={PRINT_FIGURE_LABEL}>{m.intake_print_photos({}, { locale })}</div>
          <div style={PRINT_FIGURE}>{model.photoCount}</div>
        </div>
        <div style={CONDITION_STYLE.remarksBlock}>
          <div style={PRINT_FIGURE_LABEL}>{m.intake_print_remarks({}, { locale })}</div>
          <div style={CONDITION_STYLE.remarks}>{model.ownerRemarks}</div>
        </div>
      </div>
    </section>
  )
}
