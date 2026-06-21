#!/usr/bin/env tsx
/**
 * One-command dev: Docker wait → Postgres → i18n compile → API (supervised) → 3 frontends.
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
  freeDevStack,
  isDockerDaemonReady,
  run,
  startPostgres,
  waitForDockerDaemon,
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

// --- Kill stale dev:all / tsx watch trees, then free ports ---
const { killedPids, freedPorts } = await freeDevStack()
if (killedPids.length > 0) {
  log('preflight', `Stopped stale dev processes: ${killedPids.length}`)
}
if (freedPorts.length > 0) {
  log('preflight', `Freed ports: ${freedPorts.join(', ')}`)
}

// --- Docker daemon (Docker Desktop boots 30–60s on M1; compose fails until socket is up) ---
if (!isDockerDaemonReady()) {
  log('docker', 'Docker daemon not ready — waiting up to 60s (is Docker Desktop starting?)…')
  const dockerReady = await waitForDockerDaemon(60_000)
  if (!dockerReady) {
    console.error('\n[docker] Docker daemon nije dostupan ni posle 60s.')
    console.error('[docker] Upali Docker Desktop i pokušaj ponovo: pnpm dev:all\n')
    process.exit(1)
  }
}
log('docker', 'Docker daemon ready')

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

// --- i18n compile (frontends 500 on missing src/paraglide/messages.js otherwise) ---
log('i18n', 'Compiling Paraglide messages (@mr/i18n)…')
try {
  run('pnpm --filter @mr/i18n compile', { stdio: 'inherit' })
  log('i18n', 'Paraglide compile done')
} catch {
  console.error('\n[i18n] Paraglide compile failed — frontends would 500 on missing messages.js.')
  console.error('[i18n] Run manually for details: pnpm --filter @mr/i18n compile\n')
  process.exit(1)
}

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
