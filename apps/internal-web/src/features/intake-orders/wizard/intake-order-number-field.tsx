import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

import { INTERNAL_CONTROL_CLASSES } from '~/components/internal-field'

export interface IntakeOrderNumberFieldProps {
  value: string
  onChange: (value: string) => void
  /** Drawn in the conflict colour while the number belongs to somebody else. */
  taken: boolean
}

/**
 * The order number comes off a printed pad, so it is typed, not generated. It lives in the stepper
 * strip, where the prototype puts it — and it is ONLY the label and the input: every note about
 * the number is rendered by `IntakeWizardNote` as a full-width bar under the strip. Nesting the
 * notes here instead made the strip grow and let two of them show at once.
 */
export function IntakeOrderNumberField({
  value,
  onChange,
  taken,
}: IntakeOrderNumberFieldProps): ReactElement {
  return (
    <div className="flex items-center gap-2.5">
      <label
        htmlFor="intake-order-number"
        className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2"
      >
        {m.intake_field_order_number()}
        <span className="text-mri-redh"> *</span>
      </label>
      <input
        id="intake-order-number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="RN-0000/26"
        autoComplete="off"
        className={cn(
          INTERNAL_CONTROL_CLASSES,
          'w-[132px] text-center font-mono text-sm',
          taken && 'border-mri-bad',
        )}
      />
    </div>
  )
}
