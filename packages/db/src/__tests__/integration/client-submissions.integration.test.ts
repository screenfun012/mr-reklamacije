import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createDb, createPool } from '../../client.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'
import {
  attachments,
  clientSubmissions,
  customers,
  emotiveClaims,
  engineTypes,
  users,
} from '../../schema/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let pool: ReturnType<typeof createPool>
let db: ReturnType<typeof createDb>

// Prerequisites created once; unique per run so the suite is order-independent
// against the shared _test database (no TRUNCATE — see CLAUDE.md isolation drift).
let customerId: string
let userId: string
let submissionId: string
let emotiveClaimId: string

beforeAll(async () => {
  pool = createPool(getIntegrationDatabaseUrl())
  db = createDb(pool)

  // Migrate-from-zero safety net (global setup already migrated + seeded).
  await migrate(db, {
    migrationsFolder: resolve(__dirname, '../../../migrations'),
  })

  const [user] = await db
    .insert(users)
    .values({ email: `submission-${Date.now()}@example.com`, name: 'Submission Client' })
    .returning()
  userId = user!.id

  const [customer] = await db
    .insert(customers)
    .values({ kind: 'emotive_partner', name: 'Submission Partner' })
    .returning()
  customerId = customer!.id

  const [engine] = await db
    .insert(engineTypes)
    .values({ code: `SUBMISSION_ENGINE_${Date.now()}` })
    .returning()

  const [claim] = await db
    .insert(emotiveClaims)
    .values({
      warrantyReport: 'Prerequisite claim',
      engineTypeId: engine!.id,
      dateOfClaim: new Date('2026-04-01'),
      mrNumber: `SUB/${Date.now()}`,
      outcome: 'pending',
      claimYear: 2026,
      createdBy: userId,
    })
    .returning()
  emotiveClaimId = claim!.id

  const [submission] = await db
    .insert(clientSubmissions)
    .values({
      customerId,
      submittedByUserId: userId,
      message: 'Nešto ne valja sa motorom',
    })
    .returning()
  submissionId = submission!.id
})

afterAll(async () => {
  await pool.end()
})

describe('client_submissions (integration)', () => {
  it('inserts a client_submissions row with pending default status', async () => {
    const [row] = await db
      .insert(clientSubmissions)
      .values({
        customerId,
        submittedByUserId: userId,
        message: 'Curi ulje',
      })
      .returning()

    expect(row?.id).toBeDefined()
    expect(row?.status).toBe('pending')
    expect(row?.linkedEmotiveClaimId).toBeNull()
    expect(row?.handledAt).toBeNull()
    expect(row?.createdAt).toBeInstanceOf(Date)
  })

  it('rejects an invalid status via CHECK constraint', async () => {
    await expect(
      db.insert(clientSubmissions).values({
        customerId,
        submittedByUserId: userId,
        message: 'Bad status',
        status: 'in_progress' as never,
      }),
    ).rejects.toThrow()
  })
})

describe('attachments three-way one-of (integration)', () => {
  it('inserts an attachment referencing only client_submission_id (claim_kind null)', async () => {
    const [att] = await db
      .insert(attachments)
      .values({
        clientSubmissionId: submissionId,
        fileName: 'problem.jpg',
        storagePath: `client-submissions/${submissionId}/problem.jpg`,
        mimeType: 'image/jpeg',
        fileSizeBytes: 2048,
        uploadedBy: userId,
      })
      .returning()

    expect(att?.id).toBeDefined()
    expect(att?.claimKind).toBeNull()
    expect(att?.clientSubmissionId).toBe(submissionId)
    expect(att?.emotiveClaimId).toBeNull()
  })

  it('rejects an attachment that sets two targets at once (client_submission_id + emotive_claim_id)', async () => {
    await expect(
      db.insert(attachments).values({
        clientSubmissionId: submissionId,
        emotiveClaimId,
        fileName: 'bad.jpg',
        storagePath: 'bad',
        mimeType: 'image/jpeg',
        fileSizeBytes: 1,
        uploadedBy: userId,
      }),
    ).rejects.toThrow()
  })
})
