'use no memo'

import {
  CLAIM_DETAIL_DEFAULT_SEARCH,
  ClaimKind,
  ClaimSortBy,
  formatListDate,
  type ClaimListItem,
  type ClaimsSearch,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { dataTableIconActionClassName, dataTableRowNavigableClassName, Skeleton } from '@mr/ui'

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Column,
} from '@tanstack/react-table'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { KindPill } from '~/components/kind-pill'
import { OutcomePill } from '~/components/outcome-pill'

import { ClaimDeleteDialog } from './claim-delete-dialog'
import {
  claimsTableSortingFromSearch,
  createNextSortSearch,
  isSortableClaimColumnId,
  sortableColumnAriaSort,
} from './claims-table-sort'
import { useDeleteClaim } from './use-delete-claim'

interface ClaimsTableDeleteConfig {
  canDelete: (item: ClaimListItem) => boolean
  onDeleteRequest: (item: ClaimListItem) => void
}

function claimDeletePermission(
  item: ClaimListItem,
): 'emotive_claims.delete' | 'domace_claims.delete' {
  return item.kind === ClaimKind.Domace ? 'domace_claims.delete' : 'emotive_claims.delete'
}

export interface ClaimsTableProps {
  items: readonly ClaimListItem[]
  total: number
  search: ClaimsSearch
  onSearchChange: (next: ClaimsSearch) => void
}

const columnHelper = createColumnHelper<ClaimListItem>()

const rootRoute = getRouteApi('__root__')

function claimCustomerName(item: ClaimListItem): string | null {
  return item.customerName
}

function claimEngineCode(item: ClaimListItem): string {
  return item.engineTypeCode ?? '—'
}

function claimDetailLink(item: ClaimListItem): {
  to: '/reklamacije/emotive/$id' | '/reklamacije/domace/$id'
  params: { id: string }
  search: typeof CLAIM_DETAIL_DEFAULT_SEARCH
} {
  if (item.kind === ClaimKind.Domace) {
    return {
      to: '/reklamacije/domace/$id',
      params: { id: item.id },
      search: CLAIM_DETAIL_DEFAULT_SEARCH,
    }
  }
  return {
    to: '/reklamacije/emotive/$id',
    params: { id: item.id },
    search: CLAIM_DETAIL_DEFAULT_SEARCH,
  }
}

function SortableColumnHeader({
  column,
  label,
  search,
  onSearchChange,
}: {
  column: Column<ClaimListItem, unknown>
  label: string
  search: ClaimsSearch
  onSearchChange: (next: ClaimsSearch) => void
}) {
  const sorted = column.getIsSorted()
  const SortIcon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      onClick={(event) => {
        event.stopPropagation()
        if (!isSortableClaimColumnId(column.id)) {
          return
        }
        onSearchChange(createNextSortSearch(search, column.id))
      }}
    >
      <span>{label}</span>
      <SortIcon className={`size-3.5 ${sorted === false ? 'opacity-40' : ''}`} aria-hidden />
    </button>
  )
}

