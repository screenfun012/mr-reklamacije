/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveFetchUrl } from '../resolve-fetch-url.js'

describe('resolveFetchUrl', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns absolute URLs unchanged', () => {
    expect(resolveFetchUrl('https://api.example.com/foo')).toBe('https://api.example.com/foo')
  })

  it('keeps relative paths in the browser', () => {
    vi.stubGlobal('window', {})
    expect(resolveFetchUrl('/api/emotive-claims?page=1')).toBe('/api/emotive-claims?page=1')
  })

  it('prefixes API origin on the server', () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000')
    expect(resolveFetchUrl('/api/emotive-claims?page=1')).toBe(
      'http://localhost:3000/api/emotive-claims?page=1',
    )
  })

  it('uses API_INTERNAL_URL when VITE_API_URL is unset', () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.railway.internal')
    expect(resolveFetchUrl('/api/health')).toBe('http://api.railway.internal/api/health')
  })
})
