import { m } from '@mr/i18n'
import { Button } from '@mr/ui'
import { Trash2 } from 'lucide-react'

import type { ResourceColumnDef, ResourceDefinition } from './types.js'

export interface ResourceTableProps<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
> {
  definition: ResourceDefinition<TItem, TCreate, TUpdate>
  items: readonly TItem[]
  onEdit: (item: TItem) => void
  onToggleActive: (item: TItem) => void
  onHardDelete?: (item: TItem) => void
}

export function ResourceTable<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
>({
  definition,
  items,
  onEdit,
  onToggleActive,
  onHardDelete,
}: ResourceTableProps<TItem, TCreate, TUpdate>): React.ReactElement {
  const lifecycle = definition.lifecycle

  if (items.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center"
        role="status"
      >
        <p className="text-sm text-muted-foreground">{definition.emptyLabel()}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left">
              {definition.columns.map((column: ResourceColumnDef<TItem>) => (
                <th
                  key={column.id}
                  className={`px-4 py-3 font-medium text-muted-foreground ${column.headerClassName ?? ''}`}
                >
                  {column.header()}
                </th>
              ))}
              <th className="px-4 py-3 font-medium text-muted-foreground">
                <span className="sr-only">{definition.editActionLabel()}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const usageCount = lifecycle?.getUsageCount(item) ?? 0
              const canHardDelete = lifecycle !== undefined && usageCount === 0

              return (
                <tr key={item.id} className="border-b border-border last:border-b-0">
                  {definition.columns.map((column) => (
                    <td key={column.id} className={`px-4 py-3 ${column.cellClassName ?? ''}`}>
                      {column.cell(item)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
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
                          : (lifecycle?.reactivateConfirmLabel() ?? definition.activeYesLabel())}
                      </Button>
                      {lifecycle && onHardDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          disabled={!canHardDelete}
                          title={
                            canHardDelete
                              ? m.action_delete()
                              : lifecycle.hardDeleteBlockedTooltip(item)
                          }
                          aria-label={
                            canHardDelete
                              ? m.action_delete()
                              : lifecycle.hardDeleteBlockedTooltip(item)
                          }
                          onClick={() => {
                            if (canHardDelete) {
                              onHardDelete(item)
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
