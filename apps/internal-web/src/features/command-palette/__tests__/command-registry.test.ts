import { describe, expect, it } from 'vitest'

import { filterVisibleNavItems } from '~/config/navigation'
import { commandPaletteNavItems } from '../command-registry'

describe('commandPaletteNavItems', () => {
  it('includes the create-claim and security commands', () => {
    const keys = commandPaletteNavItems.map((item) => item.key)
    expect(keys).toContain('nova-emotive')
    expect(keys).toContain('nova-domace')
    expect(keys).toContain('bezbednost')
  })
})

describe('filterVisibleNavItems', () => {
  it('hides a command whose single permission the user lacks', () => {
    const visible = filterVisibleNavItems(commandPaletteNavItems, [])
    const keys = visible.map((item) => item.key)
    expect(keys).not.toContain('nova-emotive')
    // ungated commands still show
    expect(keys).toContain('pocetna')
    expect(keys).toContain('bezbednost')
  })

  it('shows a command when the user has the required permission', () => {
    const visible = filterVisibleNavItems(commandPaletteNavItems, ['emotive_claims.create'])
    expect(visible.map((item) => item.key)).toContain('nova-emotive')
  })
})
