/**
 * Read-only integrity check: every attachment ROW in the database should point
 * at an object that actually EXISTS in storage (MinIO/S3 in production, the local
 * volume in dev). A row without its object is an invisible hole — the claim opens
 * fine and the photo is simply blank.
 *
 * This is the check the database/bucket split makes necessary: the two are backed
 * up on independent schedules, so a restore can pair a database with an older
 * bucket and leave rows referencing objects that were never in it (docs/11 restore
 * order, docs/22 §1.3). Run this AFTER any restore to prove it worked — and run it
 * now to learn whether any hole exists today.
 *
 * NEVER writes. No --apply, no flags. Exit code is 1 when holes are found, so it
 * doubles as a post-restore gate.
 *
 * Reads DATABASE_URL plus the S3 / UPLOAD_DIR config from apps/api/.env (dev) or
 * the process env (Railway one-off shell):
 *   pnpm --filter api check-attachment-integrity
 */
import { fileURLToPath } from 'node:url'

// Tolerate a missing .env — in production config comes from the process env.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))
} catch {
  // no .env file — fine
}

import { schema } from '@mr/db'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import { createStorageService } from '../src/infrastructure/storage/create-storage-service.js'
import type { StorageService } from '../src/infrastructure/storage/storage.interface.js'

interface MissingObject {
  attachmentId: string
  fileName: string
  kind: 'file' | 'thumbnail'
  storagePath: string
  claim: string
}

function claimRef(row: {
  claimKind: string | null
  emotiveClaimId: string | null
  domaceClaimId: string | null
  clientSubmissionId: string | null
}): string {
  if (row.emotiveClaimId !== null) return `emotive:${row.emotiveClaimId}`
  if (row.domaceClaimId !== null) return `domace:${row.domaceClaimId}`
  if (row.clientSubmissionId !== null) return `submission:${row.clientSubmissionId}`
  return 'unlinked'
}

function buildStorage(): StorageService {
  // Mirror the runtime's own backend selection so this checks the SAME store the
  // app reads from — never a guess about where files live.
  const forcePathStyle = process.env['S3_FORCE_PATH_STYLE']
  return createStorageService({
    UPLOAD_DIR: process.env['UPLOAD_DIR'] ?? './data/uploads',
    S3_ENDPOINT: process.env['S3_ENDPOINT'],
    S3_BUCKET: process.env['S3_BUCKET'],
    S3_ACCESS_KEY_ID: process.env['S3_ACCESS_KEY_ID'],
    S3_SECRET_ACCESS_KEY: process.env['S3_SECRET_ACCESS_KEY'],
    S3_REGION: process.env['S3_REGION'] ?? 'us-east-1',
    S3_FORCE_PATH_STYLE: forcePathStyle === undefined ? true : forcePathStyle !== 'false',
  })
}

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL']
  if (databaseUrl === undefined) {
    console.error('DATABASE_URL is required (apps/api/.env in dev, service env in production)')
    process.exit(1)
  }

  const storage = buildStorage()
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 4 })
  const db = drizzle(pool, { schema })

  try {
    const rows = await db
      .select({
        id: schema.attachments.id,
        fileName: schema.attachments.fileName,
        storagePath: schema.attachments.storagePath,
        thumbnailPath: schema.attachments.thumbnailPath,
        claimKind: schema.attachments.claimKind,
        emotiveClaimId: schema.attachments.emotiveClaimId,
        domaceClaimId: schema.attachments.domaceClaimId,
        clientSubmissionId: schema.attachments.clientSubmissionId,
      })
      .from(schema.attachments)

    console.log(`Checking ${rows.length} attachment rows against storage…`)

    const missing: MissingObject[] = []
    let objectsChecked = 0

    for (const row of rows) {
      const claim = claimRef(row)

      objectsChecked += 1
      if (!(await storage.exists(row.storagePath))) {
        missing.push({
          attachmentId: row.id,
          fileName: row.fileName,
          kind: 'file',
          storagePath: row.storagePath,
          claim,
        })
      }

      // A missing thumbnail is cosmetic (the grid falls back to the full image),
      // but worth listing separately so a restore mismatch is not mistaken for one.
      if (row.thumbnailPath !== null) {
        objectsChecked += 1
        if (!(await storage.exists(row.thumbnailPath))) {
          missing.push({
            attachmentId: row.id,
            fileName: row.fileName,
            kind: 'thumbnail',
            storagePath: row.thumbnailPath,
            claim,
          })
        }
      }
    }

    const missingFiles = missing.filter((m) => m.kind === 'file')
    const missingThumbnails = missing.filter((m) => m.kind === 'thumbnail')

    console.log(
      `\nChecked ${objectsChecked} objects for ${rows.length} rows: ` +
        `${missingFiles.length} missing files, ${missingThumbnails.length} missing thumbnails.`,
    )

    for (const m of missing) {
      console.log(`  MISSING ${m.kind}  ${m.storagePath}  (${m.fileName}, claim ${m.claim})`)
    }

    if (missingFiles.length > 0) {
      console.error(
        `\nFAIL: ${missingFiles.length} attachment ${missingFiles.length === 1 ? 'row points' : 'rows point'} at a file that does not exist in storage.`,
      )
      process.exit(1)
    }

    console.log(
      missingThumbnails.length > 0
        ? '\nOK: every attachment file exists (some thumbnails missing — cosmetic).'
        : '\nOK: every attachment file and thumbnail exists in storage.',
    )
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
