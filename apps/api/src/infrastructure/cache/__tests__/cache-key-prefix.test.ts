import { describe, expect, it } from 'vitest'

import type { Env } from '../../../config/env.js'
import { resolveCacheKeyPrefix } from '../cache-key-prefix.js'

const envWith = (nodeEnv: Env['NODE_ENV'], secret = 'x'.repeat(32)): Env =>
  ({ NODE_ENV: nodeEnv, BETTER_AUTH_SECRET: secret }) as unknown as Env

describe('resolveCacheKeyPrefix', () => {
  it('uses short env prefixes for non-production', () => {
    expect(resolveCacheKeyPrefix(envWith('development'))).toBe('dev')
    expect(resolveCacheKeyPrefix(envWith('staging'))).toBe('staging')
    expect(resolveCacheKeyPrefix(envWith('test'))).toBe('test')
  })

  it('adds a 4-char guard to the production prefix', () => {
    const prefix = resolveCacheKeyPrefix(envWith('production', 'a'.repeat(32)))
    expect(prefix).toMatch(/^prod\.[0-9a-f]{4}$/)
  })

  it('derives a different guard for a different secret (unguessable per env)', () => {
    const a = resolveCacheKeyPrefix(envWith('production', 'a'.repeat(32)))
    const b = resolveCacheKeyPrefix(envWith('production', 'b'.repeat(32)))
    expect(a).not.toBe(b)
  })
})
