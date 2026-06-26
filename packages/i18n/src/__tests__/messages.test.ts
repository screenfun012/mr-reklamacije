import { describe, expect, it } from 'vitest'

import { getLocale, m, setLocale } from '../index.js'

describe('@mr/i18n messages', () => {
  it('exports messages module with all stub keys', () => {
    expect(typeof m.nav_dashboard).toBe('function')
    expect(typeof m.nav_pocetna).toBe('function')
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

  it('returns portal-web auth title and subtitle per locale', () => {
    setLocale('sr')
    expect(m.auth_login_title_portal()).toBe('Prijava — Portal')
    expect(m.portal_dashboard_subtitle()).toBe('Pregled vaših reklamacija')
    setLocale('en')
    expect(m.auth_login_title_portal()).toBe('Login — Portal')
    expect(m.portal_dashboard_subtitle()).toBe('Overview of your claims')
  })

  it('returns internal-web nav labels per locale', () => {
    setLocale('sr')
    expect(m.nav_pocetna()).toBe('Početna')
    expect(m.nav_pristiglo()).toBe('Pristiglo')
    setLocale('en')
    expect(m.nav_pocetna()).toBe('Home')
    expect(m.nav_pristiglo()).toBe('Inbox')
  })

  it('returns translated emotive/domace nav labels per locale', () => {
    setLocale('sr')
    expect(m.nav_emotive_claims()).toBe('Inostrane reklamacije')
    expect(m.nav_domace_claims()).toBe('Domaće reklamacije')
    setLocale('en')
    expect(m.nav_emotive_claims()).toBe('International claims')
    expect(m.nav_domace_claims()).toBe('Domestic claims')
  })

  it('exports common_loading for pending UI strings', () => {
    setLocale('sr')
    expect(m.common_loading()).toContain('itavanje')
    setLocale('en')
    expect(m.common_loading()).toContain('Loading')
  })

  it('returns security dialog 2FA copy per locale', () => {
    setLocale('sr')
    expect(m.security_2fa_enable_title()).toBe('Uključi dvofaktorsku potvrdu')
    expect(m.security_2fa_disable_title()).toBe('Isključi dvofaktorsku potvrdu')
    setLocale('en')
    expect(m.security_2fa_enable_title()).toBe('Enable two-factor authentication')
    expect(m.security_2fa_disable_title()).toBe('Disable two-factor authentication')
  })

  it('returns 2FA unavailable message per locale', () => {
    setLocale('sr')
    expect(m.security_two_factor_unavailable()).toContain('nije dostupna')
    setLocale('en')
    expect(m.security_two_factor_unavailable()).toContain('not available')
  })

  it('returns 2FA trust/session/network copy per locale', () => {
    setLocale('sr')
    expect(m.auth_login_2fa_trust_device()).toBe('Zapamti ovaj uređaj 30 dana')
    expect(m.auth_login_2fa_session_expired()).toBe('Sesija je istekla. Prijavite se ponovo.')
    expect(m.auth_login_2fa_network_error()).toBe('Greška u mreži. Pokušajte ponovo.')
    setLocale('en')
    expect(m.auth_login_2fa_trust_device()).toBe('Trust this device for 30 days')
    expect(m.auth_login_2fa_session_expired()).toBe('Session expired. Please sign in again.')
    expect(m.auth_login_2fa_network_error()).toBe('Network error. Please try again.')
  })

  it('returns claim outcome labels per locale', () => {
    setLocale('sr')
    expect(m.outcome_pending()).toBe('U obradi')
    expect(m.outcome_accepted()).toBe('Prihvaćeno')
    expect(m.outcome_rejected()).toBe('Odbijeno')
    expect(m.outcome_archived()).toBe('Arhivirano')
    setLocale('en')
    expect(m.outcome_pending()).toBe('In progress')
    expect(m.outcome_accepted()).toBe('Accepted')
    expect(m.outcome_rejected()).toBe('Rejected')
    expect(m.outcome_archived()).toBe('Archived')
  })

  it('exports manufacturer filter and admin catalog message keys', () => {
    setLocale('sr')
    expect(typeof m.claims_filter_manufacturer).toBe('function')
    expect(m.claims_filter_manufacturer()).toBe('Proizvođač')
    expect(m.claims_filter_manufacturer_all()).toBe('Svi proizvođači')
    expect(m.field_search_placeholder()).toBe('Pretraži…')
    expect(m.nav_engine_manufacturers()).toBe('Proizvođači motora')
    expect(m.nav_engine_types()).toBe('Tipovi motora')
    setLocale('en')
    expect(m.claims_filter_manufacturer()).toBe('Manufacturer')
    expect(m.claims_filter_manufacturer_all()).toBe('All manufacturers')
    expect(m.field_search_placeholder()).toBe('Search…')
    expect(m.nav_engine_manufacturers()).toBe('Engine manufacturers')
    expect(m.nav_engine_types()).toBe('Engine types')
  })

  it('returns claim findings section labels per locale', () => {
    setLocale('sr')
    expect(m.emotive_claims_detail_section_notes()).toBe('Nalazi')
    expect(m.emotive_claims_detail_notes_empty()).toBe('Nema nalaza.')
    setLocale('en')
    expect(m.emotive_claims_detail_section_notes()).toBe('Findings')
    expect(m.emotive_claims_detail_notes_empty()).toBe('No findings yet.')
  })

  it('returns insufficient-role login banner message per locale', () => {
    setLocale('sr')
    expect(m.auth_login_insufficient_role()).toBe(
      'Ova aplikacija zahteva drugačiju ulogu. Prijavite se sa odgovarajućim nalogom.',
    )
    setLocale('en')
    expect(m.auth_login_insufficient_role()).toBe(
      'This application requires a different role. Please sign in with an appropriate account.',
    )
  })
})
