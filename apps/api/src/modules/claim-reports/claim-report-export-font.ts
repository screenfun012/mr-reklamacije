import { inlineFontStylesheet } from '../../core/pdf/inline-font-stylesheet.js'

/**
 * Fontsource's own stylesheet, taken whole — see `inlineFontStylesheet` for why a hand-written
 * `@font-face` is what put `č ć ž š đ` in a different typeface here for as long as this export has
 * existed. The family it declares is `Figtree Variable`, which is what
 * `CLAIM_REPORT_EXPORT_FONT_FAMILY` therefore has to ask for.
 */
const FONT_STYLESHEET = '@fontsource-variable/figtree/index.css'

/** Read once per process: the bytes never change, and an operator is waiting for the document. */
let cached: Promise<string> | null = null

export function getClaimReportExportFontFaceCss(): Promise<string> {
  cached ??= inlineFontStylesheet(FONT_STYLESHEET)
  return cached
}
