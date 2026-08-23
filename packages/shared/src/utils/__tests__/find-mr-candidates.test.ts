import { describe, expect, it } from 'vitest'

import { findMrCandidates } from '../find-mr-candidates.js'

/**
 * The four shapes are REAL production values (spec §3.5), not a regex somebody liked: the sheet
 * this data came from was filled in by hand for years, so the same number is written four ways.
 */
describe('findMrCandidates', () => {
  it('finds a bare number and offers the one key it can be', () => {
    const text = 'Stigao motor 7167/25 jutros'
    const [candidate] = findMrCandidates(text)

    expect(candidate).toBeDefined()
    expect(candidate?.raw).toBe('7167/25')
    expect(text.slice(candidate?.start ?? 0, candidate?.end ?? 0)).toBe('7167/25')
    // Nothing to strip, so the literal key IS the stripped one — asking twice would be one
    // wasted request per chip.
    expect(candidate?.keys).toEqual(['7167/25'])
  })

  it('finds the glued prefix and offers both keys, literal first', () => {
    const [candidate] = findMrCandidates('Reklamacija MR1204/26 je zatvorena')

    expect(candidate?.raw).toBe('MR1204/26')
    // ⚠ `normalizeMrKey` does not strip the prefix — these are two DIFFERENT registry keys, and
    // which one the claim carries depends on how it was typed years ago.
    expect(candidate?.keys).toEqual(['mr1204/26', '1204/26'])
  })

  it('finds a dashed prefix with no year at all', () => {
    const [candidate] = findMrCandidates('Vidi MR-7167 pre nego što odgovoriš')

    expect(candidate?.raw).toBe('MR-7167')
    expect(candidate?.keys).toEqual(['mr-7167', '7167'])
  })

  it('finds a spaced prefix and keeps the space in the literal key', () => {
    const [candidate] = findMrCandidates('MR 7167/25 čeka nalaz')

    expect(candidate?.raw).toBe('MR 7167/25')
    expect(candidate?.keys).toEqual(['mr 7167/25', '7167/25'])
  })

  it('finds every number in a sentence, in the order they were written', () => {
    const candidates = findMrCandidates('Uporedi 7167/25 sa MR-7089 i MR 1204/26.')

    expect(candidates.map((candidate) => candidate.raw)).toEqual([
      '7167/25',
      'MR-7089',
      'MR 1204/26',
    ])
  })

  it('returns nothing when there is no number', () => {
    expect(findMrCandidates('Motor je spreman, javljam sutra')).toEqual([])
    expect(findMrCandidates('')).toEqual([])
  })

  /**
   * ⚠ The one that must never pass. `RN-0249/26` is an INTAKE order number — its own normaliser,
   * its own registry, its own screen. Linked to a claim it would open a different car's papers.
   */
  it('never matches an intake order number', () => {
    expect(findMrCandidates('Nalog RN-0249/26 je potpisan')).toEqual([])
    expect(findMrCandidates('RN 0249/26')).toEqual([])
  })

  it('never matches digits that belong to a longer number', () => {
    expect(findMrCandidates('Faktura 12345/2026 stigla')).toEqual([])
    expect(findMrCandidates('ABC7167/25')).toEqual([])
  })
})
