import { m } from '@mr/i18n'
import { IntakeNumberCheckStatus, intakeNumberCheckOptions } from '@mr/shared'
import { cn } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useState, type ReactElement, type ReactNode } from 'react'

import type { IntakeDraftBuffer } from './intake-wizard-state'

const CHECK_DEBOUNCE_MS = 400

const TONES = {
  warn: {
    box: 'border-[rgba(245,166,35,0.26)] bg-[rgba(245,166,35,0.09)]',
    tag: 'text-mri-warn',
    action: 'border-[rgba(245,166,35,0.45)] text-mri-warn',
  },
  bad: {
    box: 'border-[rgba(224,92,82,0.26)] bg-[rgba(224,92,82,0.09)]',
    tag: 'text-mri-redh',
    action: 'border-[rgba(224,92,82,0.45)] text-mri-redh',
  },
} as const

interface Note {
  tone: keyof typeof TONES
  tag: string
  text: ReactNode
  action?: ReactNode
  /** The buffer offer is the only one the serviser may wave away. */
  onDiscard?: () => void
}

export interface IntakeWizardNoteProps {
  orderNumber: string
  step: number
  /** The intake being edited right now, if it has already been created on the server. */
  currentOrderId: string | null
  /** A draft left on THIS tablet — the only trace of an intake abandoned before step 1 was left. */
  foundDraft: IntakeDraftBuffer | null
  onResumeServer: (orderId: string) => void
  onResumeBuffer: () => void
  onDiscardBuffer: () => void
  /** Reported upward so the footer can lock DALJE while the number belongs to someone else. */
  onTakenChange: (taken: boolean) => void
}

/**
 * The ONE bar under the stepper strip, as the prototype has it. Every state it can show is
 * decided here in a single if/else chain, which is the point: the number check and the resume
 * offer used to live in two components with independent triggers, so a serviser could be shown
 * two "Nastavi →" buttons for the same intake at the same time.
 */
export function IntakeWizardNote({
  orderNumber,
  step,
  currentOrderId,
  foundDraft,
  onResumeServer,
  onResumeBuffer,
  onDiscardBuffer,
  onTakenChange,
}: IntakeWizardNoteProps): ReactElement | null {
  const [debounced, setDebounced] = useState(orderNumber)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(orderNumber)
    }, CHECK_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [orderNumber])

  const { data } = useQuery(intakeNumberCheckOptions(debounced))

  // While the user is still typing the answer on screen belongs to the previous number.
  const status = debounced.trim() === orderNumber.trim() ? data?.status : undefined
  const takenByOther =
    status === IntakeNumberCheckStatus.TakenOrder ||
    status === IntakeNumberCheckStatus.TakenDraftOther

  useEffect(() => {
    onTakenChange(takenByOther)
  }, [takenByOther, onTakenChange])

  const note = ((): Note | null => {
    // Once the intake on screen IS that draft, the offer to resume it would point at where the
    // serviser already stands — the server answers "taken by you" for his own open intake.
    if (
      status === IntakeNumberCheckStatus.TakenDraftMine &&
      data?.orderId != null &&
      data.orderId !== currentOrderId
    ) {
      const orderId = data.orderId
      return {
        tone: 'warn',
        tag: m.intake_note_tag_mine(),
        text: m.intake_number_taken_mine({
          number: orderNumber.trim(),
          step: data.draftStep ?? 1,
        }),
        action: (
          <NoteButton tone="warn" onClick={() => onResumeServer(orderId)}>
            {m.intake_number_resume()}
          </NoteButton>
        ),
      }
    }

    if (status === IntakeNumberCheckStatus.TakenOrder && data) {
      return {
        tone: 'bad',
        tag: m.intake_note_tag_taken(),
        text: m.intake_number_taken_order({
          number: orderNumber.trim(),
          vehicle: data.vehicle ?? '',
          plate: data.plate ?? '',
        }),
        action:
          data.orderId !== null ? (
            <Link
              to="/prijem/$id"
              params={{ id: data.orderId }}
              className={cn(NOTE_ACTION_CLASSES, TONES.bad.action)}
            >
              {m.intake_number_open_order()}
            </Link>
          ) : undefined,
      }
    }

    if (status === IntakeNumberCheckStatus.TakenDraftOther && data) {
      return {
        tone: 'bad',
        tag: m.intake_note_tag_taken(),
        text: m.intake_number_taken_colleague({ name: data.takenByName ?? '' }),
      }
    }

    // The tablet's own buffer is offered only on step 1: past it the serviser is already inside an
    // intake, and an offer to jump into a different one would be a trap, not a help.
    if (foundDraft !== null && step === 1) {
      return {
        tone: 'warn',
        tag: m.intake_draft_tag(),
        text: m.intake_draft_found({
          number: foundDraft.values.orderNumber,
          step: foundDraft.step,
        }),
        action: (
          <NoteButton tone="warn" onClick={onResumeBuffer}>
            {m.intake_draft_resume()}
          </NoteButton>
        ),
        onDiscard: onDiscardBuffer,
      }
    }

    return null
  })()

  if (note === null) {
    return null
  }

  return (
    <div
      role={note.tone === 'bad' ? 'alert' : 'status'}
      className={cn(
        'mx-4 mt-3.5 flex flex-wrap items-center gap-3.5 rounded-[11px] border px-4 py-3.5 sm:mx-[26px]',
        TONES[note.tone].box,
      )}
    >
      <span
        className={cn(
          'flex-none font-mono text-[10px] font-bold uppercase tracking-[0.16em]',
          TONES[note.tone].tag,
        )}
      >
        {note.tag}
      </span>
      <span className="min-w-0 flex-1 text-[13.5px] leading-normal text-mri-text">{note.text}</span>
      {note.action}
      {note.onDiscard !== undefined ? (
        <button
          type="button"
          onClick={note.onDiscard}
          className="flex-none cursor-pointer text-[13px] text-mri-text2 underline"
        >
          {m.intake_draft_discard()}
        </button>
      ) : null}
    </div>
  )
}

const NOTE_ACTION_CLASSES =
  'flex h-[42px] flex-none cursor-pointer items-center rounded-[9px] border bg-transparent px-[18px] font-mono text-xs font-extrabold uppercase tracking-[0.08em]'

function NoteButton({
  tone,
  onClick,
  children,
}: {
  tone: keyof typeof TONES
  onClick: () => void
  children: ReactNode
}): ReactElement {
  return (
    <button type="button" onClick={onClick} className={cn(NOTE_ACTION_CLASSES, TONES[tone].action)}>
      {children}
    </button>
  )
}
