import { m } from '@mr/i18n'
import type { IntakeChecklistItemListItem, IntakeOrderDetail } from '@mr/shared'
import { memo, type CSSProperties, type ReactElement } from 'react'

import { SIGNATURE_VIEW_BOX } from './intake-signature-space.js'
import { IntakePrintCondition } from './intake-print-condition.js'
import { IntakePrintDamages } from './intake-print-damages.js'
import {
  buildIntakePrintModel,
  type IntakePrintLocale,
  type IntakePrintModel,
} from './intake-print-data.js'
import {
  DOCUMENT_FONT_MONO,
  DOCUMENT_FONT_SANS,
  PRINT_EYEBROW,
  PRINT_RULE,
} from './intake-print-styles.js'

/** What the preview's stylesheet targets; every caller but the multi-language document keeps it. */
const DEFAULT_SHEET_ID = 'intake-print-sheet'

const SHEET_STYLE = {
  /**
   * A4 at 96dpi. A FIXED height, never `min-height`: the page must not be allowed to grow into a
   * second one — when the content is too tall it is the rules in `intake-print-data.ts` that give,
   * not the paper.
   *
   * The font, the size and the line height are declared here rather than inherited, and that is the
   * whole point of this document being a package: it used to take all three from internal-web's
   * `<html>` and `body`, which the API does not have. `lineHeight: 1.6` in particular is the number
   * every unlabelled block on this page is measured against — the defect rows were counted at 30px
   * each against a hard 1123px ceiling, and 1.5 instead of 1.6 moves every one of them.
   *
   * `print-color-adjust: exact` is not decoration — without it the printer drops the red bands and
   * the defect markers, and the sheet loses the two things a reader navigates by.
   */
  page: {
    display: 'flex',
    height: '1123px',
    width: '794px',
    flex: 'none',
    flexDirection: 'column',
    backgroundColor: '#fff',
    color: '#17171a',
    fontFamily: DOCUMENT_FONT_SANS,
    fontSize: '16px',
    lineHeight: 1.6,
    /**
     * Inherited until now — and from a place nobody would look. All three come from the vendored
     * Tiptap `_variables.scss` internal-web imports, the same file that once put
     * `transition-property: none` on every element in the app (CLAUDE.md §5). Accidental or not, it
     * is what this paper has looked like, and `overflow-wrap` is not cosmetic: without it an
     * unbroken 40-character owner name runs out of its column instead of wrapping inside it. The
     * server renders with no Tiptap and no app, so the document has to say them itself.
     */
    overflowWrap: 'break-word',
    textRendering: 'optimizeLegibility',
    WebkitFontSmoothing: 'antialiased',
    printColorAdjust: 'exact',
    WebkitPrintColorAdjust: 'exact',
  },

  /** The black band, edge to edge, as "Obaveze kupca" carries it. */
  header: {
    display: 'flex',
    flex: 'none',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: '#17171a',
    paddingLeft: '54px',
    paddingRight: '54px',
    paddingTop: '18px',
    paddingBottom: '18px',
    color: '#fff',
  },
  /**
   * `display: block` is stated because an image is inline by default, and the browsers this renders
   * in only agree that it is a block because a CSS reset told them so. This document carries its
   * own.
   */
  emblem: { display: 'block', height: '46px', width: 'auto' },
  headerTitleBlock: { marginLeft: '8px' },
  headerTitle: {
    fontSize: '22px',
    fontWeight: 900,
    textTransform: 'uppercase',
    lineHeight: 1,
    letterSpacing: '-0.02em',
  },
  headerSubtitle: { marginTop: '4px', fontSize: '10.5px', color: '#b9babd' },
  headerNumberBlock: { marginLeft: 'auto', textAlign: 'right' },
  headerNumber: { fontFamily: DOCUMENT_FONT_MONO, fontSize: '20px', fontWeight: 700 },
  headerReceivedAt: {
    fontFamily: DOCUMENT_FONT_MONO,
    fontSize: '9.5px',
    letterSpacing: '0.08em',
    color: '#b9babd',
  },

  /**
   * `flex: 1` with `min-height: 0` rather than a calc against the band's height: the band is
   * content-sized, and a hard-coded number here would silently push the footer off the page the day
   * its padding changes.
   */
  body: {
    display: 'flex',
    minHeight: 0,
    flex: 1,
    flexDirection: 'column',
    gap: '16px',
    paddingLeft: '54px',
    paddingRight: '54px',
    paddingBottom: '50px',
    paddingTop: '18px',
  },

  /**
   * `minmax(0, 1fr)` and not a bare `1fr`: a bare one has a min-content floor, so a long VIN or an
   * unbroken plate would push its column past half the page instead of wrapping.
   */
  basicsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '34px',
  },
  basicsHeadline: { marginTop: '7px', fontSize: '15px', fontWeight: 800 },
  basicsIdRow: { marginTop: '3px', fontSize: '11.5px', color: '#54555b' },
  basicsIdLabel: { fontFamily: DOCUMENT_FONT_MONO, fontWeight: 600, textTransform: 'uppercase' },
  basicsDetails: {
    marginTop: '3px',
    fontSize: '11.5px',
    lineHeight: 1.6,
    color: '#54555b',
  },
  mono: { fontFamily: DOCUMENT_FONT_MONO },

  /** Pinned to the bottom whatever the blocks above did. */
  footer: {
    marginTop: 'auto',
    borderColor: '#ed1c24',
    borderTopStyle: 'solid',
    borderTopWidth: '2.5px',
    paddingTop: '14px',
  },
  footerLegal: {
    marginBottom: '14px',
    maxWidth: '600px',
    fontSize: '9.5px',
    lineHeight: 1.5,
    color: '#54555b',
  },
  signatures: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '40px',
  },

  signatureSpace: { height: '50px' },
  /**
   * Load-bearing. Inside a fixed 50px box an inline SVG would sit on the baseline of a line box
   * taller than the box itself, and the signature would drop off its own rule.
   */
  signatureDrawing: { display: 'block' },
  signatureRule: { height: '1px', backgroundColor: '#17171a' },
  signatureCaption: { marginTop: '5px', display: 'flex', justifyContent: 'space-between' },
  signatureRole: {
    fontFamily: DOCUMENT_FONT_MONO,
    fontSize: '8.5px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    color: '#54555b',
  },
  signatureName: { fontSize: '11px', fontWeight: 700 },
} satisfies Record<string, CSSProperties>

