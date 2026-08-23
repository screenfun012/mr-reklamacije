/**
 * The address `@svi` writes. Deliberately not a uuid, so a reserved recipient and a real one can
 * never be mistaken for each other by anything that reads a mention.
 */
export const MENTION_EVERYONE_ID = 'all'

export interface MentionMatch {
  /** Index of the first character of the whole `@[…](…)` run. */
  start: number
  /** Index one past its last character, so `text.slice(start, end)` is exactly the mention. */
  end: number
  /**
   * What was typed at the time. Only a fallback: the name on screen is read from the database, so
   * that renaming an account does not leave old messages talking about somebody who no longer
   * exists under that name.
   */
  label: string
  /** A user id, lowercased, or `MENTION_EVERYONE_ID`. */
  id: string
}

const MENTION_PATTERN = /@\[([^\]\n]{1,80})\]\(([0-9a-fA-F-]{36}|all)\)/g
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Every mention written in a message, in writing order.
 *
 * ⚠ The prototype matches a capitalised name in running text (`cet-prototip.dc.html:274`,
 * `@Dragan Ilić`). That model cannot survive a rename and cannot tell two people with the same
 * name apart, so the spec stores the id instead (§5 row 7) and this reads that. A bare `@name` is
 * therefore NOT a mention — it is words.
 *
 * An id that is neither a uuid nor the reserved one is skipped rather than trusted: a body is user
 * input, and a chip that answers a click with nothing is worse than plain text.
 */
export function findMentions(text: string): MentionMatch[] {
  const found: MentionMatch[] = []

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const label = match[1]
    const rawId = match[2]
    if (label === undefined || rawId === undefined) {
      continue
    }
    if (rawId !== MENTION_EVERYONE_ID && !UUID_PATTERN.test(rawId)) {
      continue
    }

    found.push({
      start: match.index,
      end: match.index + match[0].length,
      label,
      // Lowercased so the same person written two ways is one recipient, not two.
      id: rawId === MENTION_EVERYONE_ID ? MENTION_EVERYONE_ID : rawId.toLowerCase(),
    })
  }

  return found
}
