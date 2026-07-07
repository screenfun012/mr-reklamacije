import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

import { clientIpOf } from '../core/http/client-ip.js'

async function ipFor(headers: Record<string, string>): Promise<string | null> {
  const app = new Hono()
  let captured: string | null = 'not-called'
  app.get('/', (c) => {
    captured = clientIpOf(c)
    return c.text('ok')
  })
  await app.request('/', { headers })
  return captured
}

describe('clientIpOf', () => {
  it('prefers cf-connecting-ip over x-forwarded-for', async () => {
    expect(
      await ipFor({
        'cf-connecting-ip': '203.0.113.7',
        'x-forwarded-for': '198.51.100.1, 192.0.2.9',
      }),
    ).toBe('203.0.113.7')
  })

  it('ignores a non-IP cf-connecting-ip and falls back to x-forwarded-for', async () => {
    expect(await ipFor({ 'cf-connecting-ip': 'garbage', 'x-forwarded-for': '192.0.2.9' })).toBe(
      '192.0.2.9',
    )
  })

  it('takes the RIGHTMOST x-forwarded-for entry — leftmost is client-forgeable', async () => {
    expect(await ipFor({ 'x-forwarded-for': '6.6.6.6, 198.51.100.1, 192.0.2.9' })).toBe('192.0.2.9')
  })

  it('accepts a single-entry x-forwarded-for', async () => {
    expect(await ipFor({ 'x-forwarded-for': '192.0.2.9' })).toBe('192.0.2.9')
  })

  it('accepts IPv6 addresses', async () => {
    expect(await ipFor({ 'x-forwarded-for': '2001:db8::1' })).toBe('2001:db8::1')
  })

  it('returns null for a non-IP rightmost entry', async () => {
    expect(await ipFor({ 'x-forwarded-for': '192.0.2.9, not-an-ip' })).toBeNull()
  })

  it('returns null when no proxy headers are present (dev)', async () => {
    expect(await ipFor({})).toBeNull()
  })

  it('never reads x-real-ip (spoofable, nothing in our chain sets it)', async () => {
    expect(await ipFor({ 'x-real-ip': '6.6.6.6' })).toBeNull()
  })
})
