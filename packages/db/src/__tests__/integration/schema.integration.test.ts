import { eq, sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createDb, createPool } from '../../client.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'
import {
  accounts,
  appSettings,
  attachments,
  auditLog,
  claimObservations,
  claimSources,
  clientRegistrationRequests,
  customerUsers,
  customers,
  departments,
  domaceClaims,
  employeeMonthlyOutput,
  employees,
  emotiveClaimFaults,
  emotiveClaims,
  engineManufacturers,
  engineTypes,
  externalParties,
  permissions,
  rolePermissions,
  roles,
  sessions,
  translationCache,
  twoFactorSecrets,
  userRoles,
  users,
  verificationTokens,
} from '../../schema/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let pool: ReturnType<typeof createPool>
let db: ReturnType<typeof createDb>

beforeAll(async () => {
  pool = createPool(getIntegrationDatabaseUrl())
  db = createDb(pool)

  await migrate(db, {
    migrationsFolder: resolve(__dirname, '../../../migrations'),
  })

  await db.execute(sql`
    TRUNCATE TABLE
      employee_monthly_output,
      app_settings,
      translation_cache,
      claim_observations,
      attachments,
      mr_registry,
      emotive_claim_faults,
      emotive_claims,
      domace_claims,
      client_registration_requests,
      claim_sources,
      external_parties,
      engine_manufacturers,
      engine_types,
      audit_log,
      employees,
      departments,
      customer_users,
      customers,
      sessions,
      accounts,
      two_factor_secrets,
      verification_tokens,
      user_roles,
      role_permissions,
      users,
      roles,
      permissions
    RESTART IDENTITY CASCADE
  `)
})

afterAll(async () => {
  await pool.end()
})

describe('schema (integration)', () => {
  it('inserts records in access control tables', async () => {
    await db.insert(permissions).values({
      id: 'test.permission',
      module: 'test',
      action: 'permission',
      nameSr: 'Test',
      nameEn: 'Test',
      descriptionSr: 'Opis',
      descriptionEn: 'Description',
    })

    const [role] = await db
      .insert(roles)
      .values({
        code: 'test_role',
        nameSr: 'Test',
        nameEn: 'Test',
        isSystem: false,
      })
      .returning()

    expect(role?.id).toBeDefined()

    const [user] = await db
      .insert(users)
      .values({
        email: 'test@example.com',
        name: 'Test User',
      })
      .returning()

    expect(user?.id).toBeDefined()

    await db.insert(rolePermissions).values({
      roleId: role!.id,
      permissionId: 'test.permission',
    })

    await db.insert(userRoles).values({
      userId: user!.id,
      roleId: role!.id,
      assignedBy: user!.id,
    })
  })

  it('inserts records in master data tables', async () => {
    const [customer] = await db
      .insert(customers)
      .values({
        kind: 'emotive_partner',
        name: 'Test Customer',
      })
      .returning()

    expect(customer?.id).toBeDefined()

    const [dept] = await db
      .insert(departments)
      .values({
        code: 'TEST_DEPT',
        nameSr: 'Test',
        nameEn: 'Test',
      })
      .returning()

    expect(dept?.id).toBeDefined()

    const [employee] = await db
      .insert(employees)
      .values({
        fullName: 'Test Employee',
        normalizedName: 'TEST EMPLOYEE',
      })
      .returning()

    expect(employee?.id).toBeDefined()
  })

  it('rejects invalid CustomerKind via CHECK constraint', async () => {
    await expect(
      db.insert(customers).values({
        kind: 'invalid_kind' as never,
        name: 'Bad Customer',
      }),
    ).rejects.toThrow()
  })

  it('rejects invalid AuditAction via CHECK constraint', async () => {
    const [user] = await db.select().from(users).limit(1)

    await expect(
      db.insert(auditLog).values({
        entityType: 'user',
        entityId: user!.id,
        action: 'invalid_action' as never,
        actorUserId: user!.id,
      }),
    ).rejects.toThrow()
  })

  it('enforces UNIQUE constraint on employees.normalized_name', async () => {
    await db.insert(employees).values({
      fullName: 'First Employee',
      normalizedName: 'UNIQUE TEST',
    })

    await expect(
      db.insert(employees).values({
        fullName: 'Second Employee',
        normalizedName: 'UNIQUE TEST',
      }),
    ).rejects.toThrow()
  })

  it('enforces FK on customer_users.customer_id', async () => {
    const [user] = await db.select().from(users).limit(1)
    const fakeCustomerId = '00000000-0000-0000-0000-000000000000'

    await expect(
      db.insert(customerUsers).values({
        customerId: fakeCustomerId,
        userId: user!.id,
        assignedBy: user!.id,
      }),
    ).rejects.toThrow()
  })

  it('inserts audit_log record', async () => {
    const [user] = await db.select().from(users).limit(1)

    const [entry] = await db
      .insert(auditLog)
      .values({
        entityType: 'user',
        entityId: user!.id,
        action: 'create',
        actorUserId: user!.id,
        changes: { name: { before: null, after: 'Test User' } },
      })
      .returning()

    expect(entry?.id).toBeDefined()
    expect(entry?.action).toBe('create')
  })
})

