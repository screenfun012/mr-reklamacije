'use no memo'

import {
  ClaimKind,
  ClaimSortBy,
  formatListDate,
  type ClaimListItem,
  type ClaimsSearch,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { cn, dataTableIconActionClassName, dataTableRowNavigableClassName, Skeleton } from '@mr/ui'

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Column,
} from '@tanstack/react-table'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { RowSelectionState } from '@tanstack/react-table'

import { KindPill } from '~/components/kind-pill'
import { OutcomePill } from '~/components/outcome-pill'
import { EmotiveClaimStageBadge } from '~/features/emotive-claims/emotive-claim-stage-badge'

import { claimDetailTarget } from '~/features/command-palette/claim-target'

import { ClaimCategoryChip } from './claim-category-chip'
import { ClaimDeleteDialog } from './claim-delete-dialog'
import { ClaimsCardList } from './claims-card-list'
import { ClaimsSelectionCheckbox } from './claims-selection-checkbox'
import { ClaimsSortSelect } from './claims-sort-select'
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
  /** Names the table after the kind of work it is showing (prototype §4). */
  categoryName?: string | undefined
  items: readonly ClaimListItem[]
  total: number
  search: ClaimsSearch
  onSearchChange: (next: ClaimsSearch) => void
  /** Off inside one category — every row would say the same thing. */
  showCategoryColumn: boolean
  /** The category this list is, when it is one: it travels into the detail link. */
  categoryCode?: string | undefined
  /** Rendered inside the card, under the table — the prototype keeps the pager on the card. */
  footer?: ReactNode
}

const columnHelper = createColumnHelper<ClaimListItem>()

const rootRoute = getRouteApi('__root__')

function claimCustomerName(item: ClaimListItem): string | null {
  return item.customerName
}

function claimEngineCode(item: ClaimListItem): string {
  return item.engineTypeCode ?? '—'
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
  showCategoryColumn: boolean,
  categoryCode: string | undefined,
) {
  return [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <ClaimsSelectionCheckbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onChange={(value) => table.toggleAllPageRowsSelected(value)}
          ariaLabel={m.claims_select_all_page()}
        />
      ),
      cell: ({ row }) => (
        <ClaimsSelectionCheckbox
          checked={row.getIsSelected()}
          onChange={(value) => row.toggleSelected(value)}
          ariaLabel={m.claims_select_row()}
        />
      ),
      meta: { cellClassName: 'px-4 py-3' },
    }),
    columnHelper.display({
      id: 'kind',
      header: () => m.claims_col_kind(),
      cell: ({ row }) => <KindPill kind={row.original.kind} />,
      meta: { cellClassName: 'px-4 py-3' },
    }),
    columnHelper.display({
      id: 'mrNumber',
      header: () => m.emotive_claims_col_mr_number(),
      // The "fill this in" mark rides with the MR NUMBER, not with the category chip the handoff
      // named: inside one category the category column is hidden, and that is precisely the list
      // where a claim missing its new fields has to be visible. The MR number is always there.
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono text-xs">{row.original.mrNumber ?? '—'}</span>
          {row.original.missingRequiredCategoryFields.length > 0 ? (
            <span
              title={m.claim_category_fields_incomplete_hint()}
              aria-label={m.claim_category_fields_incomplete_hint()}
              className="size-[6px] flex-none rounded-full bg-mri-amb"
            />
          ) : null}
        </span>
      ),
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
      id: 'visibility',
      header: () => m.claims_col_visibility(),
      cell: ({ row }) =>
        row.original.kind === ClaimKind.Emotive ? (
          <EmotiveClaimStageBadge
            clientVisibleAt={row.original.clientVisibleAt}
            publishedAt={row.original.publishedAt}
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      meta: { cellClassName: 'px-4 py-3' },
    }),
    columnHelper.display({
      id: 'partner',
      header: () => m.emotive_claims_col_partner(),
      cell: ({ row }) => claimCustomerName(row.original) ?? '—',
      meta: { cellClassName: 'px-4 py-3' },
    }),
    columnHelper.display({
      id: 'category',
      header: () => m.field_claim_category(),
      // Data, never a fork: the name is printed, nothing reads the code to decide anything.
      // A retired category is drawn apart — the claim keeps it, and the row says so.
      cell: ({ row }) => <ClaimCategoryChip category={row.original.category} />,
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
        const detailLink = claimDetailTarget(row.original, categoryCode)

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
                className={`${dataTableIconActionClassName} hover:text-mri-bad`}
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
  ].filter((column) => showCategoryColumn || column.id !== 'category')
}

