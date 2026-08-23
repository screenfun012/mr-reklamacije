import { normalizeMrKey } from './normalize-mr-key.js'

export interface MrCandidate {
  /** Index of the first character of `raw` in the text it was found in. */
  start: number
  end: number
  /** Exactly as it was written — the chip shows what the person typed, never a tidied form. */
  raw: string
  /**
   * Registry keys to try, in order: the literal one first, then the same number without its `MR`
   * prefix. ⚠ `normalizeMrKey` does NOT strip that prefix, so `MR 7167/25` and `7167/25` are two
   * different keys — and this shop's data contains both spellings of the same claim. When there
   * is nothing to strip the two collapse into one, and only one lookup is asked for.
   */
  keys: string[]
}

/**
 * Every MR number written in a piece of text.
 *
 * The shapes are read off real production data (spec §3.5), not invented: `7167/25`, `MR1204/26`,
 * `MR-7167` and `MR 7167/25` all exist in the registry today. Resolution is somebody else's job —
 * this function only says "this looks like a claim number, and here is what to ask for".
 */
export function findMrCandidates(text: string): MrCandidate[] {
  const pattern = /(?:MR\s?-?)?\d{3,5}\s?\/\s?\d{2}|MR\s?-?\d{3,5}/gi
  const candidates: MrCandidate[] = []

  let match = pattern.exec(text)
  while (match !== null) {
    const raw = match[0]
    const start = match.index
    if (!isForeignNumber(text, start, start + raw.length)) {
      candidates.push({ start, end: start + raw.length, raw, keys: keysFor(raw) })
    }
    match = pattern.exec(text)
  }

  return candidates
}

/**
 * ⚠ The intake order number `RN-0249/26` carries digits shaped exactly like a claim's. It has its
 * own normaliser and its own registry, so a chip pointing at it would open a different car's
 * papers — and the guard has to hold for both `RN-0249/26` and `RN 0249/26`.
 *
 * The second half is the general form of the same mistake: digits glued to letters, another
 * slash, or more digits are part of a longer number nobody here issued.
 */
function isForeignNumber(text: string, start: number, end: number): boolean {
  const before = text.slice(0, start)
  if (/(?:^|[^0-9A-Za-z])RN[\s-]{0,2}$/i.test(before)) {
    return true
  }
  return /[0-9A-Za-z/-]$/.test(before) || /^[0-9/]/.test(text.slice(end))
}

function keysFor(raw: string): string[] {
  const literal = normalizeMrKey(raw)
  const stripped = normalizeMrKey(raw.replace(/^MR\s?-?\s?/i, ''))
  const keys = literal === null ? [] : [literal]
  if (stripped !== null && stripped !== literal) {
    keys.push(stripped)
  }
  return keys
}
