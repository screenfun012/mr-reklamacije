import type { ReactElement } from 'react'

/**
 * The chrome every row action wears: a 32px mono capsule. Bordered when it is the row's primary
 * action, transparent when it is the second one — the difference the prototype draws between
 * IZMENI and DEAKTIVIRAJ.
 */
export const rowActionClassName =
  'inline-flex h-8 cursor-pointer items-center rounded-lg border border-mr-border-strong px-3 font-mono text-[10px] font-bold uppercase text-muted-foreground transition-colors hover:text-foreground'

export interface ResourceRowActionsProps<TItem extends { id: string; isActive: boolean }> {
  item: TItem
  editLabel: string
  deactivateLabel: string
  activateLabel: string
  onEdit: (item: TItem) => void
  onToggleActive: (item: TItem) => void
}

/**
 * Named actions, not icons.
 *
 * They were icons until today (a pencil and a power symbol), which read as tidy and left every row
 * saying nothing: a power icon means "deactivate" only to somebody who already knows. The prototype
 * spells them out in mono at 10px, which costs the width the column had spare and is the version
 * Nikola approved. Red is gone from both — it belongs to the trash button beside them.
 *
 * Nothing hides behind a "…" menu: three actions fit in a row, and a hidden action is one nobody
 * finds.
 */
export function ResourceRowActions<TItem extends { id: string; isActive: boolean }>({
  item,
  editLabel,
  deactivateLabel,
  activateLabel,
  onEdit,
  onToggleActive,
}: ResourceRowActionsProps<TItem>): ReactElement {
  // Named for what the click WILL DO. Naming it after the row's state ("Aktivan") would make the
  // control describe the row instead of the action.
  const toggleLabel = item.isActive ? deactivateLabel : activateLabel

  return (
    <>
      <button
        type="button"
        title={editLabel}
        className={`${rowActionClassName} bg-adm-inbg`}
        onClick={() => {
          onEdit(item)
        }}
      >
        {editLabel}
      </button>
      <button
        type="button"
        title={toggleLabel}
        className={`${rowActionClassName} bg-transparent`}
        onClick={() => {
          onToggleActive(item)
        }}
      >
        {toggleLabel}
      </button>
    </>
  )
}
