import { m } from '@mr/i18n'
import { IntakeNumberCheckStatus, intakeNumberCheckOptions } from '@mr/shared'
import { cn } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useState, type ReactElement } from 'react'

import { INTERNAL_CONTROL_CLASSES } from '~/components/internal-field'
import { InternalNote } from '~/components/internal-note'

const CHECK_DEBOUNCE_MS = 400

export interface IntakeOrderNumberFieldProps {
  value: string
  onChange: (value: string) => void
  /** Called with the id of the caller's own unfinished intake behind this number. */
  onResume: (orderId: string) => void
  /** Reported upward so the footer can lock DALJE while the number belongs to someone else. */
  onTakenChange: (taken: boolean) => void
}

/**
 * The order number comes off a printed pad, so it is typed, not generated — and two
 * servisers can reach for the same sheet. The check runs on the server because a colleague's
 * unfinished intake lives there and nowhere else.
 */
export function IntakeOrderNumberField({
  value,
  onChange,
  onResume,
  onTakenChange,
}: IntakeOrderNumberFieldProps): ReactElement {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value)
    }, CHECK_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [value])

  const { data } = useQuery(intakeNumberCheckOptions(debounced))

  const status = debounced.trim() === value.trim() ? data?.status : undefined
  const takenByOther =
    status === IntakeNumberCheckStatus.TakenOrder ||
    status === IntakeNumberCheckStatus.TakenDraftOther

  useEffect(() => {
    onTakenChange(takenByOther)
  }, [takenByOther, onTakenChange])

  return (
    <div className="flex flex-col gap-2">
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
            'h-12 w-[132px] text-center font-mono text-sm',
            takenByOther && 'border-mri-bad',
          )}
        />
      </div>

      {status === IntakeNumberCheckStatus.TakenOrder && data ? (
        <InternalNote tone="error" role="alert" className="text-[13px]">
          <span className="flex flex-wrap items-center gap-2">
            {m.intake_number_taken_order({
              number: value.trim(),
              vehicle: data.vehicle ?? '',
              plate: data.plate ?? '',
            })}
            {data.orderId !== null ? (
              <Link
                to="/prijem/$id"
                params={{ id: data.orderId }}
                className="font-semibold text-mri-redh underline"
              >
                {m.intake_number_open_order()}
              </Link>
            ) : null}
          </span>
        </InternalNote>
      ) : null}

      {status === IntakeNumberCheckStatus.TakenDraftOther && data ? (
        <InternalNote tone="warn" role="alert" className="text-[13px]">
          {m.intake_number_taken_colleague({ name: data.takenByName ?? '' })}
        </InternalNote>
      ) : null}

      {status === IntakeNumberCheckStatus.TakenDraftMine && data?.orderId !== null && data ? (
        <InternalNote tone="warn" role="status" className="text-[13px]">
          <span className="flex flex-wrap items-center gap-2">
            {m.intake_number_taken_mine({ step: data.draftStep ?? 1 })}
            <button
              type="button"
              onClick={() => {
                if (data.orderId !== null) {
                  onResume(data.orderId)
                }
              }}
              className="cursor-pointer font-semibold text-mri-redh underline"
            >
              {m.intake_number_resume()}
            </button>
          </span>
        </InternalNote>
      ) : null}
    </div>
  )
}
