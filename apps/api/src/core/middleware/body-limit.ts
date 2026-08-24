import { MAX_FILE_SIZE_MB } from '@mr/shared'
import { bodyLimit } from 'hono/body-limit'
import type { MiddlewareHandler } from 'hono'

import { PayloadTooLargeError } from '../errors/domain-errors.js'

const MB = 1024 * 1024

// JSON/API bodies are small; 2 MB leaves generous room for large report documents.
const DEFAULT_MAX_BODY_BYTES = 2 * MB

// Multipart uploads: a batch of photos or one max-size file + form overhead.
// Images are recompressed server-side after this gate, so the window is short.
const UPLOAD_MAX_BODY_BYTES = (MAX_FILE_SIZE_MB * 5 + 5) * MB

const UPLOAD_PATHS = new Set(['/api/attachments/upload', '/api/claim-reports/images'])

// Dynamic upload paths:
//   POST /api/client-submissions/<uuid>/attachments — portal ticket files
//   POST /api/intake-orders/<uuid>/photos — the serviser's tablet, one photo per request.
// The tablet compresses before sending (~400 KB), but `compressImage` hands back the ORIGINAL file
// whenever the browser cannot decode it — which is precisely HEIC straight off an iPad camera, at
// 6–10 MB. Under the default limit that 413s before the service is reached, and the serviser sees
// a photo stuck on "! PONOVI" forever.
const UPLOAD_PATH_PATTERNS = [
  /^\/api\/client-submissions\/[^/]+\/attachments$/,
  /^\/api\/intake-orders\/[^/]+\/photos$/,
  // The quote is a file the serviser made in another program — a scanned or exported A4 PDF is
  // routinely 2-8 MB, and nothing compresses it on the way in. Left out of this list it fell to
  // the 2 MB default and answered 413 with no size in the message, while the module documents 25.
  /^\/api\/intake-orders\/[^/]+\/quote$/,
  // The chat sends a message and its photos through ONE route, so this entry alone would raise the
  // module's most common POST — an ordinary text message — to the upload window. `usesUploadLimit`
  // is what keeps that from happening: the path qualifies, the body still has to be multipart.
  /^\/api\/chat\/conversations\/[^/]+\/messages$/,
]

/** Exported for the regression test — a path silently falling to the 2 MB default is invisible. */
export function isUploadPath(path: string): boolean {
  return UPLOAD_PATHS.has(path) || UPLOAD_PATH_PATTERNS.some((pattern) => pattern.test(path))
}

/**
 * Both halves must hold: an upload path AND a multipart body.
 *
 * The path alone used to be the whole rule, which worked while every upload route did nothing else.
 * The chat broke that — text and files share one route — and widening by path would have handed the
 * 130 MB window to every ordinary message, undoing the guard this file exists for.
 *
 * It is not a security boundary on its own (a caller can claim any content-type, exactly as they
 * can on `/api/attachments/upload`); it is what keeps the small default in place for the traffic
 * that is not carrying a file.
 */
export function usesUploadLimit(path: string, contentType: string | undefined): boolean {
  return isUploadPath(path) && (contentType ?? '').toLowerCase().startsWith('multipart/form-data')
}

function limitWith(maxSize: number): MiddlewareHandler {
  return bodyLimit({
    maxSize,
    onError: () => {
      // Global error handler renders the standard { error } shape for 413.
      throw new PayloadTooLargeError('Request body too large')
    },
  })
}

const defaultLimit = limitWith(DEFAULT_MAX_BODY_BYTES)
const uploadLimit = limitWith(UPLOAD_MAX_BODY_BYTES)

/**
 * Caps request-body size BEFORE anything buffers it (the per-file/total MB
 * checks in services run after the body is already in memory — without this
 * gate any authenticated client could exhaust the heap with one huge POST).
 */
export const requestBodyLimit: MiddlewareHandler = (c, next) => {
  const limiter = usesUploadLimit(c.req.path, c.req.header('content-type'))
    ? uploadLimit
    : defaultLimit
  return limiter(c, next)
}
