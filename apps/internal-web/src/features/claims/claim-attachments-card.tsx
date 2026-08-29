import { m } from '@mr/i18n'
import { attachmentsListOptions, buildAttachmentThumbnailUrl, type ClaimKind } from '@mr/shared'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import { InternalCard } from '~/components/internal-card'

export interface ClaimAttachmentsCardProps {
  kind: ClaimKind
  claimId: string
  /** Where the "+" tile sends someone — the tab that can actually upload and caption. */
  attachmentsTab: { to: string; params: { id: string }; search: Record<string, unknown> }
}

/** The prototype's window on the photos: the first six, then "Svi →" (handoff §5). */
const PREVIEW_COUNT = 6

/**
 * The photos, small, beside the claim rather than a tab away (prototype §6, right column). It is
 * a WINDOW, not a second uploader: the last few pictures at a glance, and both the "+" tile and
 * "Svi →" hand over to the attachments tab, which is where uploading, captioning and
 * client-visibility live.
 *
 * Deliberately not Suspense — a claim must open even when the photos are slow.
 */
export function ClaimAttachmentsCard({
  kind,
  claimId,
  attachmentsTab,
}: ClaimAttachmentsCardProps): React.ReactElement {
  const { data } = useQuery(attachmentsListOptions(kind, claimId))
  const items = (data?.items ?? []).slice(0, PREVIEW_COUNT)

  return (
    <InternalCard
      title={m.claim_detail_attachments_title()}
      {...(data === undefined ? {} : { meta: String(data.items.length) })}
      actions={
        <Link
          to={attachmentsTab.to}
          params={attachmentsTab.params}
          search={attachmentsTab.search}
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-mri-redh transition-colors hover:text-mri-text"
        >
          {m.claim_detail_attachments_all()}
        </Link>
      }
      bodyClassName="grid grid-cols-3 gap-2 px-[18px] py-[15px]"
    >
      {items.map((item) => (
        <Link
          key={item.id}
          to={attachmentsTab.to}
          params={attachmentsTab.params}
          search={attachmentsTab.search}
          title={item.fileName}
          className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-mri-border2 bg-mri-inbg transition-[border-color,transform] hover:border-mri-text2 active:scale-[0.98]"
        >
          {item.mimeType.startsWith('image/') ? (
            <img
              src={buildAttachmentThumbnailUrl(item.id)}
              alt={item.caption ?? item.fileName}
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <span className="truncate px-1 font-mono text-[10px] text-mri-text2">
              {item.fileName}
            </span>
          )}
        </Link>
      ))}

      <Link
        to={attachmentsTab.to}
        params={attachmentsTab.params}
        search={attachmentsTab.search}
        title={m.claim_detail_attachments_add()}
        aria-label={m.claim_detail_attachments_add()}
        className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-mri-border2 bg-mri-inbg text-[15px] text-mri-text2 transition-[color,border-color,transform] hover:border-mri-redh hover:text-mri-redh active:scale-[0.98]"
      >
        +
      </Link>
    </InternalCard>
  )
}
