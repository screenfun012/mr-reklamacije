import { cn } from '@mr/ui'
import type { ReactElement, ReactNode } from 'react'

export type InternalPageWidth = 'wide' | 'narrow'

const PAGE_WIDTHS: Record<InternalPageWidth, string> = {
  /** Lists, tables, KPI rows. */
  wide: 'max-w-[1280px]',
  /**
   * The serviser's wizard and other forms. Tablet-first: filled on a tablet, and on a desktop
   * merely centred rather than re-laid-out (docs/25, second grilling pass).
   */
  narrow: 'max-w-[980px]',
}

export interface InternalPageProps {
  width?: InternalPageWidth
  className?: string
  children: ReactNode
}

/**
 * The content frame. The shell's `<main>` gives padding and nothing else, so before this every
 * screen invented its own width — the intake list wrote `max-w-[1320px]` three times in one
 * file while the wizard had no bound at all and stretched to whatever the monitor allowed.
 * That is what "everything looks too big on the desktop" was.
 *
 * A screen picks one of the two widths and writes no `max-w` of its own. Added as a new option
 * rather than folded into `<main>`, so the screens outside Servis keep rendering exactly as
 * they do today until someone deliberately moves them over.
 */
export function InternalPage({
  width = 'wide',
  className,
  children,
}: InternalPageProps): ReactElement {
  return <div className={cn('mx-auto w-full', PAGE_WIDTHS[width], className)}>{children}</div>
}
