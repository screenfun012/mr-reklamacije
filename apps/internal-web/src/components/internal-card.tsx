import { cn } from '@mr/ui'
import type { ReactNode } from 'react'

// `title` is deliberately taken off the div's own attributes: here it is the card's heading,
// not the browser's tooltip, and the two cannot share a name.
export type InternalCardProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & {
  /** Card heading. Passing it renders the header bar and a padded body around `children`. */
  title?: ReactNode
  /** Right of the title: mono meta such as a count or the category's name. */
  meta?: ReactNode
  /** Far right of the header bar — badges and small controls. */
  actions?: ReactNode
  /** Dashed edge, reserved for "Polja kategorije" — deliberately a different card. */
  dashed?: boolean
  /** Replaces the default body padding (`18px` sides, `16px` top and bottom). */
  bodyClassName?: string
}

/**
 * Design-system card (DESIGN-GUIDELINES §5, KOMPLETNA specifikacija §0): surface background +
 * hairline border, radius 14px, NO shadow. The single source of truth for every card-shaped
 * container in the internal app.
 *
 * With a `title` it also draws the header bar and pads the body, which is the shape every card
 * on a claim screen has. Without one it stays the plain container it always was — the callers
 * that bring their own padding are unaffected.
 */
export function InternalCard({
  title,
  meta,
  actions,
  dashed = false,
  className,
  bodyClassName,
  children,
  ...props
}: InternalCardProps): React.ReactElement {
  const hasHeader = title !== undefined || meta !== undefined || actions !== undefined

  return (
    <div
      {...props}
      className={cn(
        'rounded-[14px] bg-mri-surface',
        dashed ? 'border border-dashed border-mri-border2' : 'border border-mri-border',
        hasHeader && 'overflow-hidden',
        className,
      )}
    >
      {hasHeader ? (
        <>
          <InternalCardHeader title={title} meta={meta} action={actions} />
          <div className={bodyClassName ?? 'px-[18px] py-4'}>{children}</div>
        </>
      ) : (
        children
      )}
    </div>
  )
}

/** Card header row: 14.5px w800 title left, optional meta/action right, hairline below. */
export function InternalCardHeader({
  title,
  meta,
  action,
  className,
}: {
  title: ReactNode
  meta?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2.5 border-b border-mri-border px-[18px] py-[13px]',
        className,
      )}
    >
      <h2 className="text-[14.5px] font-extrabold text-mri-text">{title}</h2>
      {meta === undefined ? null : (
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
          {meta}
        </span>
      )}
      {action === undefined ? null : (
        <div className="ml-auto flex flex-wrap items-center gap-2">{action}</div>
      )}
    </div>
  )
}
