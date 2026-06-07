export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface ApiErrorEnvelope {
  error?: {
    code?: string
    message?: string
    status?: number
  }
}

export function parseApiErrorBody(body: unknown): { message: string; code?: string } {
  if (typeof body !== 'object' || body === null) {
    return { message: 'Request failed' }
  }

  const envelope = body as ApiErrorEnvelope
  const error = envelope.error
  if (!error) {
    return { message: 'Request failed' }
  }

  const message = error.message ?? 'Request failed'
  if (error.code === undefined) {
    return { message }
  }

  return { message, code: error.code }
}
