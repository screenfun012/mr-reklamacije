import { UserAccountStatus } from '@mr/shared'
import { describe, expect, it, vi } from 'vitest'

import { createOnUserRegisteredHook } from '../on-user-registered.js'

describe('createOnUserRegisteredHook', () => {
  it('invokes callback for pending users', async () => {
    const onUserRegistered = vi.fn()
    const hook = createOnUserRegisteredHook(onUserRegistered)

    await hook({
      id: '11111111-1111-4111-8111-111111111111',
      accountStatus: UserAccountStatus.Pending,
    })

    expect(onUserRegistered).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')
  })

  it('skips callback for approved users', async () => {
    const onUserRegistered = vi.fn()
    const hook = createOnUserRegisteredHook(onUserRegistered)

    await hook({
      id: '11111111-1111-4111-8111-111111111111',
      accountStatus: UserAccountStatus.Approved,
    })

    expect(onUserRegistered).not.toHaveBeenCalled()
  })

  it('does nothing when callback is omitted', async () => {
    const hook = createOnUserRegisteredHook(undefined)

    await expect(
      hook({
        id: '11111111-1111-4111-8111-111111111111',
        accountStatus: UserAccountStatus.Pending,
      }),
    ).resolves.toBeUndefined()
  })
})
