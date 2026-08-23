import { m } from '@mr/i18n'
import {
  chatConversationsOptions,
  findMrCandidates,
  useDebouncedValue,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { cn } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'

import { MR_CHIP_CLASSES } from './message-body'
import { THREAD_BADGE_CLASSES } from './new-thread-dialog'
import { findClaimThread, useCreateClaimThread } from './open-claim-thread'
import { useMrResolutions } from './use-mr-resolutions'

/**
 * The same wait the claim form's MR check uses. It is load-bearing here for a second reason: the
 * `MR-1234` shape needs no year, so a number is a valid candidate from its third digit onwards —
 * without this, typing one number would ask the server about every prefix of it.
 */
const SUGGESTION_DEBOUNCE_MS = 300

export interface WrittenClaim {
  /** Exactly as typed, so the offer names the thing the person is looking at. */
  raw: string
  target: MrRegistryExistingClaim
}

/**
 * The claim number written LAST in the draft — the one just finished, not the one recalled two
 * sentences ago.
 */
export function lastWrittenClaim(
  draft: string,
  resolutions: ReadonlyMap<string, MrRegistryExistingClaim>,
): WrittenClaim | null {
  let written: WrittenClaim | null = null
  for (const candidate of findMrCandidates(draft)) {
    const key = candidate.keys.find((candidateKey) => resolutions.has(candidateKey))
    const target = key === undefined ? undefined : resolutions.get(key)
    if (target !== undefined) {
      written = { raw: candidate.raw, target }
    }
  }
  return written
}

export interface ComposerMrSuggestionProps {
  /** What stands in the field right now. Nothing here is ever sent or stored. */
  draft: string
  /** The conversation being written in — an offer to open the room you are in is noise. */
  conversationId: string | undefined
  /** Where to go once there is a room to go to — the one the button just opened or made. */
  onOpened: (conversationId: string) => void
}

/**
 * „Prepoznat MR broj" — the offer above the field.
 *
 * The point is that the system PROPOSES and never acts (Nikola, 2026-08-23): somebody may write a
 * claim number just to say it, or type digits that are a phone number or a price. So a number that
 * names no claim shows nothing at all, and nothing here happens until a button is pressed.
 *
 * ⚠ Pressing it does the thing, with no dialog after (Nikola, 2026-08-23: „ne mora da izlazi
 * popup"). The bar IS the question, and a button that already reads NAPRAVI + is an answer to it —
 * asking twice is not caution, it is a second click. This makes it the third door that behaves the
 * same way: the „Nova nit" dialog's NAPRAVI badge and the claim detail's NAPRAVI NIT button both
 * write on one press. **The MR chip inside a sent message keeps its dialog** and must: clicking a
 * number in the middle of somebody's sentence says nothing about wanting a room (spec §8.2).
 *
 * ⚠ Not in the prototype, which has no composing-time affordance. Its two halves are borrowed
 * whole rather than invented: the number wears the message chip it is about to become, and the
 * button wears the „NIT POSTOJI →" / „NAPRAVI +" badge from the „Nova nit" dialog — the other
 * place in this app where a claim is offered a thread.
 */
export function ComposerMrSuggestion({
  draft,
  conversationId,
  onOpened,
}: ComposerMrSuggestionProps): React.ReactElement | null {
  // The same write the other two doors use — the endpoint is get-or-create, so two people pressing
  // at the same second land in the same room.
  const create = useCreateClaimThread(onOpened)
  const settled = useDebouncedValue(draft, SUGGESTION_DEBOUNCE_MS)
  const resolutions = useMrResolutions([settled])
  const written = lastWrittenClaim(settled, resolutions)

  // The list every internal screen already holds — the same row that makes „Nova nit" say POSTOJI
  // instead of NAPRAVI. A second endpoint answering "does this claim have a thread" would be a
  // second opinion about one row.
  const { data } = useQuery(chatConversationsOptions())
  const thread =
    written === null || data === undefined
      ? null
      : findClaimThread(data.items, written.target.claimId)

  // `thread?.id` would be `undefined` for a claim that has none — and equal to an absent
  // conversationId, which silently swallowed the NAPRAVI offer. Ask the real question.
  if (written === null || (thread !== null && thread.id === conversationId)) {
    return null
  }

  return (
    <div className="flex items-center gap-2 border-b border-mri-border bg-mri-inbg px-4 py-2">
      <span className="font-mono text-[8px] font-semibold tracking-[0.16em] text-mri-text2">
        {m.chat_mr_suggestion_eyebrow()}
      </span>
      <span className={MR_CHIP_CLASSES}>{written.raw}</span>
      <button
        type="button"
        disabled={create.isPending}
        onClick={() => (thread === null ? create.mutate(written.target) : onOpened(thread.id))}
        className={cn(
          THREAD_BADGE_CLASSES,
          'cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          thread === null
            ? 'border border-[rgba(31,169,113,.4)] bg-[rgba(31,169,113,.1)] text-mri-ok hover:bg-[rgba(31,169,113,.18)]'
            : 'border border-mri-border2 text-mri-text2 hover:border-mri-text2 hover:text-mri-text',
        )}
      >
        {thread === null ? m.chat_new_thread_create() : m.chat_new_thread_exists()}
      </button>
    </div>
  )
}
