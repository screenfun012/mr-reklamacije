const DEFAULT_API_ORIGIN = 'http://localhost:3000'

function isBrowser(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    'window' in globalThis &&
    (globalThis as { window?: unknown }).window !== undefined
  )
}

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function readServerApiOrigin(): string {
  return process.env['VITE_API_URL'] ?? process.env['API_INTERNAL_URL'] ?? DEFAULT_API_ORIGIN
}

/**
 * Browser: keep same-origin relative paths (Vite dev proxy / production edge).
 * SSR/Node: resolve to absolute API origin — Node fetch rejects bare `/api/...`.
 */
export function resolveFetchUrl(path: string): string {
  if (isAbsoluteUrl(path)) {
    return path
  }

  if (isBrowser()) {
    return path
  }

  const origin = readServerApiOrigin().replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${origin}${normalizedPath}`
}
