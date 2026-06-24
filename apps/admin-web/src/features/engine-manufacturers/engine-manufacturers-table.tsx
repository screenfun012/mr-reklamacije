import type { EngineManufacturerListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button } from '@mr/ui'

export interface EngineManufacturersTableProps {
  items: readonly EngineManufacturerListItem[]
  onEdit: (item: EngineManufacturerListItem) => void
  onDeactivate: (item: EngineManufacturerListItem) => void
}

export function EngineManufacturersTable({
  items,
  onEdit,
  onDeactivate,
}: EngineManufacturersTableProps): React.ReactElement {
  if (items.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center"
        role="status"
      >
        <p className="text-sm text-muted-foreground">{m.admin_engine_manufacturers_empty()}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.admin_engine_manufacturers_col_code()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.admin_engine_manufacturers_col_name()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.admin_engine_manufacturers_col_sort_order()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.admin_engine_manufacturers_col_active()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                <span className="sr-only">{m.action_edit()}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 font-mono text-xs">{item.code}</td>
                <td className="px-4 py-3">{item.name}</td>
                <td className="px-4 py-3 tabular-nums">{item.sortOrder}</td>
                <td className="px-4 py-3">
                  {item.isActive
                    ? m.admin_engine_manufacturers_active_yes()
                    : m.admin_engine_manufacturers_active_no()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onEdit(item)}>
                      {m.action_edit()}
                    </Button>
                    {item.isActive ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => onDeactivate(item)}
                      >
                        {m.admin_engine_manufacturers_deactivate_confirm()}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
