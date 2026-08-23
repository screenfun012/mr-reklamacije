import { m } from '@mr/i18n'
import { MENTION_EVERYONE_ID, normalizeName, type ChatPerson } from '@mr/shared'
import { cn } from '@mr/ui'

/** What `@svi` looks like in the menu. Its label is a message, because the server sends none. */
export const EVERYONE_OPTION: ChatPerson = {
  id: MENTION_EVERYONE_ID,
  name: '',
  initials: '@',
}

export interface MentionQuery {
  /** Index of the `@` that opened it. */
  start: number
  /** What has been typed after it, without the `@`. */
  query: string
}

/**
 * The `@…` being typed at the caret, or `null` when there is none.
 *
 * ⚠ Only at the start of a word. Without that rule every e-mail address typed in the shop would
 * drop a list of colleagues over the field.
 */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret)
  const start = before.lastIndexOf('@')
  if (start === -1) {
    return null
  }

  const previous = start === 0 ? ' ' : before.charAt(start - 1)
  if (!/\s/.test(previous)) {
    return null
  }

  const query = before.slice(start + 1)
  // A space or a bracket means the mention is finished or abandoned — either way, not being typed.
  if (/[\s[\]()]/.test(query)) {
    return null
  }

  return { start, query }
}

/**
 * Whether this person answers to what is being typed.
 *
 * Matched through `normalizeName`, the same folding the employee roster uses: nobody reaches for Đ
 * on a hurried keyboard, so `djor` has to find `Đorđe`. Any WORD of the name may start the match,
 * because people are as often looked up by surname as by first name.
 */
export function matchesMentionQuery(name: string, query: string): boolean {
  if (query === '') {
    return true
  }

  const needle = normalizeName(query)
  return normalizeName(name)
    .split(' ')
    .some((word) => word.startsWith(needle))
}

/** `svi` first, then whoever answers to what is typed. */
export function mentionOptions(people: readonly ChatPerson[], query: string): ChatPerson[] {
  const everyone = matchesMentionQuery(m.chat_mention_everyone(), query) ? [EVERYONE_OPTION] : []

  return [...everyone, ...people.filter((person) => matchesMentionQuery(person.name, query))]
}

/** What choosing a person writes into the field, and where the caret lands after it. */
export function applyMention(
  text: string,
  mention: MentionQuery,
  caret: number,
  person: ChatPerson,
): { text: string; caret: number } {
  const label = person.id === MENTION_EVERYONE_ID ? m.chat_mention_everyone() : person.name
  // The trailing space is not cosmetic: without it the very next character would extend the
  // mention's own token and reopen the menu over a finished name.
  const written = `@[${label}](${person.id}) `

  return {
    text: text.slice(0, mention.start) + written + text.slice(caret),
    caret: mention.start + written.length,
  }
}

export interface MentionMenuProps {
  options: readonly ChatPerson[]
  activeIndex: number
  onPick: (person: ChatPerson) => void
}

/**
 * The list that opens over the composer.
 *
 * ⚠ The prototype does not draw one — the handoff describes it in a single sentence (§5) and
 * defers to "the same pattern as the category menu". So every value here is READ from
 * `category-chip-menu.tsx` rather than invented: `--raised`, radius 12, the same shadow, 31px rows,
 * the same hover, and the red tint for the row that is currently chosen.
 */
export function MentionMenu({
  options,
  activeIndex,
  onPick,
}: MentionMenuProps): React.ReactElement {
  return (
    <div
      role="listbox"
      aria-label={m.chat_mention_menu_label()}
      className="absolute bottom-full left-4 z-10 mb-1.5 max-h-[248px] w-[248px] overflow-auto rounded-xl border border-mri-border2 bg-mri-raised p-1.5 shadow-[0_18px_44px_rgba(0,0,0,.55)]"
    >
      {options.map((person, index) => {
        const everyone = person.id === MENTION_EVERYONE_ID
        return (
          <button
            key={person.id}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            // The pointer must not steal focus from the field, or the caret is lost mid-sentence.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(person)}
            className={cn(
              'flex h-[31px] w-full cursor-pointer items-center gap-2 rounded-lg px-[9px] text-left text-[12.5px] transition-colors hover:bg-mri-rowhv',
              index === activeIndex
                ? 'bg-[rgba(237,28,36,.11)] font-bold text-mri-text'
                : 'font-semibold text-mri-text2',
            )}
          >
            <span className="truncate">{everyone ? m.chat_mention_everyone() : person.name}</span>
            {everyone ? (
              <span className="ml-auto truncate text-[10.5px] font-medium text-mri-text2">
                {m.chat_mention_everyone_hint()}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
