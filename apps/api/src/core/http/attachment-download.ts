export function encodeContentDisposition(
  fileName: string,
  disposition: 'inline' | 'attachment',
): string {
  const safeName = fileName.replace(/[^\w.\- ()[\]]+/g, '_')
  return `${disposition}; filename="${safeName}"`
}

export interface AttachmentDownloadResponseOptions {
  readonly stream: ReadableStream<Uint8Array>
  readonly size: number
  readonly mimeType: string
  readonly fileName: string
  readonly disposition: 'inline' | 'attachment'
  readonly cacheControl: string
  readonly etag?: string | null
}

/**
 * Builds the streamed download Response with the standard security headers (nosniff +
 * sanitized Content-Disposition). Shared by claim- and submission-attachment serve paths so the
 * one hardened header set is used everywhere.
 */
export function buildAttachmentDownloadResponse(opts: AttachmentDownloadResponseOptions): Response {
  return new Response(opts.stream, {
    headers: {
      'Content-Type': opts.mimeType,
      'Content-Length': String(opts.size),
      'Content-Disposition': encodeContentDisposition(opts.fileName, opts.disposition),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': opts.cacheControl,
      ...(opts.etag ? { ETag: opts.etag } : {}),
    },
  })
}
