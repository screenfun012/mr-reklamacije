import { cn } from '@mr/ui'

import type { StatusChipConfig } from '~/features/claims/claim-status-presentation'

import { MaskedIcon } from './masked-icon'

/** Status pill (mono caps): blue dot / spinning cog / green dot / X icon. */
export function StatusChip({
  config,
  size = 'sm',
}: {
  config: StatusChipConfig
  size?: 'sm' | 'lg'
}) {
  const sizing =
    size === 'lg'
      ? 'gap-2 px-3.5 py-1.5 text-[11px] tracking-[0.12em]'
      : 'gap-[7px] px-[11px] py-1 text-[10px] tracking-[0.1em]'
  const iconSize = size === 'lg' ? 'size-[13px]' : 'size-3'

  return (
    <span
      className={cn(
        'inline-flex flex-none items-center whitespace-nowrap rounded-full font-mono font-semibold uppercase',
        sizing,
      )}
      style={{ background: config.tint, color: config.color }}
    >
      {config.icon === 'cog' && <MaskedIcon name="cog" spinning className={iconSize} />}
      {config.icon === 'x' && <MaskedIcon name="x" className={iconSize} />}
      {config.icon === 'dot' && (
        <span
          className={cn('rounded-full', size === 'lg' ? 'size-2' : 'size-[7px]')}
          style={{ background: config.color }}
        />
      )}
      {config.label}
    </span>
  )
}
