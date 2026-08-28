import { auditLogListOptions, type AuditLogFilters } from '@mr/shared'
import { m } from '@mr/i18n'
import { dataTableCardClassName, panelClassName, Skeleton } from '@mr/ui'
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
    <div className="adm-enter flex flex-col gap-4">
      <div>
        <h1 className="text-balance text-2xl font-extrabold tracking-[-0.02em] text-foreground">
          {m.audit_page_title()}
        </h1>
        <p className="mt-[5px] text-[13px] text-muted-foreground">{m.audit_page_subtitle()}</p>
      </div>

      <div className={`${panelClassName} px-4 py-3.5`}>
        <AuditLogFiltersBar filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* No name and no count on this card. It is an infinite query — it knows how many rows it has
          PULLED, not how many exist — and the filter bar above it already says what it holds. */}
      <div className={dataTableCardClassName}>
        {query.isPending ? (
          <div className="p-5">
            <AuditTableSkeleton />
          </div>
        ) : query.isError ? (
          <div className="px-6 py-10 text-center" role="alert">
            <p className="text-[13.5px] text-adm-red-h">{m.audit_error()}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-10 text-center" role="status">
            <p className="text-[13.5px] italic text-muted-foreground">{m.audit_empty()}</p>
          </div>
        ) : (
          <>
            <AuditLogTable items={items} />
            {query.hasNextPage ? (
              <div className="flex justify-center px-5 py-3.5">
                <button
                  type="button"
                  className="h-10 cursor-pointer rounded-[9px] border border-mr-border-strong bg-adm-inbg px-6 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                >
                  {query.isFetchingNextPage ? m.audit_loading_more() : m.audit_load_more()}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
