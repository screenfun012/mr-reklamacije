import { afterEach, describe, expect, it, vi } from 'vitest'

import { registerServiceWorker } from '../register-service-worker.js'

const ORIGINAL_NAVIGATOR = globalThis.navigator

describe('registerServiceWorker', () => {
  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: ORIGINAL_NAVIGATOR,
    })
  })

  it('lets the caller handle a registration failure', async () => {
    const registrationError = new Error('worker unavailable')
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        ...ORIGINAL_NAVIGATOR,
        serviceWorker: { register: vi.fn().mockRejectedValue(registrationError) },
      },
    })

    await expect(registerServiceWorker()).rejects.toBe(registrationError)
  })

  it('shares one in-flight registration and retries after that registration fails', async () => {
    const register = vi
      .fn<() => Promise<ServiceWorkerRegistration>>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue({} as ServiceWorkerRegistration)
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { ...ORIGINAL_NAVIGATOR, serviceWorker: { register } },
    })

    await expect(Promise.all([registerServiceWorker(), registerServiceWorker()])).rejects.toThrow(
      'temporary failure',
    )
    await expect(registerServiceWorker()).resolves.toEqual({})
    expect(register).toHaveBeenCalledTimes(2)
  })
})
