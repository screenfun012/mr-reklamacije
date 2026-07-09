import { TabsList, TabsTrigger, cn } from '@mr/ui'
import type { ComponentProps } from 'react'

/**
 * The `@mr/ui` Tabs primitive stays neutral (shared, portable to admin/portal).
 * These thin wrappers apply the internal `--mri-*` styling at the call site, so
 * the shared primitive keeps no app-specific token dependency and internal tabs
 * still match the redesign (hairline list, red active accent).
 */
const INTERNAL_TABS_LIST_CLASS = 'border-mri-border text-mri-text2'
const INTERNAL_TABS_TRIGGER_CLASS =
  'hover:text-mri-text focus-visible:ring-mri-red data-[state=active]:border-mri-red data-[state=active]:text-mri-text'

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
