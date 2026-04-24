import { AuditAction } from '@mr/shared'
import { describe, expect, it, vi } from 'vitest'

import { createLoginAuditHook } from '../hooks/login-audit.js'

describe('createLoginAuditHook', () => {
  it('inserts audit_log row with login action', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined)
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock })
    const db = { insert: insertMock } as never

    const hook = createLoginAuditHook(db)
    await hook({
      id: 'sess-1',
      userId: 'user-1',
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    } as never)

    expect(insertMock).toHaveBeenCalled()
    const payload = valuesMock.mock.calls[0]![0]
    expect(payload.action).toBe(AuditAction.Login)
    expect(payload.entityType).toBe('user')
    expect(payload.entityId).toBe('user-1')
    expect(payload.actorUserId).toBe('user-1')
    expect(payload.actorIp).toBe('10.0.0.1')
    expect(payload.actorUserAgent).toBe('Mozilla/5.0')
    expect(payload.context).toEqual({ sessionId: 'sess-1' })
  })

  it('does not throw when db insert fails (best-effort)', async () => {
    const valuesMock = vi.fn().mockRejectedValue(new Error('DB error'))
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock })
    const db = { insert: insertMock } as never

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const hook = createLoginAuditHook(db)
    await expect(
      hook({
        id: 'sess-1',
        userId: 'user-1',
      } as never),
    ).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
