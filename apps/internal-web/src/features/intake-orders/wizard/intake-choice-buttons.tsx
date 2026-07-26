import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

export interface IntakeChoice<T extends string> {
  value: T
  label: string
}

/**
 * The 56px choice row the handoff uses for "Način dolaska" and the vehicle type. Tall on
 * purpose: this is tapped with a finger, in a glove, standing next to the car.
 */
export function IntakeChoiceButtons<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: readonly IntakeChoice<T>[]
  value: T
  onChange: (value: T) => void
}): ReactElement {
  return (
    <fieldset className="flex flex-col gap-[7px]">
      <legend className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              'h-14 min-w-[92px] flex-1 cursor-pointer rounded-[10px] border px-3 text-[13px] font-semibold transition-colors',
              value === option.value
                ? 'border-mri-red bg-[rgba(237,28,36,0.1)] text-mri-redh'
                : 'border-mri-border2 text-mri-text2 hover:bg-mri-rowhv hover:text-mri-text',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
