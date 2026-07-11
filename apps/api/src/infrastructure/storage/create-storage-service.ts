import { InternalError } from '../../core/errors/domain-errors.js'
import { LocalVolumeStorageService } from './local-volume-storage.js'
import { S3StorageService } from './s3-storage.js'
import type { StorageService } from './storage.interface.js'

export interface StorageEnv {
  readonly UPLOAD_DIR: string
  readonly S3_ENDPOINT?: string | undefined
  readonly S3_BUCKET?: string | undefined
  readonly S3_ACCESS_KEY_ID?: string | undefined
  readonly S3_SECRET_ACCESS_KEY?: string | undefined
  readonly S3_REGION: string
  readonly S3_FORCE_PATH_STYLE: boolean
}

/**
 * Picks the attachment storage backend from config: S3 (MinIO in production) when
 * S3_BUCKET is set, otherwise the local filesystem (dev/CI). Fails fast at boot when
 * S3 is half-configured, so a misconfigured deploy never silently loses uploads.
 */
export function createStorageService(env: StorageEnv): StorageService {
  const anyS3Set =
    env.S3_ENDPOINT !== undefined ||
    env.S3_BUCKET !== undefined ||
    env.S3_ACCESS_KEY_ID !== undefined ||
    env.S3_SECRET_ACCESS_KEY !== undefined

  if (!anyS3Set) {
    return new LocalVolumeStorageService(env.UPLOAD_DIR)
  }

  // Symmetric fail-fast: any S3 var set means S3 is intended, so require ALL of them.
  // A partial set (e.g. bucket missing during cutover) must NOT fall back to the local
  // filesystem — after the volume is removed that is the container's ephemeral disk, and
  // uploads would silently vanish on the next redeploy.
  if (
    env.S3_ENDPOINT === undefined ||
    env.S3_BUCKET === undefined ||
    env.S3_ACCESS_KEY_ID === undefined ||
    env.S3_SECRET_ACCESS_KEY === undefined
  ) {
    throw new InternalError(
      'Partial S3 configuration: set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY together, or none of them (to use the local filesystem)',
    )
  }

  return new S3StorageService({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  })
}
