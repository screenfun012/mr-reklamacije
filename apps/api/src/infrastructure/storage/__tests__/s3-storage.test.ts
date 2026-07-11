import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { mockClient } from 'aws-sdk-client-mock'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { S3StorageService } from '../s3-storage.js'

const s3Mock = mockClient(S3Client)

function makeStorage(): S3StorageService {
  return new S3StorageService({
    endpoint: 'http://minio:9000',
    region: 'us-east-1',
    bucket: 'attachments',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
    forcePathStyle: true,
  })
}

function notFoundError(): Error {
  const error = new Error('Not Found')
  error.name = 'NotFound'
  return error
}

describe('S3StorageService', () => {
  beforeEach(() => {
    s3Mock.reset()
  })

  afterAll(() => {
    s3Mock.restore()
  })

  it('uploads to the configured bucket with the content type', async () => {
    s3Mock.on(PutObjectCommand).resolves({})

    const result = await makeStorage().upload({
      path: 'emotive/2026/claim/att.jpg',
      data: Buffer.from('hello'),
      mimeType: 'image/jpeg',
    })

    expect(result).toEqual({ path: 'emotive/2026/claim/att.jpg', size: 5, mimeType: 'image/jpeg' })
    const input = s3Mock.commandCalls(PutObjectCommand)[0]?.args[0]?.input
    expect(input?.Bucket).toBe('attachments')
    expect(input?.Key).toBe('emotive/2026/claim/att.jpg')
    expect(input?.ContentType).toBe('image/jpeg')
  })

  it('reads an object body as a Buffer', async () => {
    const body = { transformToByteArray: async () => new Uint8Array([1, 2, 3]) }
    s3Mock.on(GetObjectCommand).resolves({ Body: body as never, ContentLength: 3 })

    const buffer = await makeStorage().read('a/b.jpg')
    expect(buffer.equals(Buffer.from([1, 2, 3]))).toBe(true)
  })

  it('streams an object with its content length as size', async () => {
    const webStream = new ReadableStream<Uint8Array>()
    const body = { transformToWebStream: () => webStream }
    s3Mock.on(GetObjectCommand).resolves({ Body: body as never, ContentLength: 42 })

    const result = await makeStorage().readStream('a/b.jpg')
    expect(result.stream).toBe(webStream)
    expect(result.size).toBe(42)
  })

  it('throws when a read returns no body', async () => {
    s3Mock.on(GetObjectCommand).resolves({})
    await expect(makeStorage().read('a/b.jpg')).rejects.toThrow(/no body/)
  })

  it('exists() is true when the object is found', async () => {
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 10 })
    expect(await makeStorage().exists('a/b.jpg')).toBe(true)
  })

  it('exists() is false on a not-found error', async () => {
    s3Mock.on(HeadObjectCommand).rejects(notFoundError())
    expect(await makeStorage().exists('missing.jpg')).toBe(false)
  })

  it('exists() rethrows non-not-found errors (never swallows)', async () => {
    s3Mock.on(HeadObjectCommand).rejects(new Error('network down'))
    await expect(makeStorage().exists('a/b.jpg')).rejects.toThrow('network down')
  })

  it('getMetadata returns the size and mime type', async () => {
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 100, ContentType: 'image/png' })
    expect(await makeStorage().getMetadata('a/b.jpg')).toEqual({ size: 100, mimeType: 'image/png' })
  })

  it('deletes an object by bucket and key', async () => {
    s3Mock.on(DeleteObjectCommand).resolves({})

    await makeStorage().delete('a/b.jpg')

    const input = s3Mock.commandCalls(DeleteObjectCommand)[0]?.args[0]?.input
    expect(input?.Bucket).toBe('attachments')
    expect(input?.Key).toBe('a/b.jpg')
  })
})
