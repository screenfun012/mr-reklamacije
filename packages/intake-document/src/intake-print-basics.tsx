import { m } from '@mr/i18n'
import type { CSSProperties, ReactElement } from 'react'

import type { IntakePrintModel } from './intake-print-data.js'
import { DOCUMENT_FONT_MONO, PRINT_EYEBROW } from './intake-print-styles.js'

const BASICS_STYLE = {
  /**
   * `minmax(0, 1fr)` and not a bare `1fr`: a bare one has a min-content floor, so a long VIN or an
   * unbroken plate would push its column past half the page instead of wrapping.
   */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '34px',
  },
  headline: { marginTop: '7px', fontSize: '15px', fontWeight: 800 },
  idRow: { marginTop: '3px', fontSize: '11.5px', color: '#54555b' },
  idLabel: { fontFamily: DOCUMENT_FONT_MONO, fontWeight: 600, textTransform: 'uppercase' },
  details: {
    marginTop: '3px',
    fontSize: '11.5px',
    lineHeight: 1.6,
    color: '#54555b',
  },
  mono: { fontFamily: DOCUMENT_FONT_MONO },
} satisfies Record<string, CSSProperties>

/**
 * Who the owner is and which vehicle this is about. Extracted from the work order when the handover
 * record was written: both papers name the same two parties, and a customer who compares them must
 * find the same VIN, the same plate and the same identifier under the same captions.
 */
export function IntakePrintBasics({ model }: { model: IntakePrintModel }): ReactElement {
  const { locale } = model

  return (
    <div style={BASICS_STYLE.grid}>
      <div>
        <div style={PRINT_EYEBROW}>{m.intake_print_section_owner({}, { locale })}</div>
        <div style={BASICS_STYLE.headline}>{model.ownerName}</div>
        {/* Under the name and above the address: it identifies the person, not the place. Left
            off entirely when there is none — a firm's number is optional and every order taken
            before 2026-08-12 has none. */}
        {model.ownerIdNumber === null ? null : (
          <div style={BASICS_STYLE.idRow}>
            <span style={BASICS_STYLE.idLabel}>{model.ownerIdLabel}</span>{' '}
            <span style={BASICS_STYLE.mono}>{model.ownerIdNumber}</span>
          </div>
        )}
        <div style={BASICS_STYLE.details}>
          {model.ownerAddress}
          <br />
          <span style={BASICS_STYLE.mono}>{model.ownerPhone}</span>
        </div>
      </div>
      <div>
        <div style={PRINT_EYEBROW}>
          {m.intake_print_section_vehicle({ type: model.vehicleTypeLabel }, { locale })}
        </div>
        <div style={BASICS_STYLE.headline}>
          {model.vehicle} · <span style={BASICS_STYLE.mono}>{model.plate}</span>
        </div>
        <div style={BASICS_STYLE.details}>
          <span style={BASICS_STYLE.mono}>{model.vin}</span>
          <br />
          <span style={BASICS_STYLE.mono}>{model.mileage}</span> · {model.arrivalMode}
        </div>
      </div>
    </div>
  )
}