function SignatureBox({
  path,
  role,
  name,
}: {
  path: string | null
  role: string
  name: string
}): ReactElement {
  return (
    <div>
      <div style={SHEET_STYLE.signatureSpace} data-testid="print-signature">
        {path === null ? null : (
          <svg
            viewBox={SIGNATURE_VIEW_BOX}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMax meet"
            style={SHEET_STYLE.signatureDrawing}
          >
            <path d={path} stroke="#17171a" strokeWidth={4} fill="none" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div style={SHEET_STYLE.signatureRule} />
      <div style={SHEET_STYLE.signatureCaption}>
        <span style={SHEET_STYLE.signatureRole}>{role}</span>
        <span style={SHEET_STYLE.signatureName}>{name}</span>
      </div>
    </div>
  )
}

/**
 * The printed work order. Rendered from the order's data, never from the screen's components: the
 * paper has its own typographic scale, a white background and no theme.
 *
 * Memoised because a pinch re-renders the dialog around it on every pointer move: none of these three
 * props change while fingers are on the glass, and rebuilding the whole print model sixty times a
 * second is the difference between a gesture that tracks and one that stutters on the shop's oldest
 * iPad. The zoom itself is one custom property on the box outside — it needs no re-render at all.
 */
export const IntakePrintSheet = memo(function IntakePrintSheet({
  order,
  checklistItems,
  locale,
  logoSrc,
  id = DEFAULT_SHEET_ID,
}: {
  order: IntakeOrderDetail
  /**
   * Handed in rather than fetched here: the sheet is a pure render of paper, and the names it needs
   * come from the DISPLAY read of the catalog so a retired item keeps its name (plan D3).
   */
  checklistItems: readonly IntakeChecklistItemListItem[]
  /** Chosen in the preview, never read from the app: the paper speaks the customer's language. */
  locale: IntakePrintLocale
  /**
   * Where the emblem comes from — the same contract as the fonts, and required for the same reason.
   * A browser wants a URL its own server answers; the API has no server to ask and hands over the
   * bytes as a `data:` URI. A default here would be one of those two, and would print a broken
   * image for the other with nothing to say why.
   */
  logoSrc: string
  /**
   * The element's id, which the preview's stylesheet and its pinch-zoom both target by name. It is
   * a prop only because one document can hold more than one sheet — the sealed PDF carries the same
   * order in both languages — and two elements may not share an id.
   */
  id?: string
}): ReactElement {
  const model: IntakePrintModel = buildIntakePrintModel(order, checklistItems, locale)

  return (
    <div id={id} style={SHEET_STYLE.page}>
      <header style={SHEET_STYLE.header}>
        {/* The full emblem — red MR, white script, white "MADE IN SERBIA" ring — because that is
            what the black band on "Obaveze kupca" carries. The plain wordmark is the app's own
            chrome and reads as a different mark beside it. */}
        <img src={logoSrc} alt="MR Engines" style={SHEET_STYLE.emblem} />
        <div style={SHEET_STYLE.headerTitleBlock}>
          <div style={SHEET_STYLE.headerTitle}>{m.intake_print_title({}, { locale })}</div>
          <div style={SHEET_STYLE.headerSubtitle}>{m.intake_print_subtitle({}, { locale })}</div>
        </div>
        <div style={SHEET_STYLE.headerNumberBlock}>
          <div style={SHEET_STYLE.headerNumber}>{model.orderNumber}</div>
          <div style={SHEET_STYLE.headerReceivedAt}>{model.receivedAt}</div>
        </div>
      </header>

      <div style={SHEET_STYLE.body}>
        <div style={SHEET_STYLE.basicsGrid}>
          <div>
            <div style={PRINT_EYEBROW}>{m.intake_print_section_owner({}, { locale })}</div>
            <div style={SHEET_STYLE.basicsHeadline}>{model.ownerName}</div>
            {/* Under the name and above the address: it identifies the person, not the place. Left
                off entirely when there is none — a firm's number is optional and every order taken
                before 2026-08-12 has none. */}
            {model.ownerIdNumber === null ? null : (
              <div style={SHEET_STYLE.basicsIdRow}>
                <span style={SHEET_STYLE.basicsIdLabel}>{model.ownerIdLabel}</span>{' '}
                <span style={SHEET_STYLE.mono}>{model.ownerIdNumber}</span>
              </div>
            )}
            <div style={SHEET_STYLE.basicsDetails}>
              {model.ownerAddress}
              <br />
              <span style={SHEET_STYLE.mono}>{model.ownerPhone}</span>
            </div>
          </div>
          <div>
            <div style={PRINT_EYEBROW}>
              {m.intake_print_section_vehicle({ type: model.vehicleTypeLabel }, { locale })}
            </div>
            <div style={SHEET_STYLE.basicsHeadline}>
              {model.vehicle} · <span style={SHEET_STYLE.mono}>{model.plate}</span>
            </div>
            <div style={SHEET_STYLE.basicsDetails}>
              <span style={SHEET_STYLE.mono}>{model.vin}</span>
              <br />
              <span style={SHEET_STYLE.mono}>{model.mileage}</span> · {model.arrivalMode}
            </div>
          </div>
        </div>

        <div style={PRINT_RULE} />

        <IntakePrintCondition model={model} />

        <IntakePrintDamages model={model} />

        <footer style={SHEET_STYLE.footer}>
          <div style={SHEET_STYLE.footerLegal}>
            {m.intake_print_legal(
              { count: model.photoCount, number: model.orderNumber },
              { locale },
            )}
          </div>

          <div style={SHEET_STYLE.signatures}>
            <SignatureBox
              path={model.technicianSignature}
              role={m.intake_print_role_technician({}, { locale })}
              name={model.technicianName}
            />
            <SignatureBox
              path={model.ownerSignature}
              role={m.intake_print_role_owner({}, { locale })}
              name={model.ownerName}
            />
          </div>
        </footer>
      </div>
    </div>
  )
})
