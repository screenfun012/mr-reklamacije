import { engineManufacturersReferenceOptions, type EngineManufacturerListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Heading } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import { EngineManufacturerDeactivateDialog } from './engine-manufacturer-deactivate-dialog.js'
import { EngineManufacturerFormDialog } from './engine-manufacturer-form-dialog.js'
import { EngineManufacturersTable } from './engine-manufacturers-table.js'

export function EngineManufacturersPage(): React.ReactElement {
  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: false }),
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<EngineManufacturerListItem | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<EngineManufacturerListItem | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level="h1">{m.admin_engine_manufacturers_title()}</Heading>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.admin_engine_manufacturers_subtitle()}
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {m.admin_engine_manufacturers_add()}
        </Button>
      </div>

      <EngineManufacturersTable
        items={manufacturers}
        onEdit={setEditTarget}
        onDeactivate={setDeactivateTarget}
      />

      <EngineManufacturerFormDialog open={createOpen} mode="create" onOpenChange={setCreateOpen} />

      {editTarget ? (
        <EngineManufacturerFormDialog
          open
          mode="edit"
          manufacturerId={editTarget.id}
          initialValues={{
            code: editTarget.code,
            name: editTarget.name,
            sortOrder: String(editTarget.sortOrder),
          }}
          onOpenChange={(open) => {
            if (!open) {
              setEditTarget(null)
            }
          }}
        />
      ) : null}

      {deactivateTarget ? (
        <EngineManufacturerDeactivateDialog
          open={deactivateTarget !== null}
          manufacturerId={deactivateTarget.id}
          manufacturerName={deactivateTarget.name}
          onOpenChange={(open) => {
            if (!open) {
              setDeactivateTarget(null)
            }
          }}
        />
      ) : null}
    </div>
  )
}
