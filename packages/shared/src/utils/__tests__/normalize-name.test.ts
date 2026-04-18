import { describe, expect, it } from 'vitest'

import { normalizeName, toAsciiDisplay } from '../normalize-name.js'

describe('normalizeName', () => {
  describe('with diacritics', () => {
    it('maps đ/Đ and other diacritics to canonical matching key', () => {
      expect(normalizeName('Đorđe Đukić')).toBe('DORDE DUKIC')
      expect(normalizeName('ĐORĐE ĐUKIĆ')).toBe('DORDE DUKIC')
      expect(normalizeName('Milovanović')).toBe('MILOVANOVIC')
      expect(normalizeName('MILOVANOVIĆ')).toBe('MILOVANOVIC')
      expect(normalizeName('Stanisavljević')).toBe('STANISAVLJEVIC')
      expect(normalizeName('Ivica Stanisavljević')).toBe('IVICA STANISAVLJEVIC')
    })

    it('maps č, š, ž to ASCII letters for matching', () => {
      expect(normalizeName('Česta šuma')).toBe('CESTA SUMA')
      expect(normalizeName('Žuti jež')).toBe('ZUTI JEZ')
    })
  })

  describe('with dj digraph', () => {
    it('maps dj spellings to the same key as đ spellings', () => {
      expect(normalizeName('Djordje Djukic')).toBe('DORDE DUKIC')
      expect(normalizeName('Dorde Dukic')).toBe('DORDE DUKIC')
    })
  })

  describe('without diacritics (ASCII already)', () => {
    it('uppercases and collapses whitespace', () => {
      expect(normalizeName('dejan milovanovic')).toBe('DEJAN MILOVANOVIC')
    })
  })

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(normalizeName('')).toBe('')
    })

    it('returns empty string for whitespace-only input', () => {
      expect(normalizeName('   ')).toBe('')
    })

    it('collapses internal and surrounding whitespace', () => {
      expect(normalizeName('  ivica   stanisavljević  ')).toBe('IVICA STANISAVLJEVIC')
      expect(normalizeName('  a  b  ')).toBe('A B')
    })

    it('normalizes tab and newline as whitespace', () => {
      expect(normalizeName('Ivica\tStanisavljević\n')).toBe('IVICA STANISAVLJEVIC')
    })
  })

  describe('idempotency', () => {
    it('returns the same key when applied twice', () => {
      const once = normalizeName('Đorđe Đukić')
      const twice = normalizeName(normalizeName('Đorđe Đukić'))
      expect(twice).toBe(once)
    })
  })
})

describe('toAsciiDisplay', () => {
  describe('with diacritics', () => {
    it('transliterates đ/Đ to dj digraph with appropriate casing', () => {
      expect(toAsciiDisplay('Đorđe Đukić')).toBe('Djordje Djukic')
      expect(toAsciiDisplay('ĐORĐE ĐUKIĆ')).toBe('DJORDJE DJUKIC')
      expect(toAsciiDisplay('đorđe đukić')).toBe('djordje djukic')
      expect(toAsciiDisplay('Đ')).toBe('Dj')
    })

    it('transliterates č, ć, š, ž for readable ASCII', () => {
      expect(toAsciiDisplay('Milovanović')).toBe('Milovanovic')
      expect(toAsciiDisplay('MILOVANOVIĆ')).toBe('MILOVANOVIC')
      expect(toAsciiDisplay('Stanisavljević')).toBe('Stanisavljevic')
      expect(toAsciiDisplay('Česta šuma')).toBe('Cesta suma')
      expect(toAsciiDisplay('Žuti jež')).toBe('Zuti jez')
      expect(toAsciiDisplay('ŽUTI JEŽ')).toBe('ZUTI JEZ')
    })

    it('handles mixed đ and other diacritics', () => {
      expect(toAsciiDisplay('Đorđe Milovanović')).toBe('Djordje Milovanovic')
    })
  })

  describe('case preservation', () => {
    it('preserves casing pattern for already-Latin letters where applicable', () => {
      expect(toAsciiDisplay('Ivica')).toBe('Ivica')
    })
  })

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(toAsciiDisplay('')).toBe('')
    })

    it('returns empty string for whitespace-only input', () => {
      expect(toAsciiDisplay('   ')).toBe('')
    })

    it('leaves plain ASCII unchanged', () => {
      expect(toAsciiDisplay('Ivica')).toBe('Ivica')
    })
  })
})
