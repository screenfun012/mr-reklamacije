#!/usr/bin/env tsx
/**
 * One-command dev: Postgres → API (supervised) → 3 frontends, single terminal.
 *
 * Usage: pnpm dev:all
 * Preflight only: pnpm dev:check
 */
import concurrently from 'concurrently'

import {
  API_HEALTH_URL,
  DEV_PORTS,
  REPO_ROOT,
  checkNodeModulesIntegrity,
  freePorts,
  sleep,
  startPostgres,
  waitForHttp,
  waitForPostgres,
} from './dev-lib.mts'

const force = process.argv.includes('--force')

function log(prefix: string, message: string): void {
  console.log(`[${prefix}] ${message}`)
}

// --- Preflight: node_modules ---
const nm = checkNodeModulesIntegrity()
if (!nm.ok && !force) {
  log('preflight', 'Corrupted node_modules detected:')
  for (const issue of nm.issues.slice(0, 5)) {
    console.log(`  - ${issue.kind}: ${issue.path} (${issue.detail})`)
  }
  console.error(
    '\nFix: rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install',
  )
  console.error('Run that in your own terminal (outside Cursor sandbox if EPERM).')
  console.error('Or bypass with: pnpm dev:all --force\n')
  process.exit(1)
}

// --- Free ports ---
const freed = freePorts(Object.values(DEV_PORTS))
if (freed.length > 0) {
  log('preflight', `Freed ports: ${freed.join(', ')}`)
  await sleep(500)
}

// --- Postgres ---
log('db', 'Starting Postgres (docker compose up -d postgres)…')
startPostgres()

log('db', 'Waiting for Postgres to become healthy…')
const pgReady = await waitForPostgres(60_000)
if (!pgReady) {
  console.error('[db] Postgres not healthy after 60s — check: docker compose ps')
  process.exit(1)
}
log('db', 'Postgres healthy')

// --- API first (background), then frontends after health ---
log('api', 'Starting supervised API…')

const { result } = concurrently(
  [
    {
      name: 'api',
      command: 'tsx scripts/dev-api-supervisor.mts',
      prefixColor: 'blue',
    },
    {
      name: 'admin',
      command: 'tsx scripts/dev-web-wait.mts admin-web',
      prefixColor: 'green',
    },
    {
      name: 'internal',
      command: 'tsx scripts/dev-web-wait.mts internal-web',
      prefixColor: 'yellow',
    },
    {
      name: 'portal',
      command: 'tsx scripts/dev-web-wait.mts portal-web',
      prefixColor: 'magenta',
    },
  ],
  {
    cwd: REPO_ROOT,
    prefix: '{name}|',
    restartTries: 3,
    restartAfter: 3000,
    raw: false,
  },
)

// Wait for API in parallel (frontends also wait via dev-web-wait)
log('api', `Waiting for ${API_HEALTH_URL} …`)
const apiReady = await waitForHttp(API_HEALTH_URL, { timeoutMs: 120_000 })
if (apiReady) {
  log('api', 'API ready — frontends starting (or already up)')
} else {
  log('api', 'API not ready after 120s — check logs above')
}

console.log('\n[dev] Stack running:')
console.log(`  API      http://localhost:${DEV_PORTS.api}`)
console.log(`  Admin    http://localhost:${DEV_PORTS.admin}`)
console.log(`  Internal http://localhost:${DEV_PORTS.internal}`)
console.log(`  Portal   http://localhost:${DEV_PORTS.portal}`)
console.log('[dev] Ctrl+C stops all. Health check anytime: pnpm dev:check\n')

await result
