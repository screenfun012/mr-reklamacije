import { ApiError, parseApiErrorBody } from './api-error.js'
import { forwardSsrRequestHeaders } from './forward-request-headers.js'
import { resolveFetchUrl } from './resolve-fetch-url.js'

function isBrowser(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    'window' in globalThis &&
    (globalThis as { window?: unknown }).window !== undefined
  )
}

async function buildRequestHeaders(init?: RequestInit): Promise<Headers> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (!isBrowser()) {
    // SSR opens its own connection to the api — the browser's cookie AND client
    // address only travel if copied across.
    await forwardSsrRequestHeaders(headers)
  }

  return headers
}

export async function fetchNoContent(url: string, init?: RequestInit): Promise<void> {
  const resolvedUrl = resolveFetchUrl(url)
  const headers = await buildRequestHeaders(init)

  const response = await fetch(resolvedUrl, {
    credentials: 'include',
    ...init,
    headers,
  })

  if (response.ok) {
    return
  }

  let parsed: { message: string; code?: string } = {
    message: response.statusText || 'Request failed',
  }

  try {
    const body: unknown = await response.json()
    parsed = parseApiErrorBody(body)
  } catch {
    // Non-JSON error bodies fall back to status text.
  }

  throw new ApiError(parsed.message, response.status, parsed.code)
}
