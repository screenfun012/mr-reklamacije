import { describe, expect, it } from 'vitest'

import {
  isProtectedSuperAdminEmail,
  PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT,
  resolveProtectedSuperAdminEmail,
} from '../protected-super-admin.js'

describe('PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT', () => {
  it('matches the Nikola bootstrap account email', () => {
    expect(PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT).toBe('screenfun99@gmail.com')
  })
})

describe('resolveProtectedSuperAdminEmail', () => {
  it('returns the default when override is missing or blank', () => {
    expect(resolveProtectedSuperAdminEmail()).toBe(PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT)
    expect(resolveProtectedSuperAdminEmail(undefined)).toBe(PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT)
    expect(resolveProtectedSuperAdminEmail(null)).toBe(PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT)
    expect(resolveProtectedSuperAdminEmail('   ')).toBe(PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT)
  })

  it('returns trimmed override when provided', () => {
    expect(resolveProtectedSuperAdminEmail('  admin@example.com  ')).toBe('admin@example.com')
  })
})

describe('isProtectedSuperAdminEmail', () => {
  it('matches case-insensitively against the protected email', () => {
    expect(isProtectedSuperAdminEmail('screenfun99@gmail.com')).toBe(true)
    expect(isProtectedSuperAdminEmail('ScreenFun99@Gmail.com')).toBe(true)
    expect(isProtectedSuperAdminEmail('  screenfun99@gmail.com  ')).toBe(true)
  })

  it('returns false for other emails', () => {
    expect(isProtectedSuperAdminEmail('pera.peric.test@gmail.com')).toBe(false)
  })

  it('respects a custom protected email override', () => {
    expect(isProtectedSuperAdminEmail('admin@example.com', 'admin@example.com')).toBe(true)
    expect(isProtectedSuperAdminEmail('screenfun99@gmail.com', 'admin@example.com')).toBe(false)
  })
})
