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
    app.get('/api/claims', (c) => c.json({ ok: true }))

    await app.request('/api/claims')

    expect(infoMock).toHaveBeenCalledTimes(1)
    const [payload, message] = infoMock.mock.calls[0] as [Record<string, unknown>, string]
    expect(payload['method']).toBe('GET')
    expect(payload['path']).toBe('/api/claims')
    expect(payload['status']).toBe(200)
    expect(typeof payload['durationMs']).toBe('number')
    expect(payload['durationMs']).toBeGreaterThanOrEqual(0)
    expect(message).toBe('request')
  })

  it('raises a slow request to warn so it can be found without an APM', async () => {
    const infoMock = vi.fn()
    const warnMock = vi.fn()
    const logger = { info: infoMock, warn: warnMock } as unknown as Logger

    const app = new Hono()
    app.use('*', createRequestLogger(logger))
    app.get('/api/statistika', async (c) => {
      await new Promise((resolve) => setTimeout(resolve, 1100))
      return c.json({ ok: true })
    })

    await app.request('/api/statistika')

    expect(infoMock).not.toHaveBeenCalled()
    expect(warnMock).toHaveBeenCalledTimes(1)
    const [payload, message] = warnMock.mock.calls[0] as [Record<string, unknown>, string]
    expect(payload['path']).toBe('/api/statistika')
    expect(payload['durationMs']).toBeGreaterThanOrEqual(1000)
    expect(message).toBe('slow request')
  })

  it('skips health probes — they would flood the log', async () => {
    const infoMock = vi.fn()
    const logger = { info: infoMock } as unknown as Logger

    const app = new Hono()
    app.use('*', createRequestLogger(logger))
    app.get('/health', (c) => c.json({ ok: true }))
    app.get('/api/health', (c) => c.json({ ok: true }))

    const first = await app.request('/health')
    const second = await app.request('/api/health')

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(infoMock).not.toHaveBeenCalled()
  })
})
