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
      <SpecList
        title={m.intake_card_services()}
        items={values.services}
        placeholder={m.intake_service_add()}
        removeLabel={m.intake_service_remove()}
        onChange={(services) => onPatch({ services })}
      />
      <SpecList
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

interface SpecListProps {
  title: string
  items: readonly string[]
  placeholder: string
  removeLabel: string
  onChange: (items: string[]) => void
  /** Only the materials card carries one, pinned to the bottom, as the prototype has it. */
  note?: string
}

function SpecList({
  title,
  items,
  placeholder,
  removeLabel,
  onChange,
  note,
}: SpecListProps): ReactElement {
  const [draft, setDraft] = useState('')

  const add = (): void => {
    const text = draft.trim()
    if (text.length === 0) {
      return
    }
    onChange([...items, text])
    setDraft('')
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
            onClick={() => onChange(items.filter((_, position) => position !== index))}
            aria-label={removeLabel}
            className="h-11 w-9 flex-none cursor-pointer text-base text-mri-text2"
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
          className="mri-input h-[52px] min-w-0 flex-1 rounded-[10px] border border-mri-border2 bg-mri-inbg px-[15px] text-base text-mri-text outline-none"
        />
        <button
          type="button"
          onClick={add}
          className={cn(
            'h-[52px] w-[130px] flex-none cursor-pointer rounded-[10px] border border-dashed border-mri-border2 bg-transparent text-[13px] font-bold uppercase tracking-[0.06em] text-mri-text2',
            'transition-colors duration-200 hover:border-mri-red hover:text-mri-redh motion-reduce:transition-none',
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
