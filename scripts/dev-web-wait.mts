#!/usr/bin/env tsx
/**
 * Waits for API health before starting a Vite frontend (avoids 504 on first load).
 */
import { API_HEALTH_URL, REPO_ROOT, spawnInherit, waitForHttp } from './dev-lib.mts'

const filter = process.argv[2]
if (!filter) {
  console.error('[web] Usage: dev-web-wait.mts <pnpm-filter>  e.g. internal-web')
  process.exit(1)
}

const label = filter.replace('-web', '')
console.log(`[web:${label}] Waiting for API ${API_HEALTH_URL} …`)

const ready = await waitForHttp(API_HEALTH_URL, { timeoutMs: 120_000 })
if (!ready) {
  console.error(`[web:${label}] API not ready after 120s — starting anyway (expect 504 until API is up)`)
} else {
  console.log(`[web:${label}] API ready — starting Vite`)
}

const child = spawnInherit('pnpm', ['--filter', filter, 'dev'], { cwd: REPO_ROOT })
child.on('exit', (code) => process.exit(code ?? 0))