function createClaimsTableColumns(
  search: ClaimsSearch,
  onSearchChange: (next: ClaimsSearch) => void,
  deleteConfig: ClaimsTableDeleteConfig,
) {
  return [
    columnHelper.display({
      id: 'kind',
      header: () => m.claims_col_kind(),
      cell: ({ row }) => <KindPill kind={row.original.kind} />,
      meta: { cellClassName: 'px-4 py-3' },
    }),
    columnHelper.display({
      id: 'mrNumber',
      header: () => m.emotive_claims_col_mr_number(),
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.mrNumber ?? '—'}</span>,
      meta: { cellClassName: 'px-4 py-3' },
    }),
    columnHelper.display({
      id: 'claimNumber',
      header: () => m.emotive_claims_col_claim_number(),
      cell: ({ row }) => row.original.claimNumber ?? '—',
      meta: { cellClassName: 'px-4 py-3' },
    }),
    columnHelper.display({
      id: 'outcome',
      header: () => m.emotive_claims_col_outcome(),
      cell: ({ row }) => <OutcomePill outcome={row.original.outcome} />,
      meta: { cellClassName: 'px-4 py-3' },
    }),
    columnHelper.display({
      id: 'partner',
      header: () => m.emotive_claims_col_partner(),
      cell: ({ row }) => claimCustomerName(row.original) ?? '—',
      meta: { cellClassName: 'px-4 py-3' },
    }),
    columnHelper.display({
      id: 'engine',
      header: () => m.emotive_claims_col_engine(),
      cell: ({ row }) => <span className="font-mono text-xs">{claimEngineCode(row.original)}</span>,
      meta: { cellClassName: 'px-4 py-3' },
    }),
    columnHelper.display({
      id: 'employee',
      header: () => m.emotive_claims_col_employee(),
      cell: ({ row }) => row.original.employeeName ?? '—',
      meta: { cellClassName: 'px-4 py-3' },
    }),
    columnHelper.accessor('dateOfFinish', {
      id: ClaimSortBy.DateOfFinish,
      enableSorting: true,
      header: ({ column }) => (
        <SortableColumnHeader
          column={column}
          label={m.emotive_claims_col_date_finish()}
          search={search}
          onSearchChange={onSearchChange}
        />
      ),
      cell: ({ row }) =>
        row.original.dateOfFinish ? formatListDate(row.original.dateOfFinish) : '—',
      meta: { cellClassName: 'px-4 py-3 whitespace-nowrap' },
    }),
    columnHelper.accessor('dateOfClaim', {
      id: ClaimSortBy.DateOfClaim,
      enableSorting: true,
      header: ({ column }) => (
        <SortableColumnHeader
          column={column}
          label={m.emotive_claims_col_date_received()}
          search={search}
          onSearchChange={onSearchChange}
        />
      ),
      cell: ({ row }) =>
        row.original.dateOfClaim ? formatListDate(row.original.dateOfClaim) : '—',
      meta: { cellClassName: 'px-4 py-3 whitespace-nowrap' },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => m.emotive_claims_col_actions(),
      cell: ({ row }) => {
        const detailLink = claimDetailLink(row.original)

        return (
          <div className="flex items-center gap-2">
            <Link
              to={detailLink.to}
              params={detailLink.params}
              search={detailLink.search}
              className={dataTableIconActionClassName}
              aria-label={m.emotive_claims_detail_view_action()}
              onClick={(event) => event.stopPropagation()}
            >
              <Eye className="size-4" />
            </Link>
            {deleteConfig.canDelete(row.original) ? (
              <button
                type="button"
                className={`${dataTableIconActionClassName} hover:text-mri-error`}
                aria-label={m.action_delete()}
                onClick={(event) => {
                  event.stopPropagation()
                  deleteConfig.onDeleteRequest(row.original)
                }}
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
        )
      },
      meta: { cellClassName: 'px-4 py-3' },
    }),
  ]
}

export function ClaimsTable({ items, total, search, onSearchChange }: ClaimsTableProps) {
  const navigate = useNavigate()
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []
  const [deleteTarget, setDeleteTarget] = useState<ClaimListItem | null>(null)
  const deleteMutation = useDeleteClaim()

  const onDeleteRequest = useCallback((item: ClaimListItem) => {
    setDeleteTarget(item)
  }, [])
  const canDelete = useCallback(
    (item: ClaimListItem) => permissions.includes(claimDeletePermission(item)),
    [permissions],
  )

  const columns = useMemo(
    () => createClaimsTableColumns(search, onSearchChange, { canDelete, onDeleteRequest }),
    [onSearchChange, search, canDelete, onDeleteRequest],
  )
  const sorting = useMemo(() => claimsTableSortingFromSearch(search), [search])

  const handleConfirmDelete = (): void => {
    if (deleteTarget === null) {
      return
    }
    deleteMutation.mutate(
      { kind: deleteTarget.kind, id: deleteTarget.id },
      { onSuccess: () => setDeleteTarget(null) },
    )
  }

  const table = useReactTable({
    data: [...items],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => `${row.kind}-${row.id}`,
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    enableSortingRemoval: false,
    state: { sorting },
  })

  if (items.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-mri-border2 bg-mri-surface px-6 py-12 text-center"
        role="status"
      >
        <p className="text-sm font-semibold text-mri-text">{m.emotive_claims_empty_title()}</p>
        <p className="mt-1 text-sm italic text-mri-text2">{m.emotive_claims_empty_description()}</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-[14px] border border-mri-border bg-mri-surface">
        <div className="flex items-center justify-between border-b border-mri-border px-5 py-4">
          <h2 className="text-[15px] font-extrabold text-mri-text">
            {m.emotive_claims_list_title()}
          </h2>
          <span className="font-mono text-[11px] text-mri-text2">
            {m.emotive_claims_count({ count: total })}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b border-mri-border bg-mri-inbg text-left"
                >
                  {headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted()
                    const ariaSort = header.column.getCanSort()
                      ? sortableColumnAriaSort(sorted)
                      : undefined

                    return (
                      <th
                        key={header.id}
                        className="px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2"
                        aria-sort={ariaSort}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const detailLink = claimDetailLink(row.original)

                return (
                  <tr
                    key={row.id}
                    className={dataTableRowNavigableClassName}
                    onClick={() => {
                      void navigate(detailLink)
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={
                          (cell.column.columnDef.meta as { cellClassName?: string } | undefined)
                            ?.cellClassName ?? 'px-4 py-3'
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <ClaimDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        claim={deleteTarget}
        deleting={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}

const SKELETON_ROW_COUNT = 8

export function ClaimsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border" aria-busy="true">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <div key={index} className="flex gap-4 px-4 py-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
