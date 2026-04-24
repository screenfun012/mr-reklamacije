import { schema } from '@mr/db'
import { describe, expect, it, vi } from 'vitest'

import { AuditService } from '../modules/audit/audit.service.js'

describe('AuditService', () => {
  it('calls db.insert with correct values', async () => {
    const valuesMock = vi.fn().mockReturnValue(Promise.resolve())
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock })

    const db = { insert: insertMock } as never
    const service = new AuditService(db)

    await service.log({
      entityType: 'emotive_claim',
      entityId: 'claim-1',
      action: 'create',
      actorUserId: 'user-1',
      actorIp: '10.0.0.1',
      actorUserAgent: 'test-agent',
      context: { foo: 'bar' },
    })

    expect(insertMock).toHaveBeenCalledWith(schema.auditLog)
    expect(valuesMock).toHaveBeenCalledWith({
      entityType: 'emotive_claim',
      entityId: 'claim-1',
      action: 'create',
      actorUserId: 'user-1',
      actorIp: '10.0.0.1',
      actorUserAgent: 'test-agent',
      changes: null,
      context: { foo: 'bar' },
    })
  })

  it('defaults optional fields to null', async () => {
    const valuesMock = vi.fn().mockReturnValue(Promise.resolve())
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock })
    const db = { insert: insertMock } as never
    const service = new AuditService(db)

    await service.log({
      entityType: 'user',
      entityId: 'u-1',
      action: 'login',
    })

    const call = valuesMock.mock.calls[0]![0]
    expect(call.actorUserId).toBeNull()
    expect(call.actorIp).toBeNull()
    expect(call.actorUserAgent).toBeNull()
    expect(call.changes).toBeNull()
    expect(call.context).toBeNull()
  })
})