describe('schema Phase C (integration)', () => {
  it('inserts engine_type (catalog)', async () => {
    const [row] = await db
      .insert(engineTypes)
      .values({
        code: 'INT_TEST_ENGINE',
        manufacturer: 'Test Mfg',
      })
      .returning()

    expect(row?.id).toBeDefined()
    expect(row?.code).toBe('INT_TEST_ENGINE')
  })

  it('inserts external_party with kind supplier (CHECK)', async () => {
    const [row] = await db
      .insert(externalParties)
      .values({
        name: 'Supplier Co',
        kind: 'supplier',
      })
      .returning()

    expect(row?.id).toBeDefined()
    expect(row?.kind).toBe('supplier')
  })

  it('inserts claim_source with FK to default customer', async () => {
    const [customer] = await db.select().from(customers).limit(1)
    expect(customer).toBeDefined()

    const [source] = await db
      .insert(claimSources)
      .values({
        code: 'INT_SRC',
        name: 'Integration Source',
        defaultCustomerId: customer!.id,
      })
      .returning()

    expect(source?.id).toBeDefined()
    expect(source?.defaultCustomerId).toBe(customer!.id)
  })

  it('inserts client_registration_request (pending, password_hash)', async () => {
    const [row] = await db
      .insert(clientRegistrationRequests)
      .values({
        email: 'registrant@example.com',
        name: 'Registrant',
        passwordHash: 'test_hash',
        status: 'pending',
      })
      .returning()

    expect(row?.id).toBeDefined()
    expect(row?.status).toBe('pending')
    expect(row?.passwordHash).toBe('test_hash')
  })

  it('inserts emotive_claim with FKs', async () => {
    const [engine] = await db
      .select()
      .from(engineTypes)
      .where(eq(engineTypes.code, 'INT_TEST_ENGINE'))
      .limit(1)
    const [employee] = await db.select().from(employees).limit(1)
    const [source] = await db
      .select()
      .from(claimSources)
      .where(eq(claimSources.code, 'INT_SRC'))
      .limit(1)
    const [user] = await db.select().from(users).limit(1)

    expect(engine && employee && source && user).toBeTruthy()

    const [claim] = await db
      .insert(emotiveClaims)
      .values({
        warrantyReport: 'Integration warranty text',
        engineTypeId: engine!.id,
        dateOfClaim: new Date('2026-04-01'),
        mrNumber: '9999/26',
        employeeId: employee!.id,
        sourceId: source!.id,
        outcome: 'pending',
        claimYear: 2026,
        createdBy: user!.id,
      })
      .returning()

    expect(claim?.id).toBeDefined()
  })

  it('inserts emotive_claim_fault (employee one_of CHECK valid)', async () => {
    const [claim] = await db.select().from(emotiveClaims).limit(1)
    const [employee] = await db.select().from(employees).limit(1)
    expect(claim && employee).toBeTruthy()

    const [fault] = await db
      .insert(emotiveClaimFaults)
      .values({
        claimId: claim!.id,
        faultType: 'employee',
        employeeId: employee!.id,
      })
      .returning()

    expect(fault?.id).toBeDefined()
  })

  it('rejects invalid emotive_claim_fault (department kind with employee_id set)', async () => {
    const [claim] = await db.select().from(emotiveClaims).limit(1)
    const [employee] = await db.select().from(employees).limit(1)
    expect(claim && employee).toBeTruthy()

    await expect(
      db.insert(emotiveClaimFaults).values({
        claimId: claim!.id,
        faultType: 'department',
        employeeId: employee!.id,
      }),
    ).rejects.toThrow()
  })

  it('inserts domace_claim', async () => {
    const [user] = await db.select().from(users).limit(1)
    expect(user).toBeDefined()

    const [row] = await db
      .insert(domaceClaims)
      .values({
        customerName: 'Snapshot Name',
        mrNumber: 'MR1234/26',
        warrantyReport: 'Problem',
        dateOfClaim: new Date('2026-04-02'),
        outcome: 'pending',
        claimYear: 2026,
        createdBy: user!.id,
      })
      .returning()

    expect(row?.id).toBeDefined()
  })

  it('inserts attachment (emotive polymorphic CHECK valid)', async () => {
    const [claim] = await db.select().from(emotiveClaims).limit(1)
    const [user] = await db.select().from(users).limit(1)
    expect(claim && user).toBeTruthy()

    const [att] = await db
      .insert(attachments)
      .values({
        claimKind: 'emotive',
        emotiveClaimId: claim!.id,
        fileName: 'x.jpg',
        storagePath: `emotive/2026/${claim!.id}/f.jpg`,
        mimeType: 'image/jpeg',
        fileSizeBytes: 1024,
        uploadedBy: user!.id,
      })
      .returning()

    expect(att?.id).toBeDefined()
  })

  it('rejects invalid attachment (emotive kind with domace_claim_id set)', async () => {
    const [emo] = await db.select().from(emotiveClaims).limit(1)
    const [dom] = await db.select().from(domaceClaims).limit(1)
    const [user] = await db.select().from(users).limit(1)
    expect(emo && dom && user).toBeTruthy()

    await expect(
      db.insert(attachments).values({
        claimKind: 'emotive',
        domaceClaimId: dom!.id,
        fileName: 'bad.jpg',
        storagePath: 'bad',
        mimeType: 'image/jpeg',
        fileSizeBytes: 1,
        uploadedBy: user!.id,
      }),
    ).rejects.toThrow()
  })

  it('CASCADE deletes attachment, claim_observations, emotive_claim_faults when emotive_claim deleted', async () => {
    const [engine] = await db
      .select()
      .from(engineTypes)
      .where(eq(engineTypes.code, 'INT_TEST_ENGINE'))
      .limit(1)
    const [employee] = await db.select().from(employees).limit(1)
    const [source] = await db
      .select()
      .from(claimSources)
      .where(eq(claimSources.code, 'INT_SRC'))
      .limit(1)
    const [user] = await db.select().from(users).limit(1)
    expect(engine && employee && source && user).toBeTruthy()

    const [claim] = await db
      .insert(emotiveClaims)
      .values({
        warrantyReport: 'Cascade parent',
        engineTypeId: engine!.id,
        dateOfClaim: new Date('2026-05-01'),
        mrNumber: '8888/26',
        employeeId: employee!.id,
        sourceId: source!.id,
        outcome: 'pending',
        claimYear: 2026,
        createdBy: user!.id,
      })
      .returning()

    await db.insert(emotiveClaimFaults).values({
      claimId: claim!.id,
      faultType: 'employee',
      employeeId: employee!.id,
    })

    await db.insert(attachments).values({
      claimKind: 'emotive',
      emotiveClaimId: claim!.id,
      fileName: 'c.jpg',
      storagePath: `emotive/cascade/${claim!.id}/c.jpg`,
      mimeType: 'image/jpeg',
      fileSizeBytes: 100,
      uploadedBy: user!.id,
    })

    await db.insert(claimObservations).values({
      claimKind: 'emotive',
      emotiveClaimId: claim!.id,
      body: 'Note',
      visibility: 'internal',
      authorId: user!.id,
    })

    await db.delete(emotiveClaims).where(eq(emotiveClaims.id, claim!.id))

    const attRows = await db
      .select()
      .from(attachments)
      .where(eq(attachments.emotiveClaimId, claim!.id))
    const obsRows = await db
      .select()
      .from(claimObservations)
      .where(eq(claimObservations.emotiveClaimId, claim!.id))
    const faultRows = await db
      .select()
      .from(emotiveClaimFaults)
      .where(eq(emotiveClaimFaults.claimId, claim!.id))

    expect(attRows.length).toBe(0)
    expect(obsRows.length).toBe(0)
    expect(faultRows.length).toBe(0)
  })

  it('inserts claim_observation (emotive polymorphic valid)', async () => {
    const [claim] = await db.select().from(emotiveClaims).limit(1)
    const [user] = await db.select().from(users).limit(1)
    expect(claim && user).toBeTruthy()

    const [obs] = await db
      .insert(claimObservations)
      .values({
        claimKind: 'emotive',
        emotiveClaimId: claim!.id,
        body: 'Observation body',
        visibility: 'client_visible',
        authorId: user!.id,
      })
      .returning()

    expect(obs?.id).toBeDefined()
  })

  it('rejects invalid claim_observation (emotive kind with domace_claim_id set)', async () => {
    const [dom] = await db.select().from(domaceClaims).limit(1)
    const [user] = await db.select().from(users).limit(1)
    expect(dom && user).toBeTruthy()

    await expect(
      db.insert(claimObservations).values({
        claimKind: 'emotive',
        domaceClaimId: dom!.id,
        body: 'Bad',
        visibility: 'internal',
        authorId: user!.id,
      }),
    ).rejects.toThrow()
  })

  it('inserts translation_cache row (composite PK)', async () => {
    const [row] = await db
      .insert(translationCache)
      .values({
        sourceHash: 'a'.repeat(64),
        sourceLanguage: 'sr',
        targetLanguage: 'en',
        sourceText: 'Zdravo',
        translatedText: 'Hello',
        model: 'gpt-4o-mini',
      })
      .returning()

    expect(row?.sourceHash).toBeDefined()
    expect(row?.translatedText).toBe('Hello')
  })

  it('inserts app_settings row', async () => {
    const [user] = await db.select().from(users).limit(1)
    expect(user).toBeDefined()

    const [row] = await db
      .insert(appSettings)
      .values({
        key: 'integration_test_key',
        value: '42',
        valueType: 'string',
        updatedBy: user!.id,
      })
      .returning()

    expect(row?.key).toBe('integration_test_key')
  })

  it('inserts employee_monthly_output row', async () => {
    const [employee] = await db.select().from(employees).limit(1)
    const [user] = await db.select().from(users).limit(1)
    expect(employee && user).toBeTruthy()

    const [row] = await db
      .insert(employeeMonthlyOutput)
      .values({
        employeeId: employee!.id,
        year: 2026,
        month: 4,
        enginesAssembled: 100,
        createdBy: user!.id,
      })
      .returning()

    expect(row?.id).toBeDefined()
    expect(row?.enginesAssembled).toBe(100)
  })

  it('rejects employee_monthly_output with month 13 (CHECK)', async () => {
    const [employee] = await db.select().from(employees).limit(1)
    const [user] = await db.select().from(users).limit(1)
    expect(employee && user).toBeTruthy()

    await expect(
      db.insert(employeeMonthlyOutput).values({
        employeeId: employee!.id,
        year: 2026,
        month: 13,
        enginesAssembled: 1,
        createdBy: user!.id,
      }),
    ).rejects.toThrow()
  })
})

