import {
  filterResourceCatalogItems,
  paginateClientList,
  resourceCatalogPaginationFromSearch,
  type ListPageSize,
  type ResourceCatalogSearch,
} from '@mr/shared'
import { Button, Heading, ListPagination } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ResourceFormDialog } from './resource-form-dialog.js'
import { ResourceHardDeleteDialog } from './resource-hard-delete-dialog.js'
import { ResourceListToolbar } from './resource-list-toolbar.js'
import { ResourceTable } from './resource-table.js'
import { ResourceToggleActiveDialog } from './resource-toggle-active-dialog.js'
import type { ResourceDefinition } from './types.js'

export interface ResourceListPageProps<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
> {
  definition: ResourceDefinition<TItem, TCreate, TUpdate>
  search: ResourceCatalogSearch
  onSearchChange: (next: ResourceCatalogSearch) => void
}

export function ResourceListPage<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
>({
  definition,
  search,
  onSearchChange,
}: ResourceListPageProps<TItem, TCreate, TUpdate>): React.ReactElement {
  const { data: allItems } = useSuspenseQuery(definition.listQueryOptions({ activeOnly: false }))
  const listConfig = definition.listConfig

  const filteredItems = useMemo(() => {
    if (!listConfig) {
      return [...allItems]
    }

    return filterResourceCatalogItems(allItems, {
      query: search.q,
      status: search.status,
      getSearchableText: listConfig.getSearchableText,
    })
  }, [allItems, listConfig, search.q, search.status])

  const { page, pageSize } = resourceCatalogPaginationFromSearch(search)
  const paged = useMemo(
    () => paginateClientList(filteredItems, page, pageSize),
    [filteredItems, page, pageSize],
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TItem | null>(null)
  const [toggleActiveTarget, setToggleActiveTarget] = useState<TItem | null>(null)
  const [hardDeleteTarget, setHardDeleteTarget] = useState<TItem | null>(null)

  const handlePageChange = (nextPage: number): void => {
    onSearchChange({ ...search, page: nextPage })
  }

  const handlePageSizeChange = (nextPageSize: ListPageSize): void => {
    onSearchChange({ ...search, page: 1, pageSize: nextPageSize })
  }

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

      {listConfig ? <ResourceListToolbar search={search} onSearchChange={onSearchChange} /> : null}

      <ResourceTable
        definition={definition}
        items={paged.items}
        onEdit={setEditTarget}
        onToggleActive={setToggleActiveTarget}
        {...(definition.lifecycle ? { onHardDelete: setHardDeleteTarget } : {})}
      />

      {listConfig ? (
        <ListPagination
          total={paged.total}
          page={paged.page}
          pageSize={paged.pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      ) : null}

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

      {toggleActiveTarget !== null ? (
        <ResourceToggleActiveDialog
          definition={definition}
          item={toggleActiveTarget}
          open
          onOpenChange={(open) => {
            if (!open) {
              setToggleActiveTarget(null)
            }
          }}
        />
      ) : null}

      {hardDeleteTarget !== null && definition.lifecycle ? (
        <ResourceHardDeleteDialog
          definition={definition}
          item={hardDeleteTarget}
          open
          onOpenChange={(open) => {
            if (!open) {
              setHardDeleteTarget(null)
            }
          }}
        />
      ) : null}
    </div>
  )
}
