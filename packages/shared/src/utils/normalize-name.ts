const DIACRITIC_TO_ASCII: Readonly<Record<string, string>> = {
  č: 'c',
  Č: 'C',
  ć: 'c',
  Ć: 'C',
  š: 's',
  Š: 'S',
  ž: 'z',
  Ž: 'Z',
}

function isUppercaseLetter(ch: string | undefined): boolean {
  return ch !== undefined && ch !== ch.toLowerCase() && ch === ch.toUpperCase()
}

/**
 * Collapses ASCII digraphs that represent Serbian đ after transliteration:
 * DJ / Dj / dj → single D or d (left-to-right).
 */
function collapseDigraphAscii(s: string): string {
  let out = ''
  let i = 0
  while (i < s.length) {
    const two = s.slice(i, i + 2)
    if (two === 'DJ') {
      out += 'D'
      i += 2
      continue
    }
    if (two === 'Dj') {
      out += 'D'
      i += 2
      continue
    }
    if (two === 'dj') {
      out += 'd'
      i += 2
      continue
    }
    out += s.charAt(i)
    i += 1
  }
  return out
}

function mapNonDStrokeChar(ch: string): string {
  const mapped = DIACRITIC_TO_ASCII[ch]
  if (mapped !== undefined) {
    return mapped
  }
  return ch.normalize('NFD').replace(/\p{M}/gu, '')
}

/**
 * Readable ASCII for display/export. Preserves casing patterns; đ/Đ → dj/Dj/DJ.
 */
export function toAsciiDisplay(name: string): string {
  const trimmed = name.trim()
  if (trimmed === '') {
    return ''
  }

  const withSpaces = trimmed.replace(/\s+/g, ' ')
  let out = ''

  for (let i = 0; i < withSpaces.length; i += 1) {
    const ch = withSpaces.charAt(i)

    if (ch === '\u0111') {
      out += 'dj'
      continue
    }

    if (ch === '\u0110') {
      const next = i + 1 < withSpaces.length ? withSpaces.charAt(i + 1) : undefined
      out += isUppercaseLetter(next) ? 'DJ' : 'Dj'
      continue
    }

    out += mapNonDStrokeChar(ch)
  }

  return out
}

/**
 * Canonical matching key: same transliteration as display, collapse dj digraph, uppercase, whitespace.
 */
export function normalizeName(name: string): string {
  const displayed = toAsciiDisplay(name)
  const collapsed = collapseDigraphAscii(displayed)
  return collapsed.toUpperCase().replace(/\s+/g, ' ').trim()
}
