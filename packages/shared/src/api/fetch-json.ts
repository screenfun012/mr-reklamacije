import { ApiError, parseApiErrorBody } from './api-error.js'
import { resolveFetchUrl } from './resolve-fetch-url.js'

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

async function buildRequestHeaders(init?: RequestInit): Promise<Headers> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (!isBrowser()) {
    try {
      const { getRequestHeaders } = await import('@tanstack/react-start/server')
      const cookie = getRequestHeaders().get('cookie')
      if (cookie && !headers.has('cookie')) {
        headers.set('cookie', cookie)
      }
    } catch {
      // Outside TanStack Start SSR — no request cookies to forward.
    }
  }

  return headers
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const resolvedUrl = resolveFetchUrl(url)
  const headers = await buildRequestHeaders(init)

  const response = await fetch(resolvedUrl, {
    credentials: 'include',
    ...init,
    headers,
  })

  if (response.ok) {
    return (await response.json()) as T
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
