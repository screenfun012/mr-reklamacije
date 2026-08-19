import { auditLogListOptions, type AuditLogFilters } from '@mr/shared'
import { m } from '@mr/i18n'
import {
  Button,
  dataTableCardClassName,
  Heading,
  panelClassName,
  panelHeaderClassName,
  panelTitleClassName,
  Skeleton,
} from '@mr/ui'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useState, type ReactElement } from 'react'

import { AuditLogFiltersBar } from './audit-log-filters'
import { AuditLogTable } from './audit-log-table'

function AuditTableSkeleton(): ReactElement {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function AuditPageContent(): ReactElement {
  const [filters, setFilters] = useState<AuditLogFilters>({})
  const query = useInfiniteQuery(auditLogListOptions(filters))

  const items = query.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="space-y-8">
      <div>
        <Heading level="h1" className="mb-2">
          {m.audit_page_title()}
        </Heading>
        <p className="text-muted-foreground">{m.audit_page_subtitle()}</p>
      </div>

      <div className={`${panelClassName} p-5`}>
        <AuditLogFiltersBar filters={filters} onFiltersChange={setFilters} />
      </div>

      <div className={dataTableCardClassName}>
        {/* No count beside the title. This is an infinite query — it knows how many rows it has
            PULLED, not how many exist, and a number that grows as you scroll is worse than none. */}
        <div className={panelHeaderClassName}>
          <h2 className={panelTitleClassName}>{m.admin_catalog_list_title()}</h2>
        </div>

        {query.isPending ? (
          <div className="p-5">
            <AuditTableSkeleton />
          </div>
        ) : query.isError ? (
          <div className="px-5 py-12 text-center" role="alert">
            <p className="text-sm text-mr-error-strong dark:text-mr-error">{m.audit_error()}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center" role="status">
            <p className="text-sm text-muted-foreground">{m.audit_empty()}</p>
          </div>
        ) : (
          <>
            <AuditLogTable items={items} />
            {query.hasNextPage ? (
              <div className="flex justify-center border-t border-border px-5 py-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                >
                  {query.isFetchingNextPage ? m.audit_loading_more() : m.audit_load_more()}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
