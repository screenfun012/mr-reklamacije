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
/**
 * Fields that must never reach a log line, wherever they appear.
 *
 * ⚠ `endpoint` is here because of push: a failed delivery logs the subscription it failed to reach,
 * and that string is a named worker's device address at Google or Apple. It identifies the person
 * and the device, it is stable for as long as they keep the app, and Railway keeps logs for a week
 * where anybody with dashboard access can read them.
 *
 * The rest are the usual ones. `authorization` and `cookie` would carry a live session; `password`
 * and `token` need no explanation. They are listed even where nothing logs them today, because the
 * point of a redaction list is to be already there when somebody adds the line that would.
 */
const REDACTED_PATHS = [
  'endpoint',
  '*.endpoint',
  'subscription.endpoint',
  'password',
  '*.password',
  'token',
  '*.token',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'p256dh',
  '*.p256dh',
  'auth',
  '*.auth',
]

export function createLogger(name: string, destination?: DestinationStream): Logger {
  const level =
    process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'development' ? 'debug' : 'info')

  return pino({ name, level, redact: REDACTED_PATHS }, destination ?? pino.destination(1))
}
