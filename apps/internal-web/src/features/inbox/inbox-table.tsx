import { formatListDateTime, type ClientSubmissionListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import { cn, dataTableRowNavigableClassName } from '@mr/ui'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Paperclip } from 'lucide-react'

const HEAD_CELL =
  'px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2'
const CELL = 'px-4 py-3'

export interface InboxTableProps {
  items: readonly ClientSubmissionListItem[]
  total: number
}

/** Pending client submissions as an internal-style list (mirrors the claims list). */
export function InboxTable({ items, total }: InboxTableProps): React.ReactElement {
  const navigate = useNavigate()

  if (items.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-mri-border2 bg-mri-surface px-6 py-12 text-center"
        role="status"
      >
        <p className="text-sm font-semibold text-mri-text">{m.internal_inbox_empty_title()}</p>
        <p className="mt-1 text-sm italic text-mri-text2">{m.internal_inbox_empty_description()}</p>
      </div>
    )
  }

  return (
    <div className="@container/inbox overflow-hidden rounded-[14px] border border-mri-border bg-mri-surface">
      <div className="flex items-center justify-between border-b border-mri-border px-5 py-4">
        <h2 className="text-[15px] font-extrabold text-mri-text">
          {m.internal_inbox_list_title()}
        </h2>
        <span className="font-mono text-[11px] text-mri-text2">
          {m.internal_inbox_count({ count: total })}
        </span>
      </div>
      <div className="hidden overflow-x-auto @min-[720px]/inbox:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-mri-border bg-mri-inbg text-left">
              <th className={HEAD_CELL}>{m.internal_inbox_col_firm()}</th>
              <th className={HEAD_CELL}>{m.internal_inbox_col_reason()}</th>
              <th className={HEAD_CELL}>{m.internal_inbox_col_attachments()}</th>
              <th className={HEAD_CELL}>{m.internal_inbox_col_received()}</th>
              <th className={HEAD_CELL} aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={dataTableRowNavigableClassName}
                onClick={() => {
                  void navigate({ to: '/pristiglo/$id', params: { id: item.id } })
                }}
              >
                <td className={`${CELL} font-semibold text-mri-text`}>{item.customerName}</td>
                <td className={CELL}>
                  <span className="block max-w-[420px] truncate text-mri-text2">
                    {item.message}
                  </span>
                </td>
                <td className={CELL}>
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-mri-text2">
                    <Paperclip className="size-3.5" aria-hidden="true" />
                    {item.attachmentCount}
                  </span>
                </td>
                <td className={`${CELL} whitespace-nowrap font-mono text-xs text-mri-text2`}>
                  {formatListDateTime(item.createdAt)}
                </td>
                <td className={`${CELL} text-right`}>
                  <Link
                    to="/pristiglo/$id"
                    params={{ id: item.id }}
                    className="inline-flex text-mri-text2 transition-colors hover:text-mri-redh"
                    aria-label={item.customerName}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ArrowRight className="size-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Narrow: the firm on top, then what they wrote, then the count and when. The switch is on
          the CONTAINER — the sidebar decides how much room this card really has, and the viewport
          does not know about the sidebar. */}
      <ul className="@min-[720px]/inbox:hidden">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              dataTableRowNavigableClassName,
              'flex flex-col gap-1.5 border-b border-mri-border px-4 py-3 last:border-b-0',
            )}
            onClick={() => {
              void navigate({ to: '/pristiglo/$id', params: { id: item.id } })
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[13.5px] font-semibold text-mri-text">
                {item.customerName}
              </span>
              <ArrowRight className="size-4 flex-none text-mri-text2" aria-hidden="true" />
            </div>
            <p className="line-clamp-2 text-[13px] text-mri-text2">{item.message}</p>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[12px] text-mri-text2">
              <span className="inline-flex items-center gap-1.5">
                <Paperclip className="size-3.5" aria-hidden="true" />
                {item.attachmentCount}
              </span>
              <span>{formatListDateTime(item.createdAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
