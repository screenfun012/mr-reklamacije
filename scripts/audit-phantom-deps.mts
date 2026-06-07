#!/usr/bin/env tsx
/**
 * Phantom dependency guard — flags runtime imports that consumers must pin.
 * Focused on better-auth peers and Nitro dev error-page dynamic imports.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { REPO_ROOT } from './dev-lib.mts'

const DYN_IMPORT_RE = /import\s*\(\s*["']([^"']+)["']\s*\)/g
const STATIC_IMPORT_RE = /from\s+["']([^"']+)["']/g

const KNOWN_PINS: { consumer: 'apps/api' | 'root'; packages: string[] }[] = [
  { consumer: 'apps/api', packages: ['@opentelemetry/api', 'jose', 'kysely'] },
  { consumer: 'root', packages: ['youch', 'youch-core'] },
]

const CORE_PEER_IMPORTS = ['@opentelemetry/api', 'jose', 'kysely'] as const

const NITRO_DEV_FILES = [
  'dist/_dev.mjs',
  'dist/runtime/internal/error/dev.mjs',
  'dist/runtime/internal/vite/dev-worker.mjs',
] as const

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function deps(pkg: Record<string, unknown> | null): Set<string> {
  const s = new Set<string>()
  if (!pkg) return s
  for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const block = pkg[k]
    if (block && typeof block === 'object') {
      for (const n of Object.keys(block as Record<string, string>)) s.add(n)
    }
  }
  return s
}

function findPkgRoot(label: string): string | null {
  const pnpm = join(REPO_ROOT, 'node_modules', '.pnpm')
  if (!existsSync(pnpm)) return null
  const prefix = `${label.replace('/', '+')}@`
  const hit = readdirSync(pnpm).find((n) => n.startsWith(prefix))
  return hit ? join(pnpm, hit, 'node_modules', label) : null
}

function extractImports(source: string): string[] {
  const names: string[] = []
  for (const re of [STATIC_IMPORT_RE, DYN_IMPORT_RE]) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(source))) {
      const spec = m[1]
      if (!spec || spec.startsWith('.') || spec.startsWith('node:') || spec.startsWith('#'))
        continue
      const base = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
      names.push(base)
    }
  }
  return names
}

let hasMissing = false

console.log('=== Known pins (CONTRIBUTING.md) ===\n')
for (const { consumer, packages } of KNOWN_PINS) {
  const pkgPath =
    consumer === 'root'
      ? join(REPO_ROOT, 'package.json')
      : join(REPO_ROOT, consumer, 'package.json')
  const declared = deps(readJson(pkgPath))
  for (const name of packages) {
    const status = declared.has(name) ? 'PINNED' : 'MISSING'
    if (status === 'MISSING') hasMissing = true
    console.log(`${status}\t${name}\t→ ${consumer}`)
  }
}

console.log('\n=== @better-auth/core peer imports (instrumentation/) ===\n')
const coreRoot = findPkgRoot('@better-auth/core')
if (!coreRoot) {
  console.log('SKIP\t@better-auth/core not installed')
  hasMissing = true
} else {
  const instr = join(coreRoot, 'dist', 'instrumentation')
  const apiDeclared = deps(readJson(join(REPO_ROOT, 'apps/api/package.json')))
  for (const file of readdirSync(instr).filter((f) => f.endsWith('.mjs'))) {
    const imports = extractImports(readFileSync(join(instr, file), 'utf8'))
    for (const name of imports) {
      if (!CORE_PEER_IMPORTS.includes(name as (typeof CORE_PEER_IMPORTS)[number])) continue
      const status = apiDeclared.has(name) ? 'PINNED' : 'MISSING'
      if (status === 'MISSING') hasMissing = true
      console.log(`${status}\t${name}\t← ${file}`)
    }
  }
}

console.log('\n=== Nitro dev error pages (dynamic imports) ===\n')
const nitroRoot = findPkgRoot('nitro')
if (!nitroRoot) {
  console.log('SKIP\tnitro not installed')
} else {
  const rootDeclared = deps(readJson(join(REPO_ROOT, 'package.json')))
  for (const rel of NITRO_DEV_FILES) {
    const path = join(nitroRoot, rel)
    if (!existsSync(path)) continue
    const imports = extractImports(readFileSync(path, 'utf8'))
    for (const name of imports) {
      if (name !== 'youch' && name !== 'youch-core') continue
      const status = rootDeclared.has(name) ? 'PINNED' : 'MISSING'
      if (status === 'MISSING') hasMissing = true
      console.log(`${status}\t${name}\t← ${rel}`)
    }
  }
}

if (hasMissing) {
  console.log('\n→ Add MISSING packages to the consumer package.json (see CONTRIBUTING.md).')
  process.exit(1)
}

console.log('\n✓ Phantom dependency guard passed.')
