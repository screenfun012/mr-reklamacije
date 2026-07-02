import type { Logger } from '@mr/logger'
import { ERROR_CODE } from '@mr/shared'
import type { Env, Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'

import { AppError } from '../errors/app-error.js'
import { MrKeyConflictError } from '../errors/domain-errors.js'

/**
 * Registers global error handler via app.onError().
 *
 * AppError → JSON { error: { code, message, status } } with the
 * error's own status code.
 *
 * Anything else → 500 with generic message, full error logged server-side.
 * Detail leaks are suppressed to avoid exposing internals to clients.
 */
export function registerGlobalErrorHandler<E extends Env>(app: Hono<E>, logger: Logger): void {
  app.onError((err, c) => {
    if (err instanceof ZodError) {
      logger.warn({ issues: err.issues }, 'validation error')
      return c.json(
        {
          error: {
            code: ERROR_CODE.ValidationError,
            message: 'Validation failed',
            status: 400,
          },
        },
        400,
      )
    }

    if (err instanceof AppError) {
      // `err` key → pino's error serializer, so a carried cause (the real
      // underlying failure) lands in the log with its message + stack.
      logger.warn(
        {
          code: err.code,
          status: err.status,
          message: err.message,
          ...(err.cause !== undefined ? { err: err.cause } : {}),
        },
        'handled application error',
      )

      const errorBody: {
        code: string
        message: string
        status: number
        details?: unknown
      } = {
        code: err.code,
        message: err.message,
        status: err.status,
      }

      if (err instanceof MrKeyConflictError) {
        errorBody.details = err.existingClaim
      }

      return c.json({ error: errorBody }, err.status as ContentfulStatusCode)
    }

    logger.error(
      {
        err:
          err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
      },
      'unhandled server error',
    )

    return c.json(
      {
        error: {
          code: ERROR_CODE.InternalError,
          message: 'Internal server error',
          status: 500,
        },
      },
      500,
    )
  })
}
