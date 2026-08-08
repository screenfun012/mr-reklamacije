import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { useState, type ReactElement } from 'react'

import { IntakePanel } from './intake-panel'
import type { IntakeWizardValues } from './intake-wizard-state'

export interface StepSpecificationProps {
  values: IntakeWizardValues
  onPatch: (patch: Partial<IntakeWizardValues>) => void
}

/**
 * Step 4 — what is to be done and what goes into it. Plain lines: no catalogue, no quantities and
 * deliberately no prices, because the printed work order carries none ("Cene se ovde ne unose",
 * the worker instruction). Both lists stay editable for the life of the order, signed or not.
 */
export function StepSpecification({ values, onPatch }: StepSpecificationProps): ReactElement {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
      <IntakeSpecList
        title={m.intake_card_services()}
        items={values.services}
        placeholder={m.intake_service_add()}
        removeLabel={m.intake_service_remove()}
        onChange={(services) => onPatch({ services })}
      />
      <IntakeSpecList
        title={m.intake_card_materials()}
        items={values.materials}
        placeholder={m.intake_material_add()}
        removeLabel={m.intake_material_remove()}
        onChange={(materials) => onPatch({ materials })}
        note={m.intake_spec_note()}
      />
    </div>
  )
}

export interface IntakeSpecListProps {
  title: string
  items: readonly string[]
  placeholder: string
  removeLabel: string
  /**
   * May be async: on the detail every change is a `PATCH`, and the typed line must survive one
   * that fails. The wizard's synchronous handler satisfies this signature unchanged.
   */
  onChange: (items: string[]) => void | Promise<void>
  /** Only the materials card carries one, pinned to the bottom, as the prototype has it. */
  note?: string
  /**
   * A removed order: the server answers every PATCH of one with a 409, so an enabled field would
   * be an offer the screen cannot keep. The wizard never passes it.
   */
  disabled?: boolean
}

export function IntakeSpecList({
  title,
  items,
  placeholder,
  removeLabel,
  onChange,
  note,
  disabled = false,
}: IntakeSpecListProps): ReactElement {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const add = (): void => {
    const text = draft.trim()
    // Keeping the line until the change is accepted leaves it on screen for the whole round trip,
    // and on the detail an optimistic update has already put it in the list by then — so the
    // serviser sees it twice and presses Enter again on a field that looks like it did nothing.
    // Without this guard that sends the same line as many times as he presses.
    if (text.length === 0 || sending) {
      return
    }
    setSending(true)
    // The draft is cleared only once the change is accepted — clearing first would destroy the
    // typed line on a failed PATCH, the one moment the serviser cannot get it back. A rejection
    // is therefore handled here by keeping the line; SAYING what failed is the caller's job,
    // because only it knows what it was doing. The button comes back either way, or one refused
    // PATCH would lock the card for the rest of the visit.
    void Promise.resolve(onChange([...items, text])).then(
      () => {
        setDraft('')
        setSending(false)
      },
      () => setSending(false),
    )
  }

  return (
    <IntakePanel title={title} className="min-w-0 flex-1 gap-[13px]">
      {items.map((item, index) => (
        // Position is the whole identity of a line — two identical services are legitimate, so the
        // index is the only honest key and removal is by index too.
        <div
          key={`${index}-${item}`}
          className="flex items-center gap-[11px] rounded-[10px] bg-mri-inbg px-3.5 py-3"
        >
          <span className="w-[18px] flex-none font-mono text-[11.5px] font-semibold text-mri-text2">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 text-[14.5px]">{item}</span>
          <button
            type="button"
            onClick={() => {
              // The same reason `add()` routes through a promise: on the detail this is a `PATCH`,
              // and a refused one must not escape as an unhandled rejection. Saying WHAT failed is
              // the caller's job — only it knows what it was doing — so the refusal is absorbed
              // here and nowhere else.
              void Promise.resolve(
                onChange(items.filter((_, position) => position !== index)),
              ).catch(() => undefined)
            }}
            disabled={disabled}
            aria-label={removeLabel}
            className="h-11 w-9 flex-none cursor-pointer text-base text-mri-text2 disabled:cursor-default disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="flex gap-2.5">
        {/*
          16px is not a style choice: below it iOS zooms the page on focus, which throws the
          serviser out of the layout mid-intake (handoff §"Polja unosa 52px, font 16px+").
        */}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          // The schema's own ceiling: a longer line comes back a 400 with nothing on screen
          // explaining why (`IntakeOrderUpdateInputSchema`, services/materials max 200).
          maxLength={200}
          className="mri-input h-[52px] min-w-0 flex-1 rounded-[10px] border border-mri-border2 bg-mri-inbg px-[15px] text-base text-mri-text outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={add}
          disabled={sending || disabled}
          className={cn(
            'h-[52px] w-[130px] flex-none cursor-pointer rounded-[10px] border border-dashed border-mri-border2 bg-transparent text-[13px] font-bold uppercase tracking-[0.06em] text-mri-text2',
            'transition-colors duration-200 hover:border-mri-red hover:text-mri-redh motion-reduce:transition-none',
            'disabled:cursor-wait disabled:opacity-60 disabled:hover:border-mri-border2 disabled:hover:text-mri-text2',
          )}
        >
          {m.intake_spec_add()}
        </button>
      </div>

      {note !== undefined ? (
        <p className="mt-auto rounded-[11px] border border-[rgba(46,144,250,0.28)] bg-[rgba(46,144,250,0.1)] px-[15px] py-[13px] text-[13px] leading-[1.55] text-mri-info">
          {note}
        </p>
      ) : null}
    </IntakePanel>
  )
}
