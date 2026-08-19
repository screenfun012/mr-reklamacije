import { m } from '@mr/i18n'
import {
  cn,
  dataTableCardClassName,
  dataTableCellClassName,
  dataTableHeadCellClassName,
  dataTableHeadRowClassName,
  dataTableEmptyClassName,
  dataTableRowHoverOnlyClassName,
  panelHeaderClassName,
  panelMetaClassName,
  panelTitleClassName,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@mr/ui'
import { Trash2 } from 'lucide-react'

import { ResourceRowActions } from './resource-row-actions.js'
import type { ResourceColumnDef, ResourceDefinition } from './types.js'

/**
 * The one red control in a catalogue row: permanent deletion. Outlined rather than filled — the
 * filled red belongs to the confirm dialog, one step further in.
 */
const deleteButtonClassName =
  'inline-flex h-8 w-[34px] cursor-pointer items-center justify-center rounded-lg border border-mr-brand/40 text-adm-red-h transition-colors hover:bg-mr-brand/10 disabled:cursor-not-allowed'

export interface ResourceTableProps<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
> {
  definition: ResourceDefinition<TItem, TCreate, TUpdate>
  items: readonly TItem[]
  /**
   * The whole filtered set, not `items.length` — `items` is one page. A header that counted the
   * page would report "Ukupno: 25" on every catalogue big enough to paginate.
   */
  total: number
  onEdit: (item: TItem) => void
  onToggleActive: (item: TItem) => void
  onHardDelete?: (item: TItem) => void
  /** Rendered inside the card, under a rule — pagination belongs to the list, not to the page. */
  footer?: React.ReactNode
}

export function ResourceTable<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
>({
  definition,
  items,
  total,
  footer,
  onEdit,
  onToggleActive,
  onHardDelete,
}: ResourceTableProps<TItem, TCreate, TUpdate>): React.ReactElement {
  const lifecycle = definition.lifecycle

  return (
    <TooltipProvider delayDuration={300}>
      <div className={dataTableCardClassName}>
        {/* Not `definition.title()` — `ResourceListPage` already renders that as the page <h1>, and
            printing it twice on one screen is the fault found on the dashboard on 2026-08-19. */}
        <div className={panelHeaderClassName}>
          <h2 className={panelTitleClassName}>{m.admin_catalog_list_title()}</h2>
          <span className={panelMetaClassName}>{m.admin_catalog_count_total({ total })}</span>
        </div>
        {items.length === 0 ? (
          // Inside the card, not instead of it. A search filtered down to nothing used to make the
          // whole panel vanish, and a screen that disappears reads as broken rather than as
          // "no matches".
          <div className={dataTableEmptyClassName} role="status">
            {definition.emptyLabel()}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className={dataTableHeadRowClassName}>
                  {definition.columns.map((column: ResourceColumnDef<TItem>) => (
                    <th
                      key={column.id}
                      className={`${dataTableHeadCellClassName} ${column.headerClassName ?? ''}`}
                    >
                      {column.header()}
                    </th>
                  ))}
                  <th className={dataTableHeadCellClassName}>
                    <span className="sr-only">{definition.editActionLabel()}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const usageCount = lifecycle?.getUsageCount(item) ?? 0
                  const canHardDelete = lifecycle !== undefined && usageCount === 0

                  return (
                    <tr
                      key={item.id}
                      // A deactivated row stays legible but steps back — it is still a record, just
                      // not one anybody can choose any more.
                      className={cn(dataTableRowHoverOnlyClassName, !item.isActive && 'opacity-60')}
                    >
                      {definition.columns.map((column) => (
                        <td
                          key={column.id}
                          className={`${dataTableCellClassName} ${column.cellClassName ?? ''}`}
                        >
                          {column.cell(item)}
                        </td>
                      ))}
                      <td className={dataTableCellClassName}>
                        <div className="flex justify-end gap-1.5">
                          <ResourceRowActions
                            item={item}
                            editLabel={definition.editActionLabel()}
                            deactivateLabel={definition.deactivateConfirmLabel()}
                            activateLabel={
                              lifecycle?.reactivateConfirmLabel() ?? definition.activeYesLabel()
                            }
                            onEdit={onEdit}
                            onToggleActive={onToggleActive}
                          />
                          {lifecycle && onHardDelete ? (
                            canHardDelete ? (
                              <button
                                type="button"
                                className={deleteButtonClassName}
                                title={m.action_delete()}
                                aria-label={m.action_delete()}
                                onClick={() => onHardDelete(item)}
                              >
                                <Trash2 className="size-[13px]" aria-hidden="true" />
                              </button>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <button
                                      type="button"
                                      className={`${deleteButtonClassName} opacity-45`}
                                      disabled
                                      aria-label={m.action_delete()}
                                    >
                                      <Trash2 className="size-[13px]" aria-hidden="true" />
                                    </button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {lifecycle.hardDeleteBlockedTooltip()}
                                </TooltipContent>
                              </Tooltip>
                            )
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {footer === undefined ? null : <div className="px-[18px] py-3">{footer}</div>}
      </div>
    </TooltipProvider>
  )
}
