import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

import { inlineFontStylesheet } from '../../core/pdf/inline-font-stylesheet.js'

/**
 * Everything the printed work order needs that is not text: the two font families and the emblem,
 * inlined as `data:` URIs. Why the stylesheets are taken from fontsource whole is in
 * `inlineFontStylesheet`; it is the same reason the claim report now takes them that way too.
 */
const FONT_STYLESHEETS: readonly string[] = [
  '@fontsource-variable/figtree/index.css',
  ...['400', '500', '600', '700'].map((weight) => `@fontsource/jetbrains-mono/${weight}.css`),
]

/**
 * The emblem comes from the package that owns the document, not from any application's `public/`
 * directory: the API has no such directory, and `tsc` would not carry an image into `dist` if it
 * did. Resolved through the package's export entry, the same way the fonts are resolved out of
 * theirs.
 */
const EMBLEM_SPECIFIER = '@mr/intake-document/assets/logo-emblem-white.png'

const require = createRequire(import.meta.url)

export interface IntakeDocumentAssets {
  readonly fontFaceCss: string
  readonly emblemDataUri: string
}

/**
 * Read once per process: ~280 KB of base64 that never changes, on the one path a worker is standing
 * still waiting for.
 */
let cached: Promise<IntakeDocumentAssets> | null = null

export function loadIntakeDocumentAssets(): Promise<IntakeDocumentAssets> {
  cached ??= (async () => {
    const [stylesheets, emblem] = await Promise.all([
      Promise.all(FONT_STYLESHEETS.map(inlineFontStylesheet)),
      readFile(require.resolve(EMBLEM_SPECIFIER)),
    ])

    return {
      fontFaceCss: stylesheets.join('\n'),
      emblemDataUri: `data:image/png;base64,${emblem.toString('base64')}`,
    }
  })()

  return cached
}
