#!/usr/bin/env tsx
/**
 * Dev API bootstrap: free port 3000, stop stray Docker API, start host API with hot reload.
 * For supervised restart-on-crash, use dev:all or dev-api-supervisor.mts.
 */
import { spawn } from 'node:child_process'

import { DEV_PORTS, REPO_ROOT, freePort, stopDockerApi } from './dev-lib.mts'

if (freePort(DEV_PORTS.api)) {
  console.log(`✓ Freed port ${DEV_PORTS.api}`)
}
stopDockerApi()
console.log('✓ Stopped Docker API container if it was running')

console.log(`→ Starting API on http://localhost:${DEV_PORTS.api} …\n`)

const child = spawn('pnpm', ['--filter', 'api', 'dev'], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
