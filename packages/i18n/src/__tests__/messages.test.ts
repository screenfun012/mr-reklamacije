import { describe, expect, it } from 'vitest'

import { getLocale, m, setLocale } from '../index.js'

describe('@mr/i18n messages', () => {
  it('exports messages module with all stub keys', () => {
    expect(typeof m.nav_dashboard).toBe('function')
    expect(typeof m.action_save).toBe('function')
  })

  it('returns Serbian (baseLocale) by default', () => {
    setLocale('sr')
    expect(m.nav_dashboard()).toBe('Kontrolna tabla')
    expect(m.action_save()).toBe('Sačuvaj')
  })

  it('returns English when locale switched to en', () => {
    setLocale('en')
    expect(m.nav_dashboard()).toBe('Dashboard')
    expect(m.action_save()).toBe('Save')
  })

  it('returns Serbian after switching back to sr', () => {
    setLocale('en')
    setLocale('sr')
    expect(m.nav_dashboard()).toBe('Kontrolna tabla')
  })

  it('getLocale returns current locale', () => {
    setLocale('en')
    expect(getLocale()).toBe('en')
    setLocale('sr')
    expect(getLocale()).toBe('sr')
  })

  it('returns translated emotive/domace nav labels per locale', () => {
    setLocale('sr')
    expect(m.nav_emotive_claims()).toBe('Inostrane reklamacije')
    expect(m.nav_domace_claims()).toBe('Domaće reklamacije')
    setLocale('en')
    expect(m.nav_emotive_claims()).toBe('International claims')
    expect(m.nav_domace_claims()).toBe('Domestic claims')
  })
})
