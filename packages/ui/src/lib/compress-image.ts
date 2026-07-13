export interface CompressImageOptions {
  /** Longest edge in px the image is scaled down to (never upscaled). */
  maxEdge?: number
  /** JPEG quality 0–1. */
  quality?: number
}

/**
 * Client-side image downscale + recompress BEFORE upload, so a phone's 8 MB photo
 * goes over the wire as a few hundred KB. Uses only the native Canvas API (no
 * dependency) and respects EXIF orientation via `createImageBitmap`.
 *
 * Graceful by design — returns the ORIGINAL file unchanged when: it is not an
 * image, the browser can't decode it (e.g. HEIC), there's no canvas, or the
 * result wouldn't be smaller. The server still recompresses for storage, so a
 * pass-through here only costs upload bandwidth, never correctness.
 */
export async function compressImage(file: File, options: CompressImageOptions = {}): Promise<File> {
  const maxEdge = options.maxEdge ?? 2048
  const quality = options.quality ?? 0.8

  if (!file.type.startsWith('image/')) return file
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    try {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
      const width = Math.round(bitmap.width * scale)
      const height = Math.round(bitmap.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (ctx === null) return file
      ctx.drawImage(bitmap, 0, 0, width, height)

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/jpeg', quality)
      })
      // Don't inflate an already-small image (e.g. a tiny PNG re-encoded to JPEG).
      if (blob === null || blob.size >= file.size) return file

      const baseName = file.name.replace(/\.[^.]+$/, '')
      return new File([blob], `${baseName}.jpg`, {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      })
    } finally {
      bitmap.close()
    }
  } catch {
    // Undecodable format (HEIC), encode failure, or an unsupported browser:
    // fall back to the original — the server recompresses on receipt.
    return file
  }
}
