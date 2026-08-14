import { m } from '@mr/i18n'
import type { IntakeChecklistItemListItem, IntakeOrderDetail } from '@mr/shared'
import { memo, type CSSProperties, type ReactElement } from 'react'

import { IntakePrintBasics } from './intake-print-basics.js'
import { IntakePrintCondition } from './intake-print-condition.js'
import { IntakePrintDamages } from './intake-print-damages.js'
import { IntakePrintHeader } from './intake-print-header.js'
import { IntakePrintSignatureBox } from './intake-print-signature-box.js'
import {
  buildIntakePrintModel,
  PRINT_MAX_REMARKS,
  type IntakePrintLocale,
  type IntakePrintModel,
} from './intake-print-data.js'
import { DOCUMENT_FONT_SANS, PRINT_RULE } from './intake-print-styles.js'

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
} satisfies Record<string, CSSProperties>

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
  // `PRINT_MAX_REMARKS` stated rather than defaulted: this sheet keeps the cut because it is still
  // one A4 page by rule, and its sibling does not. That difference should be visible at both sites.
  const model: IntakePrintModel = buildIntakePrintModel(
    order,
    checklistItems,
    locale,
    PRINT_MAX_REMARKS,
  )

  return (
    <div id={id} style={SHEET_STYLE.page}>
      <IntakePrintHeader
        logoSrc={logoSrc}
        title={m.intake_print_title({}, { locale })}
        subtitle={m.intake_print_subtitle({}, { locale })}
        number={model.orderNumber}
        timestamp={model.receivedAt}
      />

      <div style={SHEET_STYLE.body}>
        <IntakePrintBasics model={model} />

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
            <IntakePrintSignatureBox
              path={model.technicianSignature}
              role={m.intake_print_role_technician({}, { locale })}
              name={model.technicianName}
            />
            <IntakePrintSignatureBox
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
