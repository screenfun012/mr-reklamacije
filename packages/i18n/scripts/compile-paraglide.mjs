/**
 * Programmatic Paraglide compile so we can pass strategy + localStorageKey.
 * CLI `paraglide-js compile` only exposes `--strategy`, not `--localStorageKey`.
 *
 * @see https://inlang.com/m/gerre34r/library-inlang-paraglideJs/strategy
 *
 * Strategy notes:
 * - localStorage persists user choice under `localStorageKey` (mrr:locale).
 * - globalVariable mirrors `setLocale` into in-memory `_locale` so Vitest/node
 *   callers get consistent `getLocale()` after `setLocale(..., { reload: false })`
 *   without a browser (built-in strategies skip localStorage when `isServer`).
 * - preferredLanguage: Accept-Language / navigator (client only).
 * - baseLocale: final fallback (sr).
 */
import { compile } from '@inlang/paraglide-js'
import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(scriptDir, '..')
const outdir = join(pkgRoot, 'src/paraglide')

// Recursive remove — plain rmdir fails with ENOTEMPTY when the outdir still has files (CI fresh checkout + concurrent compiles).
rmSync(outdir, { recursive: true, force: true })

await compile({
  project: join(pkgRoot, 'project.inlang'),
  outdir,
  strategy: ['localStorage', 'globalVariable', 'preferredLanguage', 'baseLocale'],
  localStorageKey: 'mrr:locale',
})
