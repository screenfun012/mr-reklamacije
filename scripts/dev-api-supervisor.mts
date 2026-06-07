#!/usr/bin/env tsx
/**
 * Keeps the host API alive in dev — restarts on crash (not only on file change).
 * Port freeing is handled by dev:all / dev:api; pass --free-port to free :3000 first.
 */
import { type ChildProcess } from 'node:child_process'

import {
  DEV_PORTS,
  REPO_ROOT,
  freePort,
  sleep,
  spawnInherit,
  stopDockerApi,
} from './dev-lib.mts'

const MAX_RESTARTS = 50
const RESTART_DELAY_MS = 2000
const freePortFirst = process.argv.includes('--free-port')

let shuttingDown = false
let child: ChildProcess | null = null

function startApi(): ChildProcess {
  return spawnInherit('pnpm', ['--filter', 'api', 'dev'], { cwd: REPO_ROOT })
}

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return
  shuttingDown = true
  if (child && !child.killed) {
    child.kill(signal)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

async function main(): Promise<void> {
  if (freePortFirst) {
    if (freePort(DEV_PORTS.api)) {
      console.log(`[api] Freed port ${DEV_PORTS.api}`)
    }
    stopDockerApi()
  }

  console.log(`[api] Starting on http://localhost:${DEV_PORTS.api} (supervised)…`)

  let restarts = 0

  while (!shuttingDown && restarts <= MAX_RESTARTS) {
    child = startApi()

    const exitCode = await new Promise<number | null>((resolve) => {
      child?.on('exit', (code) => resolve(code))
    })

    if (shuttingDown) break

    restarts += 1
    console.error(
      `[api] Process exited (code ${exitCode ?? 'null'}) — restart ${restarts}/${MAX_RESTARTS} in ${RESTART_DELAY_MS}ms`,
    )
    await sleep(RESTART_DELAY_MS)
  }

  if (!shuttingDown && restarts > MAX_RESTARTS) {
    console.error('[api] Too many restarts — giving up')
    process.exit(1)
  }

  process.exit(0)
}

await main()
