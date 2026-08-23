import { m } from '@mr/i18n'
import { findMrCandidates, type MrRegistryExistingClaim } from '@mr/shared'
import { cn } from '@mr/ui'

/**
 * The prototype's MR chip, read from `cet-prototip.dc.html` L279:
 * `font:600 11.5px mono; background:rgba(46,144,250,.13); color:var(--blu); padding:2px 7px;
 * border-radius:6px; white-space:nowrap`. `--blu` is `#2e90fa` (L14) — the app already carries
 * both as `mri-info` / `mri-info-bg`.
 */
export const MR_CHIP_CLASSES =
  'rounded-[6px] bg-mri-info-bg px-[7px] py-0.5 font-mono text-[11.5px] font-semibold whitespace-nowrap text-mri-info'

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
export function MessageBody({
  body,
  resolutions,
  onOpenClaim,
}: MessageBodyProps): React.ReactElement {
  const parts: React.ReactNode[] = []
  let cursor = 0

  for (const candidate of findMrCandidates(body)) {
    const key = candidate.keys.find((candidateKey) => resolutions.has(candidateKey))
    const target = key === undefined ? undefined : resolutions.get(key)
    if (target === undefined) {
      continue
    }
    if (candidate.start > cursor) {
      parts.push(body.slice(cursor, candidate.start))
    }
    parts.push(
      <Chip
        key={`${candidate.start}`}
        raw={candidate.raw}
        target={target}
        onOpenClaim={onOpenClaim}
      />,
    )
    cursor = candidate.end
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
