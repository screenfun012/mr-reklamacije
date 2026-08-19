/** Shared trigger/control chrome for Select, DatePicker, and future field primitives. */
export const fieldControlClassName =
  'flex h-9 w-full items-center rounded-md border border-input bg-background text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50'

export const fieldPopoverContentClassName =
  'z-[100] rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'

/**
 * Neutral list-item hover/focus/highlight for Select, DropdownMenu, SearchableSelect.
 * Implemented in @mr/tailwind-preset (.mr-list-item-interactive) — not Tailwind utilities.
 */
export const listItemInteractiveClassName = 'mr-list-item-interactive'

/** Selected list option — same neutral gray as hover (SearchableSelect / ListSelect). */
export const listItemSelectedClassName = 'bg-[var(--mr-list-item-hover)] font-medium'

/** Clickable data table rows (list navigation). Hover only — no row click in admin tables. */
export const dataTableRowInteractiveClassName = 'transition-colors hover:bg-muted/40'

export const dataTableRowBorderClassName = 'border-b border-border last:border-b-0'

/** Internal claims list — row navigates to detail on click. */
export const dataTableRowNavigableClassName = `cursor-pointer ${dataTableRowBorderClassName} ${dataTableRowInteractiveClassName}`

/** Admin catalog tables — visual hover only, no row navigation. */
export const dataTableRowHoverOnlyClassName = `${dataTableRowBorderClassName} ${dataTableRowInteractiveClassName}`

/** Icon control in actions column — subtle hover, subordinate to row highlight. */
export const dataTableIconActionClassName =
  'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground'

/** Text button in actions column — neutral until direct hover. */
export const dataTableTextActionClassName = 'font-normal hover:bg-muted/60'

/** Destructive text action in actions column — muted until direct hover. */
export const dataTableDestructiveActionClassName =
  'font-normal text-destructive hover:bg-destructive/10 hover:text-destructive'

/**
 * The panel every admin table sits in. Extracted from `ResourceListPage`'s table when the roles
 * screen — built outside that abstraction, because a set of actions is not a catalogue row — came
 * out as a bare `<table>` on the page while the eight catalogue screens sat in a bordered card.
 * The difference was the only thing that made it read as a different product.
 *
 * Classes, not a component: `ResourceTable` is definition-driven (form fields, active/inactive,
 * usage counts) and roles have none of that. Sharing the LOOK is the whole overlap.
 */
export const dataTableCardClassName = 'overflow-hidden rounded-lg border border-border'

export const dataTableHeadRowClassName = 'border-b border-border bg-muted/20 text-left'

export const dataTableHeadCellClassName = 'px-4 py-3 font-medium text-muted-foreground'

export const dataTableCellClassName = 'px-4 py-3'

/** Empty state for a list that has no rows yet — same dashed panel across admin. */
export const dataTableEmptyClassName =
  'rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center'
