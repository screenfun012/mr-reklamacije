import type { Context } from 'hono'

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

/** Parses the shared `?disposition` / `?variant` query flags of an attachment download request. */
export function parseAttachmentDownloadRequest(c: Context): {
  disposition: 'inline' | 'attachment'
  variant: 'original' | 'thumbnail'
} {
  return {
    disposition: c.req.query('disposition') === 'attachment' ? 'attachment' : 'inline',
    variant: c.req.query('variant') === 'thumbnail' ? 'thumbnail' : 'original',
  }
}

interface CachedAttachmentDownloadMeta {
  readonly storagePath: string
  readonly mimeType: string
  readonly fileName: string
  readonly etag?: string | null
}

/**
 * Serves an access-checked attachment download with the cache-correct policy shared by the claim-
 * and submission-attachment surfaces: inline views (content-addressed, immutable) are browser-
 * cached and revalidated via ETag with a body-less 304 short-circuit; `attachment` (save-to-disk)
 * stays no-store. The caller supplies the resolved `meta` and the storage-stream opener.
 */
export async function serveCachedAttachmentDownload(
  c: Context,
  meta: CachedAttachmentDownloadMeta,
  opts: {
    disposition: 'inline' | 'attachment'
    openStream: (
      storagePath: string,
    ) => Promise<{ stream: ReadableStream<Uint8Array>; size: number }>
  },
): Promise<Response> {
  const cacheable = opts.disposition === 'inline'
  const cacheControl = cacheable ? 'private, max-age=86400' : 'private, no-store'
  const etag = meta.etag ?? null

  if (cacheable && etag !== null && c.req.header('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, 'Cache-Control': cacheControl },
    })
  }

  const { stream, size } = await opts.openStream(meta.storagePath)

  return buildAttachmentDownloadResponse({
    stream,
    size,
    mimeType: meta.mimeType,
    fileName: meta.fileName,
    disposition: opts.disposition,
    cacheControl,
    etag: cacheable ? etag : null,
  })
}
