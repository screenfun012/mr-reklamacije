/**
 * One-off maintenance: recompress EXISTING claim-attachment photos the same
 * way new uploads are optimized (max 2048px edge, quality 80) — reclaims the
 * storage taken by multi-MB phone photos uploaded before compression existed.
 *
 * DRY RUN by default (prints per-file and total savings). Apply with:
 *   pnpm --filter api recompress-attachments -- --apply
 *
 * Report images are skipped (already optimized at upload); HEIC/videos/docs
 * are skipped (not recompressable here). Runs against DATABASE_URL/UPLOAD_DIR
 * from apps/api/.env — point those at the target environment deliberately.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { schema } from '@mr/db'
import { and, eq, gt, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import sharp from 'sharp'

const RECOMPRESSABLE_MIMES = ['image/jpeg', 'image/png', 'image/webp']
// Below this size recompression saves little and just churns files.
const MIN_BYTES_TO_CONSIDER = 500 * 1024
const MAX_EDGE = 2048
const QUALITY = 80
// Keep the original when recompression saves less than this fraction.
const MIN_SAVINGS_RATIO = 0.1

const apply = process.argv.includes('--apply')

const databaseUrl = process.env['DATABASE_URL']
const uploadDir = process.env['UPLOAD_DIR']
if (databaseUrl === undefined || uploadDir === undefined) {
  console.error('DATABASE_URL and UPLOAD_DIR are required (run with --env-file=.env)')
  process.exit(1)
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function main(): Promise<void> {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 })
  const db = drizzle(pool, { schema })

  const rows = await db
    .select({
      id: schema.attachments.id,
      storagePath: schema.attachments.storagePath,
      thumbnailPath: schema.attachments.thumbnailPath,
      mimeType: schema.attachments.mimeType,
      fileName: schema.attachments.fileName,
      fileSizeBytes: schema.attachments.fileSizeBytes,
    })
    .from(schema.attachments)
    .where(
      and(
        inArray(schema.attachments.mimeType, RECOMPRESSABLE_MIMES),
        eq(schema.attachments.purpose, 'claim_attachment'),
        gt(schema.attachments.fileSizeBytes, MIN_BYTES_TO_CONSIDER),
      ),
    )

  console.log(`${rows.length} candidate photos > ${formatMb(MIN_BYTES_TO_CONSIDER)}`)
  let totalBefore = 0
  let totalAfter = 0
  let changed = 0

  for (const row of rows) {
    const absolutePath = path.resolve(uploadDir as string, row.storagePath)
    let original: Buffer
    try {
      original = await readFile(absolutePath)
    } catch {
      console.warn(`SKIP (missing file) ${row.storagePath}`)
      continue
    }

    const pipeline = sharp(original)
      .rotate()
      .resize({ width: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    const optimized =
      row.mimeType === 'image/webp'
        ? await pipeline.webp({ quality: QUALITY }).toBuffer({ resolveWithObject: true })
        : await pipeline
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .jpeg({ quality: QUALITY })
            .toBuffer({ resolveWithObject: true })

    const newMime = row.mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg'
    const savings = 1 - optimized.data.byteLength / original.byteLength
    totalBefore += original.byteLength

    if (savings < MIN_SAVINGS_RATIO) {
      totalAfter += original.byteLength
      continue
    }

    changed += 1
    totalAfter += optimized.data.byteLength
    console.log(
      `${apply ? 'RECOMPRESS' : 'would recompress'} ${row.storagePath}: ` +
        `${formatMb(original.byteLength)} → ${formatMb(optimized.data.byteLength)} (-${Math.round(savings * 100)}%)`,
    )

    if (!apply) {
      continue
    }

    const newExtension = newMime === 'image/webp' ? 'webp' : 'jpg'
    const parsed = path.parse(row.storagePath)
    const newStoragePath = path.join(parsed.dir, `${parsed.name}.${newExtension}`)
    const newAbsolutePath = path.resolve(uploadDir as string, newStoragePath)

    // Write next to the original, then swap — never a window without a file.
    const tempPath = `${newAbsolutePath}.tmp`
    await mkdir(path.dirname(newAbsolutePath), { recursive: true })
    await writeFile(tempPath, optimized.data)
    await rename(tempPath, newAbsolutePath)
    if (newAbsolutePath !== absolutePath) {
      await rm(absolutePath, { force: true })
    }

    // Refresh the thumbnail from the recompressed source.
    const thumbnailPath = row.thumbnailPath
    if (thumbnailPath !== null) {
      const thumb = await sharp(optimized.data)
        .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
      await writeFile(path.resolve(uploadDir as string, thumbnailPath), thumb)
    }

    const dotIndex = row.fileName.lastIndexOf('.')
    const baseName = dotIndex > 0 ? row.fileName.slice(0, dotIndex) : row.fileName

    await db
      .update(schema.attachments)
      .set({
        storagePath: newStoragePath,
        mimeType: newMime,
        fileName: `${baseName}.${newExtension}`,
        fileSizeBytes: optimized.data.byteLength,
        contentSha256: createHash('sha256').update(optimized.data).digest('hex'),
        width: optimized.info.width,
        height: optimized.info.height,
        thumbnailPath,
      })
      .where(eq(schema.attachments.id, row.id))
  }

  console.log(
    `\n${apply ? 'DONE' : 'DRY RUN'}: ${changed}/${rows.length} photos, ` +
      `${formatMb(totalBefore)} → ${formatMb(totalAfter)} ` +
      `(saved ${formatMb(totalBefore - totalAfter)})`,
  )
  await pool.end()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
