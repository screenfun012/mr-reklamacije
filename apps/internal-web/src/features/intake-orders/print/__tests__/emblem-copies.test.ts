import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * The emblem exists twice on purpose and must never exist twice by accident.
 *
 * The browser needs a URL this app's own server answers, so the preview reads it from `public/` —
 * the way admin-web and portal-web carry their own copies of the shared brand marks, because the
 * three front ends are physically isolated (CLAUDE.md §1). The API has no such server: it inlines
 * the bytes into the PDF, and resolves them out of `@mr/intake-document` exactly as it resolves the
 * font files.
 *
 * So the same picture is served from two places, and the failure this pins is silent: replace one
 * and the screen and the paper start showing different marks, with every test still green and
 * nothing on either side looking broken.
 *
 * It also proves the package's export entry resolves at all — the API's only way in.
 */
describe('the emblem on the work order', () => {
  it('is the same picture in the app that shows it and the package that prints it', () => {
    const packaged = createRequire(import.meta.url).resolve(
      '@mr/intake-document/assets/logo-emblem-white.png',
    )
    const served = path.join(process.cwd(), 'public/internal/logo-emblem-white.png')

    const digestOf = (file: string): string =>
      createHash('sha256').update(readFileSync(file)).digest('hex')

    expect(digestOf(served)).toBe(digestOf(packaged))
  })
})
