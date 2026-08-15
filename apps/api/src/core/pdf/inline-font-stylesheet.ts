import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

/**
 * A fontsource stylesheet with its file URLs swapped for the bytes they point at:
 * `url(./files/x.woff2)` → `url(data:font/woff2;base64,…)`.
 *
 * Inlined rather than linked because headless Chromium fetches nothing while it renders a page it
 * was handed as a string — there is no server behind it and no base URL to resolve against — and it
 * fails at that silently, printing a fallback font.
 *
 * Taken UPSTREAM AND WHOLE rather than hand-written, and that is the load-bearing part. Writing the
 * `@font-face` rules here would mean writing each subset's `unicode-range` here, and a face declared
 * without one claims every character — so a single hand-typed rule quietly takes the whole alphabet
 * and hands `č ć ž š đ` to whatever the machine has, because they live in `latin-ext` and the file
 * embedded under that rule does not carry them. On a slim Debian container that is Liberation Sans:
 * not a hole in the paper, a different letterform, which is why the claim-report PDF carried exactly
 * that defect from the day it shipped until 2026-08-14 and nobody reported it.
 *
 * ⚠ The family name comes from the stylesheet too — `@fontsource-variable/figtree` declares
 * `Figtree Variable`, not `Figtree`. Whatever asks for the font has to ask for THAT name.
 */
export async function inlineFontStylesheet(specifier: string): Promise<string> {
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
