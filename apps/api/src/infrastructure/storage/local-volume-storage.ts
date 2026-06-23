import { createHmac, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { StorageService, UploadOpts } from './storage.interface.js'

function resolvePath(rootDir: string, relativePath: string): string {
  const normalizedRoot = path.resolve(rootDir)
  const resolved = path.resolve(normalizedRoot, relativePath)
  if (!resolved.startsWith(`${normalizedRoot}${path.sep}`) && resolved !== normalizedRoot) {
    throw new Error('Path traversal detected')
  }
  return resolved
}

export class LocalVolumeStorageService implements StorageService {
  constructor(private readonly rootDir: string) {}

  async upload(opts: UploadOpts): Promise<{ path: string; size: number; mimeType: string }> {
    const absolutePath = resolvePath(this.rootDir, opts.path)
    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, opts.data)

    return {
      path: opts.path,
      size: opts.data.byteLength,
      mimeType: opts.mimeType,
    }
  }

  async read(relativePath: string): Promise<Buffer> {
    return readFile(resolvePath(this.rootDir, relativePath))
  }

  async delete(relativePath: string): Promise<void> {
    await rm(resolvePath(this.rootDir, relativePath), { force: true })
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await stat(resolvePath(this.rootDir, relativePath))
      return true
    } catch {
      return false
    }
  }

  async getMetadata(relativePath: string): Promise<{ size: number }> {
    const fileStat = await stat(resolvePath(this.rootDir, relativePath))
    return { size: fileStat.size }
  }
}

const DEFAULT_SIGNED_URL_TTL_SECONDS = 300

export function createSignedAttachmentToken(
  attachmentId: string,
  expiresAtEpochSeconds: number,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(`${attachmentId}:${expiresAtEpochSeconds}`)
    .digest('hex')
}

export function verifySignedAttachmentToken(
  attachmentId: string,
  expiresAtEpochSeconds: number,
  token: string,
  secret: string,
): boolean {
  if (
    !Number.isFinite(expiresAtEpochSeconds) ||
    expiresAtEpochSeconds <= Math.floor(Date.now() / 1000)
  ) {
    return false
  }

  const expected = createSignedAttachmentToken(attachmentId, expiresAtEpochSeconds, secret)
  const expectedBuffer = Buffer.from(expected)
  const tokenBuffer = Buffer.from(token)

  if (expectedBuffer.length !== tokenBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, tokenBuffer)
}

export function buildSignedAttachmentUrl(
  apiBaseUrl: string,
  attachmentId: string,
  secret: string,
  expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
): { url: string; expiresAt: string } {
  const expiresAtEpochSeconds = Math.floor(Date.now() / 1000) + expiresInSeconds
  const sig = createSignedAttachmentToken(attachmentId, expiresAtEpochSeconds, secret)
  const url = new URL('/api/attachments/raw', apiBaseUrl)
  url.searchParams.set('id', attachmentId)
  url.searchParams.set('exp', String(expiresAtEpochSeconds))
  url.searchParams.set('sig', sig)

  return {
    url: url.toString(),
    expiresAt: new Date(expiresAtEpochSeconds * 1000).toISOString(),
  }
}
