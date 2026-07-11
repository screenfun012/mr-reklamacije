/**
 * One-off migration: copy every attachment file from the local UPLOAD_DIR volume to
 * the S3/MinIO bucket, preserving keys. Run once during the object-storage cutover
 * (docs/17) while the volume is still attached — before removing the volume.
 *
 * DRY RUN by default (lists what would copy). Apply with:
 *   pnpm --filter api migrate-attachments-to-s3 -- --apply
 *
 * Idempotent: skips objects already in the bucket with a matching size, so it can be
 * re-run safely. Reads UPLOAD_DIR + S3_* from apps/api/.env (dev) or the process env
 * (Railway one-off shell).
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Tolerate a missing .env — in production config comes from the process env.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))
} catch {
  // no .env file — fine
}

import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const apply = process.argv.includes('--apply')

const EXTENSION_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.length === 0) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return value
}

async function* walkFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walkFiles(full)
    } else if (entry.isFile()) {
      yield full
    }
  }
}

async function objectSize(client: S3Client, bucket: string, key: string): Promise<number | null> {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return head.ContentLength ?? null
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  const uploadDir = path.resolve(requireEnv('UPLOAD_DIR'))
  const bucket = requireEnv('S3_BUCKET')
  const client = new S3Client({
    endpoint: requireEnv('S3_ENDPOINT'),
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: {
      accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
    },
  })

  console.log(`${apply ? 'MIGRATING' : 'DRY RUN'}: ${uploadDir} -> bucket "${bucket}"`)

  let copied = 0
  let skipped = 0
  let failed = 0

  for await (const filePath of walkFiles(uploadDir)) {
    const key = path.relative(uploadDir, filePath).split(path.sep).join('/')
    const localSize = (await stat(filePath)).size

    if ((await objectSize(client, bucket, key)) === localSize) {
      skipped++
      continue
    }

    if (!apply) {
      console.log(`  would copy ${key} (${localSize} B)`)
      copied++
      continue
    }

    try {
      const data = await readFile(filePath)
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: data,
          ContentType:
            EXTENSION_MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
          ContentLength: data.byteLength,
        }),
      )
      copied++
      console.log(`  copied ${key} (${localSize} B)`)
    } catch (error) {
      failed++
      console.error(`  FAILED ${key}:`, error)
    }
  }

  console.log(
    `\nDone. ${apply ? 'copied' : 'to copy'}: ${copied}, skipped (already present): ${skipped}, failed: ${failed}`,
  )
  if (failed > 0) {
    process.exit(1)
  }
}

void main()
