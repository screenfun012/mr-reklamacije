import { m } from '@mr/i18n'
import {
  findMrCandidates,
  MENTION_EVERYONE_ID,
  uniqueMentions,
  type ChatMention,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { cn } from '@mr/ui'

/**
 * The prototype's MR chip, read from `cet-prototip.dc.html` L279:
 * `font:600 11.5px mono; background:rgba(46,144,250,.13); color:var(--blu); padding:2px 7px;
 * border-radius:6px; white-space:nowrap`. `--blu` is `#2e90fa` (L14) — the app already carries
 * both as `mri-info` / `mri-info-bg`.
 */
export const MR_CHIP_CLASSES =
  'rounded-[6px] bg-mri-info-bg px-[7px] py-0.5 font-mono text-[11.5px] font-semibold whitespace-nowrap text-mri-info'

/**
 * The prototype's mention chip, read from `cet-prototip.dc.html` L280:
 * `font-weight:700; background:rgba(237,28,36,.1); color:var(--redh); padding:2px 7px;
 * border-radius:6px; white-space:nowrap`. ⚠ Unlike the MR chip it sets NO font-family and no size,
 * so it inherits the message's own 13px Figtree — that difference is deliberate in the prototype
 * and is what makes a mention read as a name rather than as a code.
 */
const MENTION_CHIP_CLASSES =
  'rounded-[6px] bg-[rgba(237,28,36,0.1)] px-[7px] py-0.5 font-bold whitespace-nowrap text-mri-redh'

export interface MessageBodyProps {
  /** Exactly what was typed. Linkification happens HERE, at render — never in the database. */
  body: string
  /**
   * Registry key → the claim it belongs to. Resolved in one pass for the whole message list, so a
   * busy channel costs one request per distinct number rather than one per chip.
   */
  resolutions: ReadonlyMap<string, MrRegistryExistingClaim>
  /** Absent where there is nowhere to go — the chip is then drawn, but inert (prototype L279). */
  onOpenClaim?: ((target: MrRegistryExistingClaim) => void) | undefined
  /** What the server made of the ids in this body. A name of `null` means it named nobody live. */
  mentions?: readonly ChatMention[] | undefined
}

function Chip({
  raw,
  target,
  onOpenClaim,
}: {
  raw: string
  target: MrRegistryExistingClaim
  onOpenClaim: ((target: MrRegistryExistingClaim) => void) | undefined
}): React.ReactElement {
  if (onOpenClaim === undefined) {
    return <span className={MR_CHIP_CLASSES}>{raw}</span>
  }

  return (
    <button
      type="button"
      title={m.chat_mr_open_thread()}
      onClick={() => onOpenClaim(target)}
      className={cn(MR_CHIP_CLASSES, 'cursor-pointer align-baseline')}
    >
      {raw}
    </button>
  )
}

/**
 * One message's words, with every MR number that names a real claim turned into a link to its
 * thread. A number that resolves to nothing stays plain text (spec §8.1) — a chip that answered
 * a click with "nothing here" would be worse than no chip.
 */
/** One drawn run of the message, in the order it was written. */
interface Piece {
  start: number
  end: number
  node: React.ReactNode
}

export function MessageBody({
  body,
  resolutions,
  onOpenClaim,
  mentions,
}: MessageBodyProps): React.ReactElement {
  const nameById = new Map((mentions ?? []).map((mention) => [mention.id, mention.name]))
  const pieces: Piece[] = []

  for (const candidate of findMrCandidates(body)) {
    const key = candidate.keys.find((candidateKey) => resolutions.has(candidateKey))
    const target = key === undefined ? undefined : resolutions.get(key)
    if (target === undefined) {
      continue
    }
    pieces.push({
      start: candidate.start,
      end: candidate.end,
      node: (
        <Chip
          key={`mr-${candidate.start}`}
          raw={candidate.raw}
          target={target}
          onOpenClaim={onOpenClaim}
        />
      ),
    })
  }

  for (const mention of uniqueMentions(body)) {
    const everyone = mention.id === MENTION_EVERYONE_ID
    const name = nameById.get(mention.id) ?? null
    if (!everyone && name === null) {
      // Nobody live behind the id. The words stay words: a chip pointing at nobody would look
      // exactly like a link to a real person, and these messages are evidence for a claim.
      pieces.push({
        start: mention.start,
        end: mention.end,
        node: <span key={`mention-${mention.start}`}>@{mention.label}</span>,
      })
      continue
    }
    pieces.push({
      start: mention.start,
      end: mention.end,
      node: (
        <span key={`mention-${mention.start}`} className={MENTION_CHIP_CLASSES}>
          @{everyone ? m.chat_mention_everyone() : name}
        </span>
      ),
    })
  }

  // Both parsers walk the same string, so the runs are stitched back in written order.
  pieces.sort((left, right) => left.start - right.start)

  const parts: React.ReactNode[] = []
  let cursor = 0
  for (const piece of pieces) {
    if (piece.start > cursor) {
      parts.push(body.slice(cursor, piece.start))
    }
    parts.push(piece.node)
    cursor = piece.end
  }
  parts.push(body.slice(cursor))

  // `whitespace-pre-wrap` because Shift+Enter is a real line break in the composer, and a message
  // typed on three lines that arrives as one is a different message.
  return (
    <span className="text-[13px] leading-[1.55] break-words whitespace-pre-wrap text-mri-text">
      {parts}
    </span>
  )
}
