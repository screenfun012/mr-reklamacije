import { HTTPException } from 'hono/http-exception'
import { timeout } from 'hono/timeout'
import type { MiddlewareHandler } from 'hono'

/**
 * Upper bound on a document export.
 *
 * Chromium renders and ExcelJS workbooks are the only requests here that can run
 * for seconds rather than milliseconds, and both sit behind a queue — so a stuck
 * one holds a slot and the next caller just waits, with nothing on the server
 * ever giving up. Cloudflare cuts the connection at ~100 s and shows its own
 * error page, which tells nobody anything; failing first, in our own envelope
 * and our own log line, is the difference between "the button is dead" and a
 * request id to grep for.
 *
 * Generous on purpose: a large report legitimately takes a while, and this is a
 * backstop, not a performance target.
 */
const EXPORT_TIMEOUT_MS = 60_000

const EXPORT_TIMEOUT_MESSAGE =
  'Izvoz je predugo trajao i prekinut je. Pokušajte ponovo; ako se ponovi, javite se administratoru.'

/**
 * Fails an export that outlives EXPORT_TIMEOUT_MS with 504.
 *
 * The global error handler maps `HTTPException` into the standard error
 * envelope, so this reaches the client in the same shape as every other error.
 */
export const exportTimeout: MiddlewareHandler = timeout(
  EXPORT_TIMEOUT_MS,
  () => new HTTPException(504, { message: EXPORT_TIMEOUT_MESSAGE }),
)
