import { m } from '@mr/i18n'
import {
  Button,
  dataTableCardClassName,
  dataTableCellClassName,
  dataTableHeadCellClassName,
  dataTableHeadRowClassName,
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

import type { ResourceColumnDef, ResourceDefinition } from './types.js'

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
          <div className="px-5 py-12 text-center" role="status">
            <p className="text-sm text-muted-foreground">{definition.emptyLabel()}</p>
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
                    <tr key={item.id} className={dataTableRowHoverOnlyClassName}>
                      {definition.columns.map((column) => (
                        <td
                          key={column.id}
                          className={`${dataTableCellClassName} ${column.cellClassName ?? ''}`}
                        >
                          {column.cell(item)}
                        </td>
                      ))}
                      <td className={dataTableCellClassName}>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(item)}
                          >
                            {definition.editActionLabel()}
                          </Button>
                          <Button
                            type="button"
                            variant={item.isActive ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => onToggleActive(item)}
                          >
                            {item.isActive
                              ? definition.deactivateConfirmLabel()
                              : (lifecycle?.reactivateConfirmLabel() ??
                                definition.activeYesLabel())}
                          </Button>
                          {lifecycle && onHardDelete ? (
                            canHardDelete ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                aria-label={m.action_delete()}
                                onClick={() => onHardDelete(item)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-8 text-destructive hover:text-destructive"
                                      disabled
                                      aria-label={m.action_delete()}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
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
        {footer === undefined ? null : (
          <div className="border-t border-border px-5 py-3">{footer}</div>
        )}
      </div>
    </TooltipProvider>
  )
}
