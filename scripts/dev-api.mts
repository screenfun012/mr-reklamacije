#!/usr/bin/env tsx
/**
 * Dev API bootstrap: free port 3000, stop stray Docker API, start host API with hot reload.
 * For supervised restart-on-crash, use dev:all or dev-api-supervisor.mts.
 */
import { spawn } from 'node:child_process'

import { DEV_PORTS, REPO_ROOT, ensurePortFree, stopDockerApi } from './dev-lib.mts'

stopDockerApi()
console.log('✓ Stopped Docker API container if it was running')

const portReady = await ensurePortFree(DEV_PORTS.api, 10_000)
if (portReady) {
  console.log(`✓ Port ${DEV_PORTS.api} is free`)
} else {
  console.error(`✗ Port ${DEV_PORTS.api} still in use — stop the other API process and retry`)
  process.exit(1)
}

console.log(`→ Starting API on http://localhost:${DEV_PORTS.api} …\n`)

const child = spawn('pnpm', ['--filter', 'api', 'dev'], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
