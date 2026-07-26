import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

export interface IntakeChoice<T extends string> {
  value: T
  label: string
}

/**
 * The 56px choice row the prototype uses for "Način dolaska" and "Tip vozila", to its values:
 * `flex:1; height:56px; radius:11px; gap:10px`, the section label in red mono at `10px/.2em`,
 * and a hairline divider above it.
 *
 * The selected button is red-tinted with a red border and **white** text — not red text, which
 * is what I had. Unselected sits on `inbg`, not transparent.
 *
 * Tall on purpose: this is tapped with a finger, in a glove, standing next to the car.
 */
export function IntakeChoiceButtons<T extends string>({
  legend,
  options,
  value,
  onChange,
  labelSize = 15,
  divider = true,
}: {
  legend: string
  options: readonly IntakeChoice<T>[]
  value: T
  onChange: (value: T) => void
  /** 15px for the arrival row, 14.5px for the four vehicle types — the prototype differs by half a pixel. */
  labelSize?: 15 | 14.5
  divider?: boolean
}): ReactElement {
  return (
    <>
      {divider ? <div aria-hidden="true" className="h-px bg-mri-border" /> : null}
      <fieldset className="flex flex-col gap-2.5">
        <legend className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
          {legend}
        </legend>
        <div className="flex gap-2.5">
          {options.map((option) => {
            const selected = value === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                aria-pressed={selected}
                className={cn(
                  'h-14 flex-1 cursor-pointer rounded-[11px] border transition-colors',
                  labelSize === 15 ? 'text-[15px]' : 'text-[14.5px]',
                  selected
                    ? 'border-mri-red bg-[rgba(237,28,36,0.13)] font-bold text-mri-text'
                    : 'border-mri-border2 bg-mri-inbg font-semibold text-mri-text2 hover:text-mri-text',
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </fieldset>
    </>
  )
}
