import type { ZodType } from 'zod'

import { ApiError, parseApiErrorBody, type ParsedApiError } from './api-error.js'
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

  let parsed: ParsedApiError = {
    message: response.statusText || 'Request failed',
  }

  try {
    const body: unknown = await response.json()
    parsed = parseApiErrorBody(body)
  } catch {
    // Non-JSON error bodies fall back to status text.
  }

  throw new ApiError(parsed.message, response.status, parsed.code, parsed.details)
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
