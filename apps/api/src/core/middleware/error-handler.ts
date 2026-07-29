import type { Logger } from '@mr/logger'
import { ERROR_CODE, type ErrorCode } from '@mr/shared'
import type { Context, Env, Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'

import { AppError } from '../errors/app-error.js'
import { ConflictError, MrKeyConflictError } from '../errors/domain-errors.js'

/** Error code for the statuses Hono's own middleware raises. */
const HTTP_EXCEPTION_CODES: Readonly<Record<number, ErrorCode>> = {
  504: ERROR_CODE.ServiceUnavailable,
}

/**
 * Ties every log line for one request to the request-logger's line for it, so a
 * report of "it broke around three" resolves to one traceable request instead of
 * a scan through everything that happened that minute. Echoed to the caller as
 * `X-Request-Id` by the requestId middleware.
 */
function requestIdOf<E extends Env>(c: Context<E>): string | undefined {
  const value: unknown = c.get('requestId')
  return typeof value === 'string' ? value : undefined
}

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
    const requestId = requestIdOf(c)

    // Hono's own middleware (today: the export timeout) signals with
    // HTTPException. Without this branch it fell through to the catch-all below
    // and a 504 was reported to the client as a 500 and logged as unhandled.
    if (err instanceof HTTPException) {
      logger.warn({ requestId, status: err.status, message: err.message }, 'http exception')
      return c.json(
        {
          error: {
            code: HTTP_EXCEPTION_CODES[err.status] ?? ERROR_CODE.InternalError,
            message: err.message,
            status: err.status,
          },
        },
        err.status,
      )
    }

    if (err instanceof ZodError) {
      logger.warn({ requestId, issues: err.issues }, 'validation error')
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
          requestId,
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
      } else if (err instanceof ConflictError && err.details !== undefined) {
        errorBody.details = err.details
      }

      return c.json({ error: errorBody }, err.status as ContentfulStatusCode)
    }

    logger.error(
      {
        requestId,
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
