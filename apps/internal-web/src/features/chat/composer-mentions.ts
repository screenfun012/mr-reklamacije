import { MENTION_EVERYONE_ID } from '@mr/shared'

/**
 * A mention as it stands in the FIELD, where it reads `@Ana Anić` — not `@[Ana Anić](uuid)`.
 *
 * The raw markup is what travels to the server, and it has to: the id is the only thing that
 * survives a rename and the only thing that tells two colleagues with the same name apart (this
 * shop has two accounts called "Nikola Admin"). But a person writing a sentence should never see
 * it, so the field holds the words and this range holds the address.
 */
export interface DraftMention {
  /** Index of the `@`. */
  start: number
  /** One past the last character of the name. */
  end: number
  id: string
}

/** Everything the composer keeps about what is being written. */
export interface Draft {
  text: string
  mentions: readonly DraftMention[]
}

export const EMPTY_DRAFT: Draft = { text: '', mentions: [] }

/**
 * Writes a chosen person into the draft, in the words a person reads.
 *
 * The trailing space is not cosmetic: without it the next character would extend the mention's own
 * token and reopen the menu over a finished name.
 */
export function insertMention(
  draft: Draft,
  replaceFrom: number,
  replaceTo: number,
  person: { id: string; label: string },
): { draft: Draft; caret: number } {
  const written = `@${person.label} `
  const text = draft.text.slice(0, replaceFrom) + written + draft.text.slice(replaceTo)
  const end = replaceFrom + written.length - 1
  const shift = written.length - (replaceTo - replaceFrom)

  const mentions = draft.mentions
    // Anything the insertion point cut through stops being a mention — see `reanchorMentions`.
    .filter((mention) => mention.end <= replaceFrom || mention.start >= replaceTo)
    .map((mention) =>
      mention.start >= replaceTo
        ? { ...mention, start: mention.start + shift, end: mention.end + shift }
        : mention,
    )

  return {
    draft: {
      text,
      mentions: [...mentions, { start: replaceFrom, end, id: person.id }].sort(
        (left, right) => left.start - right.start,
      ),
    },
    caret: replaceFrom + written.length,
  }
}

/**
 * Keeps the addresses pointing at the right words after an ordinary edit.
 *
 * The edit is located by the longest common prefix and suffix — the textarea does not say what
 * changed, only what the value is now. Anything the edit reached INTO stops being a mention and
 * becomes plain words: a half-edited name must not keep silently addressing the person it used to
 * name. Typing before or after one only moves it.
 */
export function reanchorMentions(
  mentions: readonly DraftMention[],
  before: string,
  after: string,
): DraftMention[] {
  if (before === after) {
    return [...mentions]
  }

  let prefix = 0
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix += 1
  }
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1
  }

  const removedTo = before.length - suffix
  const shift = after.length - before.length

  return mentions
    .filter((mention) => mention.end <= prefix || mention.start >= removedTo)
    .map((mention) =>
      mention.start >= removedTo
        ? { ...mention, start: mention.start + shift, end: mention.end + shift }
        : mention,
    )
}

/**
 * The body the server is given: the words, with every live address written back in.
 *
 * Right to left, so an earlier replacement cannot move a later one's offsets.
 */
export function toWireBody(draft: Draft): string {
  return [...draft.mentions]
    .sort((left, right) => right.start - left.start)
    .reduce((body, mention) => {
      const label = body.slice(mention.start + 1, mention.end)
      const written =
        mention.id === MENTION_EVERYONE_ID ? '@[svi](all)' : `@[${label}](${mention.id})`
      return body.slice(0, mention.start) + written + body.slice(mention.end)
    }, draft.text)
}
