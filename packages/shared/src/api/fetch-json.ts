import { ApiError, parseApiErrorBody } from './api-error.js'

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
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
