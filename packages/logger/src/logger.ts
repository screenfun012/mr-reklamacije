import pino from 'pino'
import type { DestinationStream, Logger } from 'pino'

export type { Logger }

/**
 * Creates a Pino logger with the given logical name (`name` is included on every log line).
 *
 * Reads `process.env.LOG_LEVEL` and `process.env.NODE_ENV` on each call — not at module load —
 * so tests and callers can change env between `createLogger()` invocations.
 *
 * Optional `destination` defaults to stdout (`fd 1`); pass a stream in tests or when writing
 * to a file. Phase 0 uses JSON only (no pino-pretty transport in this package).
 */
export function createLogger(name: string, destination?: DestinationStream): Logger {
  const level =
    process.env['LOG_LEVEL'] ??
    (process.env['NODE_ENV'] === 'development' ? 'debug' : 'info')

  return pino({ name, level }, destination ?? pino.destination(1))
}
