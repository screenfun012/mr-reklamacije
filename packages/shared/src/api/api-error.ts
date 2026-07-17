export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined
  readonly details: unknown

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface ApiErrorEnvelope {
  error?: {
    code?: string
    message?: string
    status?: number
    details?: unknown
  }
}

export interface ParsedApiError {
  message: string
  code?: string
  details?: unknown
}

export function parseApiErrorBody(body: unknown): ParsedApiError {
  if (typeof body !== 'object' || body === null) {
    return { message: 'Request failed' }
  }

  const envelope = body as ApiErrorEnvelope
  const error = envelope.error
  if (!error) {
    return { message: 'Request failed' }
  }

  const parsed: ParsedApiError = { message: error.message ?? 'Request failed' }
  if (error.code !== undefined) {
    parsed.code = error.code
  }
  if (error.details !== undefined) {
    parsed.details = error.details
  }
  return parsed
}
