import { dataTableIconActionClassName } from '@mr/ui'
import { Pencil, Power } from 'lucide-react'
import type { ReactElement } from 'react'

export interface ResourceRowActionsProps<TItem extends { id: string; isActive: boolean }> {
  item: TItem
  editLabel: string
  deactivateLabel: string
  activateLabel: string
  onEdit: (item: TItem) => void
  onToggleActive: (item: TItem) => void
}

/**
 * Icons, not text buttons. Every catalogue row carried a full brand-red "Deaktiviraj" beside a
 * red-outlined "Izmeni", so a thirteen-row screen was a column of red running down its side — which
 * is how a colour stops meaning anything. internal-web has used icon actions from the start.
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
  // control describe the row instead of the action — and then the same icon means two things.
  const toggleLabel = item.isActive ? deactivateLabel : activateLabel

  return (
    <>
      <button
        type="button"
        title={editLabel}
        aria-label={editLabel}
        className={dataTableIconActionClassName}
        onClick={() => {
          onEdit(item)
        }}
      >
        <Pencil className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        title={toggleLabel}
        aria-label={toggleLabel}
        className={dataTableIconActionClassName}
        onClick={() => {
          onToggleActive(item)
        }}
      >
        <Power className="size-4" aria-hidden="true" />
      </button>
    </>
  )
}
