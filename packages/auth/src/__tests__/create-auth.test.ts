import { schema } from '@mr/db'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { describe, expect, it } from 'vitest'

import { createAuth } from '../better-auth.config.js'

describe('createAuth factory', () => {
  it('returns a Better-Auth instance with api namespace', () => {
    // Mock DB - we don't call any queries, just verify factory works
    const mockDb = {} as unknown as NodePgDatabase<typeof schema>

    const auth = createAuth(mockDb)

    expect(auth).toBeDefined()
    expect(auth.api).toBeDefined()
    expect(typeof auth.api).toBe('object')
  })

  it('returns auth with options including our additionalFields', () => {
    const mockDb = {} as unknown as NodePgDatabase<typeof schema>
    const auth = createAuth(mockDb)

    // Better-Auth exposes options on the instance
    expect(auth.options).toBeDefined()
    // Verify additionalFields propagated from sharedAuthOptions
    expect(auth.options.user?.additionalFields).toHaveProperty('isActive')
    expect(auth.options.user?.additionalFields).toHaveProperty('preferredLanguage')
    expect(auth.options.user?.additionalFields).toHaveProperty('deletedAt')
  })

  it('configures all BA tables with correct modelName', () => {
    const mockDb = {} as unknown as NodePgDatabase<typeof schema>
    const auth = createAuth(mockDb)

    expect(auth.options.user?.modelName).toBe('users')
    expect(auth.options.session?.modelName).toBe('sessions')
    expect(auth.options.account?.modelName).toBe('accounts')
    expect(auth.options.verification?.modelName).toBe('verification_tokens')
  })

  it('propagates trustedOrigins from opts to Better-Auth config', () => {
    const mockDb = {} as unknown as NodePgDatabase<typeof schema>
    const origins = ['http://localhost:3001', 'http://localhost:3002']
    const auth = createAuth(mockDb, { trustedOrigins: origins })

    expect(auth.options.trustedOrigins).toEqual(origins)
  })

  it('registers twoFactor plus customSession for session enrichment', () => {
    const mockDb = {} as unknown as NodePgDatabase<typeof schema>
    const auth = createAuth(mockDb)

    expect(auth.options.plugins?.length).toBeGreaterThanOrEqual(2)
  })
})
