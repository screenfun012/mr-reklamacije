import {
  filterResourceCatalogItems,
  paginateClientList,
  resourceCatalogPaginationFromSearch,
  type ListPageSize,
  type ResourceCatalogSearch,
} from '@mr/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { ResourceFormDialog } from './resource-form-dialog.js'
import { ResourcePagination } from './resource-pagination.js'
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
    }).filter((item) => {
      if (search.manufacturerId === undefined || listConfig.manufacturerFilter === undefined) {
        return true
      }
      return listConfig.manufacturerFilter.getManufacturerId(item) === search.manufacturerId
    })
  }, [allItems, listConfig, search.q, search.status, search.manufacturerId])

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
    <div className="adm-enter flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-balance text-2xl font-extrabold tracking-[-0.02em] text-foreground">
            {definition.title()}
          </h1>
          <p className="mt-[5px] text-[13px] text-muted-foreground">{definition.subtitle()}</p>
        </div>
        {/* The one filled button on the screen, and it is NOT red: in this panel red means
            identity or destruction, and "add a row" is neither (prototype §1). */}
        <button
          type="button"
          className="h-11 cursor-pointer rounded-[10px] bg-adm-btn px-[22px] text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-adm-btn-fg shadow-[0_8px_22px_rgba(0,0,0,.3)] transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
          onClick={() => setCreateOpen(true)}
        >
          {definition.addLabel()}
        </button>
      </div>

      {listConfig ? (
        <ResourceListToolbar
          search={search}
          onSearchChange={onSearchChange}
          showManufacturerFilter={listConfig.manufacturerFilter !== undefined}
        />
      ) : null}

      <ResourceTable
        definition={definition}
        items={paged.items}
        total={paged.total}
        onEdit={setEditTarget}
        onToggleActive={setToggleActiveTarget}
        {...(definition.lifecycle ? { onHardDelete: setHardDeleteTarget } : {})}
        {...(listConfig && paged.total > 0
          ? {
              // Inside the card: the pages belong to the list, not to the page they happen to sit
              // on. No rule above it — the last row's own border is already that line. Hidden
              // entirely at zero rows: "Prikazano 0–0 od 0" beside a page-size selector is
              // furniture for a list that is not there.
              footer: (
                <ResourcePagination
                  total={paged.total}
                  page={paged.page}
                  pageSize={paged.pageSize}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              ),
            }
          : {})}
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
