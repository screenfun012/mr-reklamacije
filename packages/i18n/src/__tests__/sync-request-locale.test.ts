/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LOCALE_BOOTSTRAP_SCRIPT,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
} from '../locale-bootstrap-script.js'
import { getLocale, setLocale } from '../index.js'
import { syncRequestLocale } from '../sync-request-locale.js'

const getRequestHeadersMock = vi.hoisted(() =>
  vi.fn(() => ({
    get: (name: string) => {
      if (name === 'cookie') {
        return `${LOCALE_COOKIE_NAME}=en`
      }
      if (name === 'accept-language') {
        return 'sr'
      }
      return null
    },
  })),
)

const getRequestUrlMock = vi.hoisted(() => vi.fn(() => 'http://localhost:3000/reklamacije'))

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
  getRequestUrl: getRequestUrlMock,
}))

function resetLocaleToSerbian(): void {
  // Paraglide setLocale touches localStorage when window exists — keep SSR-like env for resets.
  vi.stubGlobal('window', undefined)
  setLocale('sr', { reload: false })
}

describe('syncRequestLocale', () => {
  beforeEach(() => {
    resetLocaleToSerbian()
    getRequestHeadersMock.mockClear()
    getRequestUrlMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetLocaleToSerbian()
  })

  it('returns current locale in the browser without calling server helpers', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })

    const locale = await syncRequestLocale()

    expect(locale).toBe('sr')
    expect(getRequestHeadersMock).not.toHaveBeenCalled()
  })

  it('sets locale from the SSR request cookie before rendering', async () => {
    const locale = await syncRequestLocale()

    expect(getRequestHeadersMock).toHaveBeenCalledTimes(1)
    expect(locale).toBe('en')
    expect(getLocale()).toBe('en')
  })
})

describe('LOCALE_BOOTSTRAP_SCRIPT', () => {
  it('references the Paraglide storage and cookie keys', () => {
    expect(LOCALE_BOOTSTRAP_SCRIPT).toContain(LOCALE_STORAGE_KEY)
    expect(LOCALE_BOOTSTRAP_SCRIPT).toContain(LOCALE_COOKIE_NAME)
  })
})
