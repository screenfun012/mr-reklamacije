import type { Logger } from '@mr/logger'
import { ClaimKind, ERROR_CODE } from '@mr/shared'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { AppError } from '../core/errors/app-error.js'
import { MrKeyConflictError } from '../core/errors/domain-errors.js'
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
