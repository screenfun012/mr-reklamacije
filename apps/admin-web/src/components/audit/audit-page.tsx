import { auditLogListOptions, type AuditLogFilters } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Heading, Skeleton } from '@mr/ui'
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

      <AuditLogFiltersBar filters={filters} onFiltersChange={setFilters} />

      {query.isPending ? (
        <AuditTableSkeleton />
      ) : query.isError ? (
        <div
          className="rounded-lg border border-dashed border-mr-error/40 bg-mr-error-subtle px-6 py-12 text-center dark:bg-mr-error/15"
          role="alert"
        >
          <p className="text-sm text-mr-error-strong">{m.audit_error()}</p>
        </div>
      ) : items.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center"
          role="status"
        >
          <p className="text-sm text-muted-foreground">{m.audit_empty()}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AuditLogTable items={items} />
          {query.hasNextPage ? (
            <div className="flex justify-center">
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
        </div>
      )}
    </div>
  )
}
