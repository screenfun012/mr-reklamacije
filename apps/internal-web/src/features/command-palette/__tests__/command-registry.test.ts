import { describe, expect, it } from 'vitest'

import { filterVisibleNavItems } from '~/config/navigation'
import { commandPaletteActionItems, commandPaletteNavItems } from '../command-registry'

describe('commandPaletteNavItems', () => {
  it('lists the sidebar screens plus security, and no create commands', () => {
    const keys = commandPaletteNavItems.map((item) => item.key)
    expect(keys).toContain('pocetna')
    expect(keys).toContain('bezbednost')
    expect(keys).not.toContain('nova-emotive')
  })

  it('keeps the sidebar order, because the palette numbers the rows', () => {
    expect(commandPaletteNavItems.slice(0, 5).map((item) => item.key)).toEqual([
      'pocetna',
      'pristiglo',
      'reklamacije',
      'masinska-obrada',
      'statistika',
    ])
  })
})

describe('commandPaletteActionItems', () => {
  it('holds the create commands', () => {
    expect(commandPaletteActionItems.map((item) => item.key)).toEqual([
      'nova-emotive',
      'nova-domace',
    ])
  })
})

describe('filterVisibleNavItems', () => {
  it('hides a command whose single permission the user lacks', () => {
    expect(filterVisibleNavItems(commandPaletteActionItems, []).map((item) => item.key)).toEqual([])
    // ungated commands still show
    const navKeys = filterVisibleNavItems(commandPaletteNavItems, []).map((item) => item.key)
    expect(navKeys).toContain('pocetna')
    expect(navKeys).toContain('bezbednost')
  })

  it('shows a command when the user has the required permission', () => {
    const visible = filterVisibleNavItems(commandPaletteActionItems, ['emotive_claims.create'])
    expect(visible.map((item) => item.key)).toContain('nova-emotive')
  })
})
