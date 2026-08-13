import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

/**
 * Everything the printed work order needs that is not text: the two font families and the emblem,
 * inlined as `data:` URIs.
 *
 * Inlined rather than linked because headless Chromium fetches nothing while it renders a page it
 * was handed as a string — there is no server behind it and no base URL to resolve against — and it
 * fails at that silently, printing a fallback font and an empty image frame.
 *
 * The stylesheets are FONTSOURCE'S OWN, with the file URLs swapped for their bytes. Writing the
 * `@font-face` rules by hand would mean writing the `unicode-range` of every subset by hand, and a
 * face declared without one claims every character — so a single hand-typed rule quietly takes the
 * whole alphabet and hands `č ć ž š đ` to whatever the container has. On a slim Debian image that is
 * Liberation Sans: not a hole in the paper, a different letterform, which is why nobody has ever
 * reported it in the claim-report PDF (`claim-report-export-font.ts` embeds the `latin` subset only,
 * and `latin-ext` is where those five letters live). Taking the upstream file verbatim means the
 * paper carries exactly the faces the screen carries, and keeps carrying them after an upgrade.
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

/** `url(./files/x.woff2)` → `url(data:font/woff2;base64,…)`, relative to the stylesheet's own dir. */
async function inlineFontStylesheet(specifier: string): Promise<string> {
  const file = require.resolve(specifier)
  const dir = path.dirname(file)
  const css = await readFile(file, 'utf8')

  // Chromium never reaches the `.woff` fallback, and carrying it would double the document.
  const withoutLegacy = css.replace(/,\s*url\([^)]*\.woff\)\s*format\('woff'\)/g, '')

  const references = [...withoutLegacy.matchAll(/url\((\.\/files\/[^)]+\.woff2)\)/g)]
  const inlined = await Promise.all(
    references.map(async (match) => {
      const bytes = await readFile(path.join(dir, match[1] as string))
      return `url(data:font/woff2;base64,${bytes.toString('base64')})`
    }),
  )

  let index = 0
  const result = withoutLegacy.replace(
    /url\(\.\/files\/[^)]+\.woff2\)/g,
    () => inlined[index++] as string,
  )

  // A stylesheet that still points at a file is a stylesheet whose font will not arrive, and the
  // page would render in the fallback with nothing to say so.
  if (result.includes('./files/')) {
    throw new Error(`unresolved font url in ${specifier}`)
  }
  return result
}

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
