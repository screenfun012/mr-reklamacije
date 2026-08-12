/**
 * The coordinate space a signature is captured in and printed from.
 *
 * The signature is stored as an SVG path in this space, so it stays sharp on A4 (docs/25 §4.1).
 * Never a raster: a JPEG of a signature is both heavier and worse on paper.
 *
 * It lives here because BOTH ends need it and they are now in different places — the pad that
 * captures the strokes is a screen in internal-web, and the sheet that draws them is rendered by the
 * API as well. One definition, or a pad and a document could disagree about what the numbers mean
 * and every signature would print stretched.
 */
export const SIGNATURE_PAD_WIDTH = 460
export const SIGNATURE_PAD_HEIGHT = 200
export const SIGNATURE_VIEW_BOX = `0 0 ${SIGNATURE_PAD_WIDTH} ${SIGNATURE_PAD_HEIGHT}`
