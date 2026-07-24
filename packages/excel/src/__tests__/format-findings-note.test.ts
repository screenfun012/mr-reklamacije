import { describe, expect, it } from 'vitest'

import { formatFindingsNote } from '../format-findings-note.js'

describe('formatFindingsNote', () => {
  it('joins findings as "text (type)" separated by semicolons', () => {
    expect(
      formatFindingsNote([
        { text: 'Zaribao', type: 'mehanika' },
        { text: 'Curi ulje', type: 'zaptivka' },
      ]),
    ).toBe('Zaribao (mehanika); Curi ulje (zaptivka)')
  })

  it('shows only the text when a finding has no type', () => {
    expect(formatFindingsNote([{ text: 'Bez tipa', type: null }])).toBe('Bez tipa')
    expect(formatFindingsNote([{ text: 'Prazan tip', type: '  ' }])).toBe('Prazan tip')
  })

  it('drops empty-text rows and returns null when nothing remains', () => {
    expect(formatFindingsNote([{ text: '   ', type: 'x' }])).toBeNull()
    expect(formatFindingsNote([])).toBeNull()
    expect(formatFindingsNote(null)).toBeNull()
  })
})
