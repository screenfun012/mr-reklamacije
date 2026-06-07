#!/usr/bin/env tsx
/**
 * Preflight health check for local dev environment.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  API_HEALTH_URL,
  DEV_PORTS,
  POSTGRES_CONTAINER,
  REPO_ROOT,
  checkNodeModulesIntegrity,
  getPortListenerCommand,
  getPortListenerPid,
  isPostgresHealthy,
  tryRun,
} from './dev-lib.mts'

type Status = 'ok' | 'warn' | 'fail'

interface Check {
  name: string
  status: Status
  detail: string
}

const checks: Check[] = []

function add(name: string, status: Status, detail: string): void {
  checks.push({ name, status, detail })
}

function icon(status: Status): string {
  if (status === 'ok') return '✅'
  if (status === 'warn') return '⚠️ '
  return '❌'
}

// Postgres
if (!tryRun(`docker inspect ${POSTGRES_CONTAINER} 2>/dev/null`)) {
  add('Postgres', 'fail', `Container ${POSTGRES_CONTAINER} not running — run: pnpm dev:db`)
} else if (isPostgresHealthy()) {
  add('Postgres', 'ok', `${POSTGRES_CONTAINER} healthy`)
} else {
  add('Postgres', 'warn', `${POSTGRES_CONTAINER} running but not healthy yet — wait or: docker compose up -d postgres`)
}

// API
try {
  const res = await fetch(API_HEALTH_URL, { signal: AbortSignal.timeout(3000) })
  if (res.status === 200) {
    add('API :3000', 'ok', `GET /api/auth/get-session → ${res.status}`)
  } else {
    add('API :3000', 'warn', `GET /api/auth/get-session → ${res.status} (expected 200)`)
  }
} catch {
  add('API :3000', 'fail', 'Not responding — run: pnpm dev:all or pnpm dev:api')
}

// Ports
for (const [name, port] of Object.entries(DEV_PORTS)) {
  const pid = getPortListenerPid(port)
  if (!pid) {
    add(`Port :${port}`, 'ok', `free (${name})`)
    continue
  }
  const cmd = getPortListenerCommand(port) ?? `PID ${pid}`
  const expected = name === 'api' ? 'warn' : 'warn'
  add(`Port :${port}`, expected, `in use — ${cmd}`)
}

// node_modules integrity
const nm = checkNodeModulesIntegrity()
if (!existsSync(join(REPO_ROOT, 'node_modules'))) {
  add('node_modules', 'fail', 'Missing — run: pnpm install')
} else if (nm.ok) {
  add('node_modules', 'ok', 'No corrupted package directories detected')
} else {
  const sample = nm.issues.slice(0, 3).map((i) => `${i.kind}: ${i.path}`).join('; ')
  add(
    'node_modules',
    'fail',
    `${nm.issues.length} issue(s) — ${sample}. Fix: rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install`,
  )
}

// Phantom dep pins (quick read of package.json)
const apiPkg = JSON.parse(readFileSync(join(REPO_ROOT, 'apps/api/package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
}
const rootPkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
  devDependencies?: Record<string, string>
}
const requiredApi = ['@opentelemetry/api', 'jose', 'kysely']
const requiredRoot = ['youch', 'youch-core']
const missingApi = requiredApi.filter((p) => !apiPkg.dependencies?.[p])
const missingRoot = requiredRoot.filter((p) => !rootPkg.devDependencies?.[p])
if (missingApi.length === 0 && missingRoot.length === 0) {
  add('Phantom deps', 'ok', 'Known pins present in apps/api and root package.json')
} else {
  add(
    'Phantom deps',
    'fail',
    `Missing pins: ${[...missingApi.map((p) => `apps/api:${p}`), ...missingRoot.map((p) => `root:${p}`)].join(', ')}`,
  )
}

// Report
console.log('\nMR Reklamacije — dev environment check\n')
for (const c of checks) {
  console.log(`${icon(c.status)} ${c.name.padEnd(16)} ${c.detail}`)
}

const failures = checks.filter((c) => c.status === 'fail')
const warnings = checks.filter((c) => c.status === 'warn')

console.log('\n---')
if (failures.length === 0 && warnings.length === 0) {
  console.log('All checks passed. Use: pnpm dev:all')
} else {
  console.log('Suggested fix:')
  if (failures.some((c) => c.name === 'node_modules')) {
    console.log('  1. Clean reinstall (run in your terminal, not Cursor sandbox):')
    console.log('     rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install')
  }
  if (failures.some((c) => c.name.startsWith('API') || c.name === 'Postgres')) {
    console.log('  2. Start everything: pnpm dev:all')
  }
  if (warnings.some((c) => c.name.startsWith('Port'))) {
    console.log('  3. Free stuck ports: pnpm dev:all (auto-frees :3000–:3003) or lsof -ti :PORT | xargs kill -9')
  }
  console.log('  4. Re-scan phantom deps after bumping better-auth/nitro: pnpm dev:audit-deps')
}

process.exit(failures.length > 0 ? 1 : 0)
