import { cn } from '@mr/ui'

const EMPTY = '—'

export interface ClaimDetailItemProps {
  label: string
  value: string | null
  /** Codes, numbers and dates are mono — everything a person reads character by character. */
  mono?: boolean
}

/** One cell of the "Osnovni podaci" grid — spec §6: mono label 8.5px over a 13px w600 value. */
export function ClaimDetailItem({
  label,
  value,
  mono = false,
}: ClaimDetailItemProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em] text-mri-text2">
        {label}
      </dt>
      <dd className={cn('text-[13px] font-semibold text-mri-text', mono && 'font-mono')}>
        {value ?? EMPTY}
      </dd>
    </div>
  )
}
