import { createReadStream } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

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

  async readStream(
    relativePath: string,
  ): Promise<{ stream: ReadableStream<Uint8Array>; size: number }> {
    const absolutePath = resolvePath(this.rootDir, relativePath)
    const fileStat = await stat(absolutePath)
    const nodeStream = createReadStream(absolutePath)
    return {
      stream: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
      size: fileStat.size,
    }
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
