import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readdirSync, readlinkSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const REPO_ROOT = join(__dirname, '..')

export const DEV_PORTS = {
  api: 3000,
  admin: 3001,
  internal: 3002,
  portal: 3003,
} as const

export const POSTGRES_CONTAINER = 'mr-reklamacije-postgres'

export const API_HEALTH_URL = 'http://localhost:3000/api/auth/get-session'

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function run(command: string, options?: { cwd?: string; stdio?: 'inherit' | 'pipe' }): void {
  execSync(command, {
    cwd: options?.cwd ?? REPO_ROOT,
    stdio: options?.stdio ?? 'pipe',
    encoding: 'utf8',
  })
}

export function tryRun(command: string): string | null {
  try {
    return execSync(command, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

export function getPortListenerPid(port: number): number | null {
  const out = tryRun(`/usr/sbin/lsof -nP -iTCP:${port} -sTCP:LISTEN -t`)
  if (!out?.trim()) return null
  const pid = Number(out.trim().split('\n')[0])
  return Number.isFinite(pid) ? pid : null
}

export function getPortListenerCommand(port: number): string | null {
  const out = tryRun(`/usr/sbin/lsof -nP -iTCP:${port} -sTCP:LISTEN`)
  if (!out?.trim()) return null
  const line = out.trim().split('\n')[1]
  return line?.trim() ?? null
}

export function freePort(port: number): boolean {
  const pid = getPortListenerPid(port)
  if (!pid) return false
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      return false
    }
  }
  return true
}

export function freePorts(ports: readonly number[]): number[] {
  const freed: number[] = []
  for (const port of ports) {
    if (freePort(port)) freed.push(port)
  }
  return freed
}

export function stopDockerApi(): void {
  tryRun('docker stop mr-reklamacije-api')
}

export function startPostgres(): void {
  run('docker compose up -d postgres', { stdio: 'inherit' })
  stopDockerApi()
}

export function isPostgresHealthy(): boolean {
  const status = tryRun(
    `docker inspect --format='{{.State.Health.Status}}' ${POSTGRES_CONTAINER} 2>/dev/null`,
  )?.trim()
  if (status === 'healthy') return true
  const ready = tryRun(
    `docker exec ${POSTGRES_CONTAINER} pg_isready -U mr -d mr_reklamacije 2>/dev/null`,
  )
  return ready?.includes('accepting connections') ?? false
}

export async function waitForPostgres(timeoutMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (isPostgresHealthy()) return true
    await sleep(1000)
  }
  return false
}

export async function waitForHttp(
  url: string,
  options?: { expectedStatus?: number; timeoutMs?: number },
): Promise<boolean> {
  const expectedStatus = options?.expectedStatus ?? 200
  const timeoutMs = options?.timeoutMs ?? 90_000
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (res.status === expectedStatus) return true
    } catch {
      /* not ready */
    }
    await sleep(500)
  }
  return false
}

export interface NodeModulesIssue {
  kind: 'duplicate_dir' | 'missing_package_json' | 'broken_symlink'
  path: string
  detail: string
}

export function checkNodeModulesIntegrity(): { ok: boolean; issues: NodeModulesIssue[] } {
  const issues: NodeModulesIssue[] = []
  const pnpmDir = join(REPO_ROOT, 'node_modules', '.pnpm')

  if (!existsSync(pnpmDir)) {
    issues.push({
      kind: 'missing_package_json',
      path: 'node_modules',
      detail: 'node_modules missing — run pnpm install',
    })
    return { ok: false, issues }
  }

  for (const entry of readdirSync(pnpmDir)) {
    const nm = join(pnpmDir, entry, 'node_modules')
    if (!existsSync(nm)) continue

    for (const pkgDir of readdirSync(nm)) {
      if (/\s\d+$/.test(pkgDir) || pkgDir.includes(' 2')) {
        issues.push({
          kind: 'duplicate_dir',
          path: join(nm, pkgDir),
          detail: 'Interrupted install left duplicate package directory',
        })
      }

      const full = join(nm, pkgDir)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }

      if (st.isSymbolicLink()) {
        try {
          const target = readlinkSync(full)
          const resolved = join(nm, target)
          if (!existsSync(resolved) && !existsSync(join(pnpmDir, entry, target))) {
            issues.push({
              kind: 'broken_symlink',
              path: full,
              detail: `Broken symlink → ${target}`,
            })
          }
        } catch {
          issues.push({
            kind: 'broken_symlink',
            path: full,
            detail: 'Unreadable symlink',
          })
        }
        continue
      }

      if (!st.isDirectory() || pkgDir.startsWith('@') || pkgDir.startsWith('.')) continue

      const pkgJson = join(full, 'package.json')
      const hasDist = existsSync(join(full, 'dist'))
      const hasIndex = existsSync(join(full, 'index.js')) || existsSync(join(full, 'index.mjs'))
      if (!existsSync(pkgJson) && (hasDist || hasIndex)) {
        issues.push({
          kind: 'missing_package_json',
          path: full,
          detail: 'Package directory has dist/ but no package.json (corrupted install)',
        })
      }
    }
  }

  return { ok: issues.length === 0, issues }
}

export function spawnInherit(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
): ChildProcess {
  return spawn(command, args, {
    cwd: options?.cwd ?? REPO_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...options?.env },
  })
}
