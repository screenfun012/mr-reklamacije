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

/**
 * Text button in actions column — neutral until direct hover.
 *
 * It sets the COLOUR, which it did not until 2026-08-19: without it the `ghost` variant's
 * `text-primary` came through and every action in the column was brand red — the constant promised
 * neutral and delivered the loudest thing on the row. Found on the users screen, where five actions
 * per row meant eleven red words.
 */
export const dataTableTextActionClassName =
  'font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground'

/**
 * Destructive text action in actions column — muted until direct hover, and red only ON hover.
 * "Muted" is what the name always claimed; `text-destructive` unconditionally was the opposite.
 */
export const dataTableDestructiveActionClassName =
  'font-normal text-muted-foreground hover:bg-destructive/10 hover:text-destructive'

/**
 * The panel every admin table sits in. Extracted from `ResourceListPage`'s table when the roles
 * screen — built outside that abstraction, because a set of actions is not a catalogue row — came
 * out as a bare `<table>` on the page while the eight catalogue screens sat in a bordered card.
 * The difference was the only thing that made it read as a different product.
 *
 * Classes, not a component: `ResourceTable` is definition-driven (form fields, active/inactive,
 * usage counts) and roles have none of that. Sharing the LOOK is the whole overlap.
 *
 * The radius is internal-web's 14px, not Tailwind's `rounded-lg` (~8px at this preset's `--radius`).
 * It moved on 2026-08-19 so a filter panel and the list card beneath it share one edge. Only admin
 * consumes this constant, so internal-web and portal-web are untouched by the change.
 */
export const dataTableCardClassName = 'overflow-hidden rounded-[14px] border border-border bg-card'

/**
 * The head strip carries no fill. It is separated by its rule and by the type — mono, 9px, wide
 * tracking — which is how the prototype draws it; a tinted band under a card header was a second
 * horizontal edge two rules apart.
 */
export const dataTableHeadRowClassName = 'border-b border-border text-left'

export const dataTableHeadCellClassName =
  'px-[18px] py-2.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'

export const dataTableCellClassName = 'px-[18px] py-3'

/** Empty state for a list that has no rows yet — italic, quiet, and inside the card. */
export const dataTableEmptyClassName =
  'px-6 py-10 text-center text-[13.5px] italic text-muted-foreground'

/**
 * The block a screen is made of. internal-web wraps its filters, its list and every dashboard
 * section in this shape; admin wrapped only tables, which is most of why its screens read as loose
 * rows on a page rather than as a screen (Nikola, 2026-08-19: "prazan", "nije frendli").
 *
 * Same radius and border as `dataTableCardClassName` on purpose — a filter panel sits directly
 * above the list card, and two radii on one screen edge is the kind of wrongness a person sees
 * without being able to name.
 */
export const panelClassName = 'rounded-[14px] border border-border bg-card'

/** Title row of a panel: its name on the left, a count or an action on the right. */
export const panelHeaderClassName =
  'flex items-center justify-between gap-3 border-b border-border px-[18px] py-[13px]'

export const panelTitleClassName = 'text-[14.5px] font-extrabold text-foreground'

/** The quiet figure beside a panel title — a count, a range, a timestamp. */
export const panelMetaClassName =
  'font-mono text-[10.5px] font-semibold uppercase text-muted-foreground'
