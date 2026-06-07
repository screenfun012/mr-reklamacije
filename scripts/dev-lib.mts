import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readdirSync, readlinkSync, rmSync, statSync } from 'node:fs'
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
    return execSync(command, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
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

export function isPortFree(port: number): boolean {
  return getPortListenerPid(port) === null
}

/**
 * Wait until nothing is listening on `port`. Optionally SIGTERM stale listeners first.
 */
export async function waitForPortFree(
  port: number,
  options?: { timeoutMs?: number; killFirst?: boolean },
): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 10_000
  const killFirst = options?.killFirst ?? false
  const deadline = Date.now() + timeoutMs

  if (killFirst) {
    freePort(port)
  }

  while (Date.now() < deadline) {
    if (isPortFree(port)) return true
    await sleep(150)
  }

  return isPortFree(port)
}

/** Free port and block until the listener is gone (or timeout). */
export async function ensurePortFree(port: number, timeoutMs = 10_000): Promise<boolean> {
  if (!isPortFree(port)) {
    freePort(port)
  }
  return waitForPortFree(port, { timeoutMs })
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

const JUNK_SKIP_DIRS = new Set(['node_modules', '.git'])

/** Finder copies: "index 2.js", "README 2.md", "server 2/" */
export function isMacOsDuplicateName(name: string): boolean {
  return / 2$/.test(name) || / 2\./.test(name)
}

function shouldSkipJunkScan(relativePath: string): boolean {
  return relativePath.split('/').some((p) => JUNK_SKIP_DIRS.has(p))
}

export function findWorkspaceJunk(root = REPO_ROOT): string[] {
  const found: string[] = []

  function walk(dir: string, relative = ''): void {
    if (!existsSync(dir)) return

    for (const entry of readdirSync(dir)) {
      const rel = relative ? `${relative}/${entry}` : entry
      if (shouldSkipJunkScan(rel)) continue

      const full = join(dir, entry)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }

      if (entry === '.DS_Store' || isMacOsDuplicateName(entry)) {
        found.push(full)
        continue
      }

      if (st.isDirectory()) {
        walk(full, rel)
      }
    }
  }

  walk(root)

  const gitLogs = join(root, '.git', 'logs', 'refs', 'remotes', 'origin')
  if (existsSync(gitLogs)) {
    for (const entry of readdirSync(gitLogs)) {
      if (isMacOsDuplicateName(entry)) {
        found.push(join(gitLogs, entry))
      }
    }
  }

  const gitIndexDup = join(root, '.git', 'index 2')
  if (existsSync(gitIndexDup)) {
    found.push(gitIndexDup)
  }

  return found
}

export function removeWorkspaceJunk(root = REPO_ROOT): string[] {
  const paths = findWorkspaceJunk(root)
  for (const path of paths) {
    rmSync(path, { recursive: true, force: true })
  }
  return paths
}

export function removePackageDistDirs(root = REPO_ROOT): string[] {
  const removed: string[] = []
  for (const parent of ['packages', 'apps'] as const) {
    const base = join(root, parent)
    if (!existsSync(base)) continue
    for (const entry of readdirSync(base)) {
      const dist = join(base, entry, 'dist')
      if (existsSync(dist)) {
        rmSync(dist, { recursive: true, force: true })
        removed.push(dist)
      }
    }
  }
  return removed
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
