import { UserAccountStatus } from '@mr/shared'
import { describe, expect, it, vi } from 'vitest'

import { AUTH_ERROR_ACCOUNT_PENDING, AUTH_ERROR_ACCOUNT_REJECTED } from '../auth-error-codes.js'
import { createAccountStatusCheckHook } from '../hooks/account-status-check.js'

function mockDb(accountStatus: string | undefined) {
  const limitMock = vi
    .fn()
    .mockResolvedValue(accountStatus === undefined ? [] : [{ accountStatus }])
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
  const fromMock = vi.fn().mockReturnValue({ where: whereMock })
  const selectMock = vi.fn().mockReturnValue({ from: fromMock })

  return { select: selectMock } as never
}

describe('createAccountStatusCheckHook', () => {
  it('allows session when account is approved', async () => {
    const hook = createAccountStatusCheckHook(mockDb(UserAccountStatus.Approved))
    await expect(hook({ userId: 'user-1' } as never)).resolves.toBeUndefined()
  })

  it('blocks session when account is pending', async () => {
    const hook = createAccountStatusCheckHook(mockDb(UserAccountStatus.Pending))
    await expect(hook({ userId: 'user-1' } as never)).rejects.toMatchObject({
      message: AUTH_ERROR_ACCOUNT_PENDING,
    })
  })

  it('blocks session when account is rejected', async () => {
    const hook = createAccountStatusCheckHook(mockDb(UserAccountStatus.Rejected))
    await expect(hook({ userId: 'user-1' } as never)).rejects.toMatchObject({
      message: AUTH_ERROR_ACCOUNT_REJECTED,
    })
  })

  it('blocks session when user row is missing', async () => {
    const hook = createAccountStatusCheckHook(mockDb(undefined))
    await expect(hook({ userId: 'user-1' } as never)).rejects.toMatchObject({
      message: AUTH_ERROR_ACCOUNT_PENDING,
    })
  })
})
