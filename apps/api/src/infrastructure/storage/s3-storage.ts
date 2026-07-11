import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

import { InternalError } from '../../core/errors/domain-errors.js'
import type { FileMetadata, StorageService, UploadOpts } from './storage.interface.js'

export interface S3StorageConfig {
  readonly endpoint: string
  readonly region: string
  readonly bucket: string
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly forcePathStyle: boolean
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  if ('name' in error && (error.name === 'NotFound' || error.name === 'NoSuchKey')) {
    return true
  }
  const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
  return metadata?.httpStatusCode === 404
}

/**
 * S3-compatible attachment storage — MinIO on Railway in production, and works with
 * R2/S3 unchanged. Drop-in for {@link LocalVolumeStorageService}: same paths, same
 * streamed downloads (the signed-URL auth layer is unchanged). Selected in the
 * container when the S3_* env vars are set; otherwise the local filesystem is used.
 */
export class S3StorageService implements StorageService {
  private readonly client: S3Client
  private readonly bucket: string

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
  }

  async upload(opts: UploadOpts): Promise<{ path: string; size: number; mimeType: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: opts.path,
        Body: opts.data,
        ContentType: opts.mimeType,
        ContentLength: opts.data.byteLength,
      }),
    )
    return { path: opts.path, size: opts.data.byteLength, mimeType: opts.mimeType }
  }

  async read(path: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: path }),
    )
    if (response.Body === undefined) {
      throw new InternalError(`S3 object has no body: ${path}`)
    }
    return Buffer.from(await response.Body.transformToByteArray())
  }

  async readStream(path: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number }> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: path }),
    )
    if (response.Body === undefined) {
      throw new InternalError(`S3 object has no body: ${path}`)
    }
    return {
      stream: response.Body.transformToWebStream() as ReadableStream<Uint8Array>,
      size: response.ContentLength ?? 0,
    }
  }

  async delete(path: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: path }))
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: path }))
      return true
    } catch (error) {
      if (isNotFoundError(error)) {
        return false
      }
      throw error
    }
  }

  async getMetadata(path: string): Promise<FileMetadata> {
    const response = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: path }),
    )
    return {
      size: response.ContentLength ?? 0,
      ...(response.ContentType !== undefined ? { mimeType: response.ContentType } : {}),
    }
  }
}