describe('schema Better-Auth (integration)', () => {
  it('inserts session with valid userId (FK to users)', async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: `ba-session-${Date.now()}@example.com`,
        name: 'BA Session User',
      })
      .returning()

    const [row] = await db
      .insert(sessions)
      .values({
        userId: user!.id,
        token: `session-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning()

    expect(row?.userId).toBe(user!.id)
    expect(row?.token).toBeDefined()
  })

  it('rejects duplicate session token (unique on token)', async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: `ba-dup-token-${Date.now()}@example.com`,
        name: 'BA Dup Token',
      })
      .returning()

    const sharedToken = `shared-token-${Date.now()}`

    await db.insert(sessions).values({
      userId: user!.id,
      token: sharedToken,
      expiresAt: new Date(Date.now() + 86_400_000),
    })

    await expect(
      db.insert(sessions).values({
        userId: user!.id,
        token: sharedToken,
        expiresAt: new Date(Date.now() + 86_400_000),
      }),
    ).rejects.toThrow()
  })

  it('inserts account as credential provider with password hash', async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: `ba-credential-${Date.now()}@example.com`,
        name: 'BA Credential',
      })
      .returning()

    const [row] = await db
      .insert(accounts)
      .values({
        userId: user!.id,
        accountId: user!.id,
        providerId: 'credential',
        password: '$scrypt$N=16384,r=8,p=1$placeholder',
      })
      .returning()

    expect(row?.providerId).toBe('credential')
    expect(row?.password).toContain('scrypt')
  })

  it('inserts verification_token (email verification scenario)', async () => {
    const [row] = await db
      .insert(verificationTokens)
      .values({
        identifier: `verify-email-${Date.now()}@example.com`,
        value: 'opaque-verification-token-value',
        expiresAt: new Date(Date.now() + 3_600_000),
      })
      .returning()

    expect(row?.identifier).toContain('@example.com')
    expect(row?.value).toBe('opaque-verification-token-value')
  })

  it('inserts two_factor_secret with verified default false', async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: `ba-2fa-${Date.now()}@example.com`,
        name: 'BA 2FA',
      })
      .returning()

    const [row] = await db
      .insert(twoFactorSecrets)
      .values({
        userId: user!.id,
        secret: 'encrypted-totp-secret',
        backupCodes: 'encrypted-backup-codes-blob',
      })
      .returning()

    expect(row?.verified).toBe(false)
  })

  it('CASCADE deletes sessions, accounts, two_factor_secrets when user is deleted', async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: `cascade-test-${Date.now()}@example.com`,
        name: 'CASCADE Test',
      })
      .returning()

    const userId = user!.id

    await db.insert(sessions).values({
      userId,
      token: `token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    })

    await db.insert(accounts).values({
      userId,
      accountId: 'credential-user-id',
      providerId: 'credential',
      password: 'hash-placeholder',
    })

    await db.insert(twoFactorSecrets).values({
      userId,
      secret: 'totp-secret-encrypted',
      backupCodes: 'codes-encrypted',
    })

    await db.delete(users).where(eq(users.id, userId))

    const sessionsAfter = await db.select().from(sessions).where(eq(sessions.userId, userId))
    const accountsAfter = await db.select().from(accounts).where(eq(accounts.userId, userId))
    const tfsAfter = await db
      .select()
      .from(twoFactorSecrets)
      .where(eq(twoFactorSecrets.userId, userId))

    expect(sessionsAfter).toHaveLength(0)
    expect(accountsAfter).toHaveLength(0)
    expect(tfsAfter).toHaveLength(0)
  })

  it('inserts verification_token without user FK (multi-purpose table)', async () => {
    const [row] = await db
      .insert(verificationTokens)
      .values({
        identifier: `reset-pwd-${Date.now()}`,
        value: 'reset-token-value',
        expiresAt: new Date(Date.now() + 3_600_000),
      })
      .returning()

    expect(row?.id).toBeDefined()
    expect(row?.identifier).toContain('reset-pwd')
  })
})
