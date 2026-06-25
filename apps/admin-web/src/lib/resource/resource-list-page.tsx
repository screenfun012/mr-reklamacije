import { Button, Heading } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import { ResourceDeactivateDialog } from './resource-deactivate-dialog.js'
import { ResourceFormDialog } from './resource-form-dialog.js'
import { ResourceTable } from './resource-table.js'
import type { ResourceDefinition } from './types.js'

export interface ResourceListPageProps<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
> {
  definition: ResourceDefinition<TItem, TCreate, TUpdate>
}

export function ResourceListPage<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
>({ definition }: ResourceListPageProps<TItem, TCreate, TUpdate>): React.ReactElement {
  const { data: items } = useSuspenseQuery(definition.listQueryOptions({ activeOnly: false }))

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TItem | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<TItem | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level="h1">{definition.title()}</Heading>
          <p className="mt-1 text-sm text-muted-foreground">{definition.subtitle()}</p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {definition.addLabel()}
        </Button>
      </div>

      <ResourceTable
        definition={definition}
        items={items}
        onEdit={setEditTarget}
        onDeactivate={setDeactivateTarget}
      />

      <ResourceFormDialog
        definition={definition}
        open={createOpen}
        mode="create"
        onOpenChange={setCreateOpen}
      />

      {editTarget !== null ? (
        <ResourceFormDialog
          definition={definition}
          open
          mode="edit"
          item={editTarget}
          onOpenChange={(open) => {
            if (!open) {
              setEditTarget(null)
            }
          }}
        />
      ) : null}

      {deactivateTarget !== null ? (
        <ResourceDeactivateDialog
          definition={definition}
          item={deactivateTarget}
          open
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
