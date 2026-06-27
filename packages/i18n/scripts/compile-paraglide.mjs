/**
 * Programmatic Paraglide compile so we can pass strategy + localStorageKey.
 * CLI `paraglide-js compile` only exposes `--strategy`, not `--localStorageKey`.
 *
 * @see https://inlang.com/m/gerre34r/library-inlang-paraglideJs/strategy
 *
 * Strategy notes:
 * - cookie persists locale for SSR hard refresh (synced from localStorage on bootstrap).
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

// Turbo runs `@mr/i18n#typecheck` (which calls `pnpm compile`) and
// `@mr/i18n#build` (which also calls `pnpm compile`) without an ordering
// dependency, so two compile processes can hit this same outdir at once. A
// plain `rmdir` (and even a recursive remove without retries) then races: one
// process empties the tree while the other writes into it, producing
// `ENOTEMPTY: ... rmdir '.../paraglide'`.
//
// Make the clean the *single* remover and tolerant of that inter-process race:
//   - recursive + force: remove a non-empty dir, and don't fail if it's absent
//   - maxRetries/retryDelay: retry the transient ENOTEMPTY/EBUSY/EPERM that a
//     concurrent writer triggers, instead of crashing the build
//   - cleanOutdir: false below disables Paraglide's own (un-retried) cleanup so
//     there is exactly one cleaner, not two racing ones.
rmSync(outdir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 })

await compile({
  project: join(pkgRoot, 'project.inlang'),
  outdir,
  cleanOutdir: false,
  strategy: ['cookie', 'localStorage', 'globalVariable', 'preferredLanguage', 'baseLocale'],
  localStorageKey: 'mrr:locale',
})
