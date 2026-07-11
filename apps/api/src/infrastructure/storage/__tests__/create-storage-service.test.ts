import { describe, expect, it } from 'vitest'

import { createStorageService, type StorageEnv } from '../create-storage-service.js'
import { LocalVolumeStorageService } from '../local-volume-storage.js'
import { S3StorageService } from '../s3-storage.js'

const base: StorageEnv = {
  UPLOAD_DIR: '/tmp/uploads',
  S3_REGION: 'us-east-1',
  S3_FORCE_PATH_STYLE: true,
}

const fullS3: StorageEnv = {
  ...base,
  S3_ENDPOINT: 'http://minio:9000',
  S3_BUCKET: 'attachments',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
}

describe('createStorageService', () => {
  it('uses the local filesystem when no S3 vars are set', () => {
    expect(createStorageService(base)).toBeInstanceOf(LocalVolumeStorageService)
  })

  it('uses S3 when all S3 vars are set', () => {
    expect(createStorageService(fullS3)).toBeInstanceOf(S3StorageService)
  })

  it('fails fast on partial S3 config (bucket set, credentials missing)', () => {
    expect(() => createStorageService({ ...base, S3_BUCKET: 'attachments' })).toThrow(/Partial S3/)
  })

  it('fails fast on partial S3 config (endpoint + credentials set, bucket missing)', () => {
    expect(() =>
      createStorageService({
        ...base,
        S3_ENDPOINT: 'http://minio:9000',
        S3_ACCESS_KEY_ID: 'key',
        S3_SECRET_ACCESS_KEY: 'secret',
      }),
    ).toThrow(/Partial S3/)
  })
})
