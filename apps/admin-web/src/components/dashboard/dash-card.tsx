import { cn } from '@mr/ui'
import type { ReactElement, ReactNode } from 'react'

export interface DashCardProps {
  title: string
  /** Under the title, in the same block — a sentence explaining what the figures are. */
  subtitle?: string
  /** Beside the title, before the free space: a legend. */
  titleAfter?: ReactNode
  /** Right of the title: a count, a window, a link. */
  meta?: ReactNode
  /** The one card that carries a colour: accounts waiting for a decision. */
  accent?: 'amber'
  className?: string
  children: ReactNode
}

/**
 * The block the dashboard is made of (`admin-prototip.dc.html`): 13px radius, a bold 14.5px name,
 * and whatever the card is about beneath it.
 *
 * Its own component rather than `panelClassName`, which the list screens use: those have a ruled
 * header strip and a table under it, these have neither — sharing one shape would mean a card that
 * carries the strip nobody here wants.
 */
export function DashCard({
  title,
  subtitle,
  titleAfter,
  meta,
  accent,
  className,
  children,
}: DashCardProps): ReactElement {
  return (
    <section
      className={cn(
        'flex flex-col gap-[9px] rounded-[13px] border bg-card px-[18px] py-4',
        accent === 'amber' ? 'border-adm-amb/30' : 'border-border',
        className,
      )}
    >
      <div className="flex items-center gap-3.5">
        <div className="min-w-0">
          <h2 className="truncate text-[14.5px] font-extrabold text-foreground">{title}</h2>
          {subtitle === undefined ? null : (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {titleAfter}
        {meta === undefined ? null : <div className="ml-auto flex-none">{meta}</div>}
      </div>
      {children}
    </section>
  )
}

/** The quiet mono figure beside a card's name. */
export function DashCardMeta({ children }: { children: ReactNode }): ReactElement {
  return (
    <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">
      {children}
    </span>
  )
}

/**
 * A row inside a card. The rule under it is on every row including the last — the prototype draws
 * the list as a ledger, not as items with separators between them.
 */
export function DashRow({ children }: { children: ReactNode }): ReactElement {
  return <div className="flex items-center gap-[9px] border-b border-border py-2">{children}</div>
}

/** What a card says when it has nothing to list. Italic, quiet — never a blank card. */
export function DashEmpty({ children }: { children: ReactNode }): ReactElement {
  return <p className="text-pretty py-2 text-[12.5px] italic text-muted-foreground">{children}</p>
}
