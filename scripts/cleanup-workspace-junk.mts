#!/usr/bin/env tsx
/**
 * Removes macOS Finder duplicate copies, .DS_Store, and stale package dist/.
 * Run after interrupted copies or before a clean rebuild: pnpm cleanup:junk
 */
import {
  REPO_ROOT,
  findWorkspaceJunk,
  removePackageDistDirs,
  removeWorkspaceJunk,
  run,
  tryRun,
} from './dev-lib.mts'

const junkBefore = findWorkspaceJunk()
const removed = removeWorkspaceJunk()
for (const path of removed) {
  console.log(`  removed ${path.replace(REPO_ROOT + '/', '')}`)
}

console.log('[cleanup] Removing packages/*/dist and apps/*/dist…')
const distRemoved = removePackageDistDirs()
for (const path of distRemoved) {
  console.log(`  removed ${path.replace(REPO_ROOT + '/', '')}`)
}

console.log('[cleanup] git fsck…')
const fsck = tryRun('git fsck --no-progress 2>&1') ?? ''
if (fsck.includes('error') || fsck.includes('fatal')) {
  console.error(fsck)
  process.exit(1)
}
console.log(fsck.trim() || '  ok (no errors)')

console.log('[cleanup] Rebuilding workspace packages (turbo build)…')
run('pnpm build', { stdio: 'inherit' })

console.log(
  `\n[cleanup] Done — removed ${removed.length} junk path(s) (found ${junkBefore.length}), ${distRemoved.length} dist dir(s).`,
)
