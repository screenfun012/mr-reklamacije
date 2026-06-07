#!/usr/bin/env tsx
/**
 * Dev API bootstrap: free port 3000, stop stray Docker API, start host API with hot reload.
 *
 * Usage: pnpm dev:api
 */
import { execSync, spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

function freePort(port: number): void {
  try {
    const pids = execSync(`lsof -ti :${port}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()
    if (!pids) {
      return
    }
    for (const pid of pids.split('\n').filter(Boolean)) {
      try {
        process.kill(Number(pid), 'SIGTERM')
      } catch {
        try {
          process.kill(Number(pid), 'SIGKILL')
        } catch {
          /* already gone */
        }
      }
    }
    console.log(`✓ Freed port ${port}`)
  } catch {
    /* port already free */
  }
}

function stopDockerApi(): void {
  try {
    execSync('docker stop mr-reklamacije-api', { stdio: 'ignore' })
    console.log('✓ Stopped Docker API container (mr-reklamacije-api)')
  } catch {
    /* not running */
  }
}

freePort(3000)
stopDockerApi()

console.log('→ Starting API on http://localhost:3000 …\n')

const child = spawn('pnpm', ['--filter', 'api', 'dev'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
