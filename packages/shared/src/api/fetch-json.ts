import type { ZodType } from 'zod'

import { ApiError, parseApiErrorBody } from './api-error.js'
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

/**
 * Like {@link fetchJson}, but validates the successful response body against `schema`
 * at the boundary. Server/client drift (a missing or renamed field) throws a `ZodError`
 * here — loud, next to the fetch — instead of surfacing as a mystery crash deep inside a
 * component. Prefer this over `fetchJson<T>` wherever a matching response schema exists
 * (rule 02: "Zod is the boundary source of truth"). The return type is inferred from the
 * schema, so no separate type argument is needed.
 */
export async function fetchParsed<T>(
  url: string,
  schema: ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const body = await fetchJson<unknown>(url, init)
  return schema.parse(body)
}
