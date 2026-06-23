import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

let cachedFontFaceCss: string | null = null

export async function getClaimReportExportFontFaceCss(): Promise<string> {
  if (cachedFontFaceCss !== null) {
    return cachedFontFaceCss
  }

  const require = createRequire(import.meta.url)
  const fontPath =
    require.resolve('@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2')
  const fontData = await readFile(fontPath)
  const base64 = fontData.toString('base64')

  cachedFontFaceCss = `
@font-face {
  font-family: 'Figtree';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(data:font/woff2;base64,${base64}) format('woff2');
}
`.trim()

  return cachedFontFaceCss
}
