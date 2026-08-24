export interface AttachmentDownloadMeta {
  readonly storagePath: string
  readonly mimeType: string
  readonly fileName: string
  readonly etag: string | null
}

/**
 * Resolves the storage path, MIME type, and revalidation ETag for a download, honoring the
 * `thumbnail` variant. Shared by the claim- and submission-attachment download-meta paths so the
 * cache-correctness logic (thumbnail JPEG mime + content-hash ETag with the `-thumb` suffix) is
 * identical on both surfaces — divergence would silently break caching on one of them.
 */
export function resolveAttachmentDownloadMeta(
  row: {
    readonly storagePath: string
    readonly mimeType: string
    readonly fileName: string
    readonly thumbnailPath: string | null
    readonly contentSha256: string | null
  },
  variant: 'original' | 'thumbnail',
): AttachmentDownloadMeta {
  const thumbnailPath = variant === 'thumbnail' ? row.thumbnailPath : null
  return {
    storagePath: thumbnailPath ?? row.storagePath,
    // Thumbnails are always generated as JPEG (see generateImageThumbnail).
    mimeType: thumbnailPath !== null ? 'image/jpeg' : row.mimeType,
    fileName: row.fileName,
    etag:
      row.contentSha256 === null
        ? null
        : `"${row.contentSha256}${thumbnailPath !== null ? '-thumb' : ''}"`,
  }
}
