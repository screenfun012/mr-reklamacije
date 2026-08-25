import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { useAuthSession, syncServiceWorkerPushUser } = vi.hoisted(() => ({
  useAuthSession: vi.fn(),
  syncServiceWorkerPushUser: vi.fn(async () => {}),
}))

vi.mock('@mr/auth/route-guards', () => ({ useAuthSession }))
vi.mock('../register-service-worker.js', () => ({ syncServiceWorkerPushUser }))

import { PushAccountSync } from '../push-account-sync.js'

describe('PushAccountSync', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('clears the worker account on an initially signed-out page', async () => {
    useAuthSession.mockReturnValue({ session: null, isPending: false })

    render(<PushAccountSync />)

    await waitFor(() => expect(syncServiceWorkerPushUser).toHaveBeenCalledWith(null))
  })

  it('updates the worker when a settled session changes accounts', async () => {
    useAuthSession.mockReturnValue({
      session: { user: { id: '11111111-1111-4111-8111-111111111111' } },
      isPending: false,
    })
    const view = render(<PushAccountSync />)
    await waitFor(() =>
      expect(syncServiceWorkerPushUser).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
      ),
    )

    useAuthSession.mockReturnValue({ session: null, isPending: false })
    view.rerender(<PushAccountSync />)

    await waitFor(() => expect(syncServiceWorkerPushUser).toHaveBeenLastCalledWith(null))
  })
})
