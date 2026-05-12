import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import type { Logger } from '@mr/logger'

import { createRequestLogger } from '../core/middleware/request-logger.js'

describe('request logger', () => {
  it('logs method, path, status, duration', async () => {
    const infoMock = vi.fn()
    const logger = { info: infoMock } as unknown as Logger

    const app = new Hono()
    app.use('*', createRequestLogger(logger))
    app.get('/health', (c) => c.json({ ok: true }))

    await app.request('/health')

    expect(infoMock).toHaveBeenCalledTimes(1)
    const [payload, message] = infoMock.mock.calls[0] as [Record<string, unknown>, string]
    expect(payload['method']).toBe('GET')
    expect(payload['path']).toBe('/health')
    expect(payload['status']).toBe(200)
    expect(typeof payload['durationMs']).toBe('number')
    expect(payload['durationMs']).toBeGreaterThanOrEqual(0)
    expect(message).toBe('request')
  })
})
