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
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(scriptDir, '..')

await compile({
  project: join(pkgRoot, 'project.inlang'),
  outdir: join(pkgRoot, 'src/paraglide'),
  strategy: ['localStorage', 'globalVariable', 'preferredLanguage', 'baseLocale'],
  localStorageKey: 'mrr:locale',
})
