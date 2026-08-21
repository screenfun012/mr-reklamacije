import { TabsList, TabsTrigger, cn } from '@mr/ui'
import type { ComponentProps } from 'react'

/**
 * The `@mr/ui` Tabs primitive stays neutral (shared, portable to admin/portal).
 * These thin wrappers apply the internal `--mri-*` styling at the call site, so
 * the shared primitive keeps no app-specific token dependency and internal tabs
 * still match the redesign (hairline list, red active accent).
 *
 * Measurements from KOMPLETNA specifikacija §6: 22px between tabs, 12.5px label,
 * active bold with a red underline, and 6px between a tab's name and its counter —
 * without that gap the tab read "Nalazi1".
 */
const INTERNAL_TABS_LIST_CLASS = 'h-auto gap-[22px] border-mri-border text-mri-text2'
const INTERNAL_TABS_TRIGGER_CLASS =
  'gap-1.5 px-0.5 pb-[11px] pt-[9px] text-[12.5px] font-semibold hover:text-mri-text focus-visible:ring-mri-red data-[state=active]:border-mri-red data-[state=active]:font-bold data-[state=active]:text-mri-text'

export function InternalTabsList({
  className,
  ...props
}: ComponentProps<typeof TabsList>): React.ReactElement {
  return <TabsList className={cn(INTERNAL_TABS_LIST_CLASS, className)} {...props} />
}

export function InternalTabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsTrigger>): React.ReactElement {
  return <TabsTrigger className={cn(INTERNAL_TABS_TRIGGER_CLASS, className)} {...props} />
}

/**
 * The mono counter the prototype puts beside a tab's name ("Nalazi 2", "Prilozi 8"). Nothing is
 * rendered for zero — a tab that says "0" reads as broken rather than empty.
 */
export function InternalTabCount({ count }: { count: number }): React.ReactElement | null {
  if (count <= 0) {
    return null
  }

  return <span className="font-mono text-[10px] font-semibold">{count}</span>
}
