import { UserAccountStatus } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { createForcePendingOnSignupHook } from '../hooks/force-pending-on-signup.js'

describe('createForcePendingOnSignupHook', () => {
  it('forces accountStatus to pending on user create', async () => {
    const hook = createForcePendingOnSignupHook()
    const result = await hook({
      email: 'worker@example.com',
      name: 'Test Worker',
      accountStatus: UserAccountStatus.Approved,
    })

    expect(result.data.accountStatus).toBe(UserAccountStatus.Pending)
    expect(result.data.email).toBe('worker@example.com')
  })
})