export function ClaimsTable({
  items,
  total,
  search,
  onSearchChange,
  showCategoryColumn,
  categoryCode,
  categoryName,
  footer,
}: ClaimsTableProps) {
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
    () =>
      createClaimsTableColumns(
        search,
        onSearchChange,
        { canDelete, onDeleteRequest },
        showCategoryColumn,
        categoryCode,
      ),
    [onSearchChange, search, canDelete, onDeleteRequest, showCategoryColumn, categoryCode],
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

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const table = useReactTable({
    data: [...items],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => `${row.kind}-${row.id}`,
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    enableSortingRemoval: false,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    state: { sorting, rowSelection },
  })

  const selectedCount = Object.keys(rowSelection).length

  // Selection is per page: the rows change under it on a page/filter change, and
  // keeping ticks for rows no longer on screen ("5 selected", none visible) only
  // confuses. Clear whenever the query behind the table changes.
  useEffect(() => {
    setRowSelection({})
  }, [search])

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
      {/* The switch is on the CONTAINER, not the viewport: the same 1440px laptop gives this card
          1140px with the sidebar open and ~1310px with it collapsed, and a serviser has no sidebar
          at all — a viewport breakpoint gets two of those three wrong.

          960px, and it is not the table's own width: the thirteen cells are `whitespace-nowrap`,
          so the row's real min-content is 1715–1764px depending on which rows the page holds
          (measured in the browser, 2026-08-22) — the declared `min-w-[1160px]` is a floor the
          content passes anyway. "Does it fit" is therefore never true and cannot be the question;
          the question is whether reading this list through a sideways slot still beats a card, and
          under 960 it does not — you would see three columns of thirteen at a time. Every width
          that renders a table today keeps it: 1280 with the sidebar open is 980. */}
      <div className="@container/claims overflow-hidden rounded-[14px] border border-mri-border bg-mri-surface">
        <div className="flex items-center justify-between border-b border-mri-border px-5 py-4">
          {/* "Reklamacije — Mašinska obrada" inside a category, "Sve reklamacije" outside one:
              the card says what it is a list OF, not that it is a list (prototype §4). */}
          <h2 className="text-[15px] font-extrabold text-mri-text">
            {categoryName === undefined
              ? m.claims_list_all_title()
              : m.claims_table_title_category({ category: categoryName })}
          </h2>
          {selectedCount > 0 ? (
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] font-semibold tabular-nums text-mri-text">
                {m.claims_selected_count({ count: selectedCount })}
              </span>
              <button
                type="button"
                onClick={() => table.resetRowSelection()}
                className="relative py-2 font-mono text-[11px] text-mri-text2 transition-colors after:absolute after:inset-x-0 after:-inset-y-1 hover:text-mri-redh"
              >
                {m.claims_selection_clear()}
              </button>
            </div>
          ) : (
            <span className="font-mono text-[11px] uppercase tracking-[0.13em] tabular-nums text-mri-text2">
              {m.claims_table_total({ count: String(total) })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 border-b border-mri-border px-5 py-3 @min-[960px]/claims:hidden">
          <ClaimsSortSelect search={search} onSearchChange={onSearchChange} />
        </div>
        <div className="hidden overflow-x-auto @min-[960px]/claims:block">
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
                        className="whitespace-nowrap px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2"
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
                const detailLink = claimDetailTarget(row.original, categoryCode)

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
                        // One line per cell, as the prototype draws it. Without this a claim
                        // number broke into three lines and a partner into two, and a ten-row
                        // page grew to the height of a screen and a half.
                        className={cn(
                          'whitespace-nowrap',
                          (cell.column.columnDef.meta as { cellClassName?: string } | undefined)
                            ?.cellClassName ?? 'px-4 py-3',
                        )}
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
        <div className="@min-[960px]/claims:hidden">
          <ClaimsCardList
            rows={table.getRowModel().rows}
            showCategory={showCategoryColumn}
            categoryCode={categoryCode}
            canDelete={canDelete}
            onDeleteRequest={onDeleteRequest}
          />
        </div>
        {footer === undefined ? null : (
          <div className="border-t border-mri-border px-[18px] py-[11px]">{footer}</div>
        )}
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
