import { ClaimKind } from '@mr/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import {
  buildTestContainer,
  createPresenceTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const CLAIM_ID = 'a4c0f0c2-0000-4000-8000-000000000abc'
const ANA = '11111111-1111-4111-8111-111111111111'
const BOBAN = '22222222-2222-4222-8222-222222222222'

function heartbeat(app: ReturnType<typeof createPresenceTestApp>, body: unknown) {
  return app.request('/api/presence/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Presence HTTP', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('tells a viewer who ELSE is on the claim, never themselves', async () => {
    const anaApp = createPresenceTestApp(container, testUser(['emotive_claims.view'], ANA))
    const bobanApp = createPresenceTestApp(container, testUser(['emotive_claims.view'], BOBAN))

    const target = { kind: ClaimKind.Emotive, id: CLAIM_ID }

    const anaFirst = await heartbeat(anaApp, target)
    expect(anaFirst.status).toBe(200)
    expect(((await anaFirst.json()) as { viewers: unknown[] }).viewers).toEqual([])

    const bobanRes = await heartbeat(bobanApp, target)
    const bobanViewers = ((await bobanRes.json()) as { viewers: { userId: string }[] }).viewers
    expect(bobanViewers.map((v) => v.userId)).toEqual([ANA])

    // Ana beats again and now sees Boban — but still not herself.
    const anaSecond = await heartbeat(anaApp, target)
    const anaViewers = ((await anaSecond.json()) as { viewers: { userId: string }[] }).viewers
    expect(anaViewers.map((v) => v.userId)).toEqual([BOBAN])
  })

  it('drops a viewer on explicit leave', async () => {
    const anaApp = createPresenceTestApp(container, testUser(['emotive_claims.view'], ANA))
    const bobanApp = createPresenceTestApp(container, testUser(['emotive_claims.view'], BOBAN))
    const target = { kind: ClaimKind.Emotive, id: CLAIM_ID }

    await heartbeat(anaApp, target)
    await heartbeat(bobanApp, target)

    const leave = await anaApp.request('/api/presence/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(target),
    })
    expect(leave.status).toBe(204)

    const bobanAgain = await heartbeat(bobanApp, target)
    expect(((await bobanAgain.json()) as { viewers: unknown[] }).viewers).toEqual([])
  })

  it('refuses a portal client — presence is a staff cue', async () => {
    const clientApp = createPresenceTestApp(
      container,
      testUser(['emotive_claims.view_own_customer'], ANA, ['client']),
    )

    const res = await heartbeat(clientApp, { kind: ClaimKind.Emotive, id: CLAIM_ID })
    expect(res.status).toBe(403)
  })

  it('rejects a malformed target', async () => {
    // A raw ZodError (bad body) is a 400 in this app; 422 is reserved for semantic
    // validation thrown as ValidationError.
    const app = createPresenceTestApp(container, testUser(['emotive_claims.view'], ANA))
    const res = await heartbeat(app, { kind: 'nonsense', id: 'not-a-uuid' })
    expect(res.status).toBe(400)
  })
})
