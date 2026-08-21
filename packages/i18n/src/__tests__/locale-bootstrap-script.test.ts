import { describe, expect, it } from 'vitest'

import { LOCALE_BOOTSTRAP_SCRIPT, LOCALE_COOKIE_NAME, LOCALE_STORAGE_KEY } from '../index.js'

/**
 * The script is a string that runs in `<head>` before hydration, so it is tested the way it
 * runs: evaluated against a stand-in `document.cookie` and `localStorage`.
 */
function run(initial: { cookie: string; stored: string | null }): {
  cookie: string
  stored: string | null
} {
  let cookie = initial.cookie
  let stored = initial.stored

  const document = {
    get cookie(): string {
      return cookie
    },
    set cookie(value: string) {
      const [pair] = value.split(';')
      const [name, next] = (pair ?? '').split('=')
      if (name === LOCALE_COOKIE_NAME && next !== undefined) {
        cookie = `${LOCALE_COOKIE_NAME}=${next}`
      }
    },
  }

  const localStorage = {
    getItem: (key: string): string | null => (key === LOCALE_STORAGE_KEY ? stored : null),
    setItem: (key: string, value: string): void => {
      if (key === LOCALE_STORAGE_KEY) stored = value
    },
  }

  new Function('document', 'localStorage', LOCALE_BOOTSTRAP_SCRIPT)(document, localStorage)
  return { cookie, stored }
}

describe('LOCALE_BOOTSTRAP_SCRIPT', () => {
  it('leaves an existing cookie alone and follows it in localStorage', () => {
    // The server has ALREADY rendered with this cookie (cookie is the first strategy). Changing
    // it here is what made React throw the SSR tree away and re-render a stripped screen.
    const result = run({ cookie: `${LOCALE_COOKIE_NAME}=en`, stored: 'sr' })

    expect(result.cookie).toBe(`${LOCALE_COOKIE_NAME}=en`)
    expect(result.stored).toBe('en')
  })

  it('seeds the cookie from a stored choice when there is no cookie yet', () => {
    const result = run({ cookie: '', stored: 'sr' })

    expect(result.cookie).toBe(`${LOCALE_COOKIE_NAME}=sr`)
    expect(result.stored).toBe('sr')
  })

  it('does nothing at all on a first visit with nothing stored', () => {
    const result = run({ cookie: '', stored: null })

    expect(result.cookie).toBe('')
    expect(result.stored).toBeNull()
  })

  it('ignores a stored value that is not a known locale', () => {
    const result = run({ cookie: '', stored: 'de' })

    expect(result.cookie).toBe('')
  })
})
