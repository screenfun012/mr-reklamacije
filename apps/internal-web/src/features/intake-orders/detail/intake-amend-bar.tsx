import { m } from '@mr/i18n'
import type { ReactElement } from 'react'

/**
 * The strip that says the screen is in a different mode, with the only two ways out of it.
 *
 * Its amber is byte-for-byte the draft bar's and the photos note's: the tone means "this order is
 * not in its resting state", and a third literal pair would read as a third meaning. Geometry is
 * the prototype's (§3.4): padding 13/16, radius 12, gap 14, the tag mono 10/700/.16em.
 */
export function IntakeAmendBar({
  onCancel,
  onSave,
  pending,
}: {
  onCancel: () => void
  onSave: () => void
  pending: boolean
}): ReactElement {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-[14px] rounded-[12px] border border-[rgba(245,165,36,0.4)] bg-[rgba(245,165,36,0.09)] px-4 py-[13px]"
    >
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-mri-amb">
        {m.intake_amend_bar_tag()}
      </span>

      <span className="min-w-0 flex-1 text-[13.5px] leading-[1.5] text-mri-text">
        {m.intake_amend_bar_note()}
      </span>

      <div className="flex flex-none gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 cursor-pointer rounded-[9px] border border-mri-border2 bg-transparent px-4 font-mono text-xs font-bold uppercase tracking-[0.06em] text-mri-text2 transition-colors hover:text-mri-text"
        >
          {m.intake_amend_cancel()}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="h-11 cursor-pointer rounded-[9px] border border-[rgba(31,169,113,0.45)] bg-[rgba(31,169,113,0.16)] px-5 font-mono text-xs font-extrabold uppercase tracking-[0.06em] text-mri-ok transition-colors hover:bg-[rgba(31,169,113,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {m.intake_amend_save()}
        </button>
      </div>
    </div>
  )
}
