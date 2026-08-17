import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { PERMISSIONS } from '../permissions.js'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const CATALOG = join(REPO_ROOT, 'packages', 'shared', 'src', 'permissions.ts')

const SEARCH_ROOTS = ['apps', 'packages']
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', '.output', '.nitro', 'paraglide', '.git'])

/**
 * Permissions still pending a feature. Each has a verdict in
 * `docs/superpowers/specs/2026-08-17-roles-admin-panel-design.md` §7 and a task that closes it.
 *
 * The assertion is EQUALITY, not "contains": adding a new unchecked permission fails, and so does
 * implementing one of these without striking it off. The list can only shrink, and it cannot rot.
 */
const PENDING: readonly string[] = [
  // Gate the fault-per-employee figures — measuring named people is its own permission.
  'employees.view_analytics',
  // No route deactivates an employee yet; the admin screen only soft-deletes.
  'employees.deactivate',
  // Waiting on the "engines assembled per month" counter. Excel already READS the table.
  'employee_output.view',
  'employee_output.update',
  // No route creates, edits or deletes a user — accounts arrive through registration + approval.
  'users.create',
  'users.update',
  'users.delete',
  // Built by the roles panel itself.
  'roles.view',
  'roles.create',
  'roles.update',
  'roles.delete',
  // Two of the three intake catalogs have no admin screen; only the checklist does.
  'settings.intake_damage_types.manage',
  'settings.intake_arrival_modes.manage',
  // No setting is marked secret, so nothing gates on this yet.
  'settings.app_settings.manage_secrets',
  // The audit screen exists; exporting it does not.
  'audit.export',
]

async function collectSources(dir: string, into: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name) || entry.name === '__tests__') continue
      await collectSources(full, into)
      continue
    }
    if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith('.d.ts')) continue
    if (/\.test\.tsx?$/.test(entry.name) || full === CATALOG) continue
    into.push(full)
  }
}

/**
 * Prose is not enforcement. A permission named in a comment — including this repository's habit of
 * quoting one in backticks while explaining why it is NOT built yet — must still count as unchecked,
 * or the guard congratulates itself on the very entries it exists to find.
 *
 * The `[^:]` keeps `https://` out of the line-comment rule; a mangled line can only ever cause a
 * loud failure here, never a quiet pass.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/**
 * The catalog file is not skipped wholesale, because the gate lists inside it — the ones routes
 * spread into `requirePermissions` — are real enforcement. What IS cut is every list that merely
 * DECLARES or GRANTS: the catalog array and the five system-role arrays. A permission handed to a
 * role still does nothing until some code asks for it.
 */
function enforcementPartOfCatalog(source: string): string {
  return source
    .replace(/export const PERMISSIONS = \[[\s\S]*?\] as const/, '')
    .replace(
      /export const [A-Z_]*PERMISSIONS: readonly Permission\[\] = \[[\s\S]*?\] as const/g,
      '',
    )
}

/**
 * A permission that nothing checks is worse than a missing one: the admin panel renders it as a
 * switch, and unticking a switch that controls nothing looks exactly like forbidding something.
 *
 * Measured on 2026-08-17, before this existed: **32 of 97 permissions were in that state** — a
 * catalog written ahead of a plan whose parts were never built. Two were live holes (the DOMACE
 * amounts, and the client-visible flag on an upload). 13 were retired the same day.
 *
 * ⚠ Matched as a QUOTED literal, never as a bare substring. `roles.create` is a prefix of
 * `roles.createdBy`, and the first draft of this test called it enforced because of that one Drizzle
 * column. The dead permission it was meant to catch would have shipped.
 */
describe('the permission catalog', () => {
  it('has no entry that nothing in the codebase ever checks', async () => {
    const files: string[] = []
    for (const root of SEARCH_ROOTS) {
      await collectSources(join(REPO_ROOT, root), files)
    }

    // Guards the sweep itself: an empty or truncated walk would pass for the wrong reason.
    expect(files.length).toBeGreaterThan(500)

    const sources = await Promise.all(files.map((file) => readFile(file, 'utf8')))
    const haystack = [...sources, enforcementPartOfCatalog(await readFile(CATALOG, 'utf8'))]
      .map(withoutComments)
      .join('\n')

    const isChecked = (permission: string): boolean =>
      haystack.includes(`'${permission}'`) ||
      haystack.includes(`"${permission}"`) ||
      haystack.includes(`\`${permission}\``)

    expect(PERMISSIONS.filter((permission) => !isChecked(permission))).toEqual(PENDING)
  })
})
