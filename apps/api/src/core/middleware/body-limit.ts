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
  const limiter = UPLOAD_PATHS.has(c.req.path) ? uploadLimit : defaultLimit
  return limiter(c, next)
}
