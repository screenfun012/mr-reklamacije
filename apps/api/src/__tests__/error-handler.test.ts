import type { Logger } from '@mr/logger'
import { ClaimKind, ERROR_CODE } from '@mr/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { requestId } from 'hono/request-id'
import { describe, expect, it, vi } from 'vitest'

import { AppError } from '../core/errors/app-error.js'
import { ConflictError, MrKeyConflictError } from '../core/errors/domain-errors.js'
import { registerGlobalErrorHandler } from '../core/middleware/error-handler.js'

function makeApp() {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  } as unknown as Logger

  const app = new Hono()
  registerGlobalErrorHandler(app, logger)
  return { app, logger }
}

describe('global error handler', () => {
  it('maps AppError to { error: { code, message, status } } JSON', async () => {
    const { app } = makeApp()
    app.get('/test', () => {
      throw new AppError(ERROR_CODE.NotFound, 404, 'Item missing')
    })

    const res = await app.request('/test')

    expect(res.status).toBe(404)
    const body = (await res.json()) as {
      error: { code: string; message: string; status: number }
    }
    expect(body).toEqual({
      error: {
        code: ERROR_CODE.NotFound,
        message: 'Item missing',
        status: 404,
      },
    })
  })

  it('includes existing claim details for MrKeyConflictError', async () => {
    const { app } = makeApp()
    app.get('/mr-conflict', () => {
      throw new MrKeyConflictError({
        kind: ClaimKind.Emotive,
        claimId: '11111111-1111-1111-1111-111111111111',
      })
    })

    const res = await app.request('/mr-conflict')

    expect(res.status).toBe(409)
    const body = (await res.json()) as {
      error: {
        code: string
        message: string
        status: number
        details?: { kind: string; claimId: string }
      }
    }
    expect(body.error.details).toEqual({
      kind: ClaimKind.Emotive,
      claimId: '11111111-1111-1111-1111-111111111111',
    })
    expect(body.error.code).toBe(ERROR_CODE.Conflict)
  })

  /**
   * A conflict the caller can act on: the intake restore names the order that took the number
   * back, so the office can open it instead of guessing which sheet holds it.
   */
  it("carries a ConflictError's own details in the same envelope shape", async () => {
    const { app } = makeApp()
    app.get('/conflict', () => {
      throw new ConflictError('Taken', { orderId: '22222222-2222-2222-2222-222222222222' })
    })

    const res = await app.request('/conflict')

    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: { details?: unknown } }
    expect(body.error.details).toEqual({ orderId: '22222222-2222-2222-2222-222222222222' })
  })

  it('leaves a plain ConflictError without a details key at all', async () => {
    const { app } = makeApp()
    app.get('/conflict', () => {
      throw new ConflictError('Taken')
    })

    const res = await app.request('/conflict')

    const body = (await res.json()) as { error: Record<string, unknown> }
    expect(body.error).toEqual({ code: ERROR_CODE.Conflict, message: 'Taken', status: 409 })
  })

  it('maps unknown error to generic 500', async () => {
    const { app } = makeApp()
    app.get('/crash', () => {
      throw new Error('Oops internal detail that should NOT leak')
    })

    const res = await app.request('/crash')

    expect(res.status).toBe(500)
    const body = (await res.json()) as {
      error: { code: string; message: string; status: number }
    }
    expect(body.error.status).toBe(500)
    expect(body.error.message).toBe('Internal server error')
    expect(body.error.code).toBe(ERROR_CODE.InternalError)
    expect(JSON.stringify(body)).not.toContain('Oops')
  })
})

describe('global error handler — HTTPException', () => {
  it('maps a Hono HTTPException to the standard envelope instead of a generic 500', async () => {
    // Before this branch existed the export timeout surfaced as a 500 logged as
    // "unhandled server error", which is the opposite of what a timeout is.
    const { app, logger } = makeApp()
    app.get('/test', () => {
      throw new HTTPException(504, { message: 'Izvoz je predugo trajao.' })
    })

    const res = await app.request('/test')

    expect(res.status).toBe(504)
    expect(await res.json()).toEqual({
      error: {
        code: ERROR_CODE.ServiceUnavailable,
        message: 'Izvoz je predugo trajao.',
        status: 504,
      },
    })
    expect(logger.warn).toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('carries the request id into the error log line so it ties back to the request', async () => {
    const { app, logger } = makeApp()
    app.use('*', requestId())
    app.get('/test', () => {
      throw new AppError(ERROR_CODE.NotFound, 404, 'Item missing')
    })

    const res = await app.request('/test')

    const [payload] = (logger.warn as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      Record<string, unknown>,
    ]
    expect(payload['requestId']).toBe(res.headers.get('X-Request-Id'))
    expect(typeof payload['requestId']).toBe('string')
  })
})
