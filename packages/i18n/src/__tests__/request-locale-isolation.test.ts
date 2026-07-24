/** @vitest-environment node */
import { describe, expect, it } from 'vitest'

import { getLocale } from '../paraglide/runtime.js'
import { resolvePortalLocaleFromRequest, runWithPortalRequestLocale } from '../portal-locale.js'

const withCookie = (value: string) =>
  new Request('http://portal.mrclaims.live/', { headers: { cookie: `PARAGLIDE_LOCALE=${value}` } })
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('portal request locale', () => {
  describe('resolvePortalLocaleFromRequest', () => {
    it('reads the locale from the cookie', () => {
      expect(resolvePortalLocaleFromRequest(withCookie('sr'))).toBe('sr')
      expect(resolvePortalLocaleFromRequest(withCookie('en'))).toBe('en')
    })

    it('defaults to EN and ignores Accept-Language when no cookie is set', () => {
      const request = new Request('http://portal.mrclaims.live/', {
        headers: { 'accept-language': 'sr,sr-RS;q=0.9' },
      })
      expect(resolvePortalLocaleFromRequest(request)).toBe('en')
    })
  })

  it('isolates the locale across concurrent SSR requests', async () => {
    // Two overlapping requests with different cookies must not share locale
    // state — the whole point of the per-request AsyncLocalStorage. Before the
    // fix, getLocale() read a process-global that the later request clobbered.
    const read = (value: string) =>
      runWithPortalRequestLocale(withCookie(value), async () => {
        await tick()
        return new Response(getLocale())
      })
    const [en, sr] = await Promise.all([read('en'), read('sr')])
    expect(await en.text()).toBe('en')
    expect(await sr.text()).toBe('sr')
  })

  it('ignores Accept-Language during SSR, defaulting to EN', async () => {
    const request = new Request('http://portal.mrclaims.live/', {
      headers: { 'accept-language': 'sr,sr-RS;q=0.9' },
    })
    const response = await runWithPortalRequestLocale(request, () => new Response(getLocale()))
    expect(await response.text()).toBe('en')
  })
})
