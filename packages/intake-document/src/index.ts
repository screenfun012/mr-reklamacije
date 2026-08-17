/**
 * The intake work order as a DOCUMENT — one definition, rendered by two runtimes.
 *
 * `apps/internal-web` renders it in the browser for the preview and for `window.print()`; the API
 * renders the same tree with `react-dom/server` and hands the markup to headless Chromium to make
 * the PDF that is stored and emailed. That is the whole reason this package exists: screen, printer
 * and email do not share a rendering contract, so a second description of the same paper would drift
 * — on the one document in this system that is evidence.
 *
 * The domain data below travels WITH the document rather than staying in the app, because the
 * document draws it: the silhouettes it prints markers on, the labels it names things with, the
 * checklist rows it resolves. A second copy for the screens is exactly the drift this package exists
 * to prevent.
 *
 * What deliberately did NOT come along is the preview: the dialog, the zoom, the fit-to-width
 * measurement and `intake-print.css` are equipment AROUND the document and stay in internal-web.
 */
export { IntakeCheckMark } from './intake-check-mark.js'
export { IntakePrintSheet } from './intake-print-sheet.js'
export { IntakePrintCondition } from './intake-print-condition.js'
export { IntakePrintDamages } from './intake-print-damages.js'
/**
 * Document 2 — the handover record. A sibling of the work order, not a taller copy of it: it
 * paginates, so it ships its own `@page` rule for whoever wraps it into a document.
 */
export { IntakeHandoverSheet } from './intake-handover-sheet.js'
export { INTAKE_HANDOVER_PAGE_CSS } from './intake-handover-styles.js'
export {
  buildIntakePrintModel,
  PRINT_MAX_DAMAGES,
  PRINT_MAX_LIST_ITEMS,
  PRINT_MAX_OTHER_DAMAGES,
  PRINT_MAX_REMARKS,
  type IntakePrintChecklistRow,
  type IntakePrintDamageRow,
  type IntakePrintLocale,
  type IntakePrintModel,
} from './intake-print-data.js'
/**
 * The two families the document names on itself, so whoever renders it can embed the font files
 * under exactly those names. The block styles behind them stay internal — they are how this
 * document draws, not something a caller composes with.
 */
export { DOCUMENT_FONT_MONO, DOCUMENT_FONT_SANS } from './intake-print-styles.js'
export {
  INTAKE_SILHOUETTES,
  INTAKE_SILHOUETTE_VIEWBOX,
  type IntakeSilhouettePath,
} from './intake-silhouettes.js'
export {
  INTAKE_ARRIVAL_MODE_LABELS,
  INTAKE_DAMAGE_TYPE_LABELS,
  INTAKE_OWNER_TYPE_LABELS,
  INTAKE_VEHICLE_TYPE_LABELS,
} from './intake-labels.js'
export {
  intakeChecklistItemName,
  resolveIntakeChecklistRows,
  untouchedIntakeChecklist,
  type IntakeChecklistByCode,
  type IntakeChecklistRow,
} from './intake-checklist-catalog.js'
export {
  SIGNATURE_PAD_HEIGHT,
  SIGNATURE_PAD_WIDTH,
  SIGNATURE_VIEW_BOX,
} from './intake-signature-space.js'
export {
  INTAKE_SHOP_TIME_ZONE,
  formatIntakeDateOnly,
  formatIntakeHistoryAt,
  formatIntakeReceivedAt,
  formatIntakeReceivedAtLong,
  intakeIntlLocale,
} from './intake-document-locale.js'
