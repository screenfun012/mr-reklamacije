import { CLIENT_PERMISSIONS, PERMISSIONS, type Permission } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { STANDARD_ROLES } from '../standard-roles.js'

/**
 * The actions the spec keeps out of the library (§4 "Nikad u biblioteci — samo admin", and the four
 * that left the list on 17.08. when Nikola decided rights are handed out by the super-admin alone).
 *
 * They are not secret — they are simply never handed over in passing, because each one is a way to
 * become somebody else: setting another person's password outright, making or approving accounts
 * (approval GIVES a role, so it gives rights), or editing the very sets this panel edits.
 *
 * Written here as a list rather than left as a paragraph in the spec: a standard set is a thing
 * somebody will one day extend, and prose does not fail a build.
 */
const ADMIN_ONLY: readonly Permission[] = [
  'users.reset_password',
  'users.create',
  'users.update',
  'users.delete',
  'users.deactivate',
  'users.approve_registration',
  'users.reject_registration',
  'customers.link_users',
  'roles.view',
  'roles.create',
  'roles.update',
  'roles.delete',
  'roles.assign',
  'settings.app_settings.view',
  'settings.app_settings.update',
  'settings.app_settings.manage_secrets',
  'intake_orders.archive',
]

describe('the standard privilege sets', () => {
  it('hands out no action that is reserved for the super-admin', () => {
    const handedOut = new Set<string>(STANDARD_ROLES.flatMap((role) => role.permissions))
    expect(ADMIN_ONLY.filter((permission) => handedOut.has(permission))).toEqual([])
  })

  /**
   * `view_own_customer` is not "sees less" — it is "sees the rows of his own firm", and a person
   * from the firm has no firm. A set carrying it would show an employee nothing and read like a bug.
   */
  it('hands out no action that belongs to a portal client', () => {
    const handedOut = new Set<string>(STANDARD_ROLES.flatMap((role) => role.permissions))
    expect(CLIENT_PERMISSIONS.filter((permission) => handedOut.has(permission))).toEqual([])
  })

  it('names only actions that exist in the catalog', () => {
    const catalog = new Set<string>(PERMISSIONS)
    const unknown = STANDARD_ROLES.flatMap((role) =>
      role.permissions.filter((permission) => !catalog.has(permission)),
    )
    expect(unknown).toEqual([])
  })

  it('gives every set a code of its own', () => {
    const codes = STANDARD_ROLES.map((role) => role.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
