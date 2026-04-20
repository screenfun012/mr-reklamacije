import type { Logger } from '@mr/logger'
import { ERROR_CODE } from '@mr/shared'
import type { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import { AppError } from '../errors/app-error.js'

/**
 * Registers global error handler via app.onError().
 *
 * AppError → JSON { error: { code, message, status } } with the
 * error's own status code.
 *
 * Anything else → 500 with generic message, full error logged server-side.
 * Detail leaks are suppressed to avoid exposing internals to clients.
 */
export function registerGlobalErrorHandler(app: Hono, logger: Logger): void {
  app.onError((err, c) => {
    if (err instanceof AppError) {
      logger.warn(
        { code: err.code, status: err.status, message: err.message },
        'handled application error',
      )
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
            status: err.status,
          },
        },
        err.status as ContentfulStatusCode,
      )
    }

    logger.error(
      {
        err:
          err instanceof Error
            ? { name: err.name, message: err.message, stack: err.stack }
            : err,
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
