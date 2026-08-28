import { useEffect, useState } from 'react'

import { m } from '@mr/i18n'
import {
  attachmentsListOptions,
  buildAttachmentDownloadUrl,
  buildAttachmentThumbnailUrl,
  ClaimKind,
  isImageAttachmentMimeType,
} from '@mr/shared'
import { useQuery } from '@tanstack/react-query'

import { SectionNewBadge } from '~/components/section-new-badge'

/**
 * "Photos from the workshop" — client-visible attachments only (the server
 * enforces both the own-customer scope and the `client_visible` filter).
 * Plain query (not Suspense) so a photo fetch never blocks or breaks the
 * detail page; the whole card is hidden when there are no photos.
 */
export function PhotosCard({ claimId, isFresh }: { claimId: string; isFresh: boolean }) {
  const { data } = useQuery(attachmentsListOptions(ClaimKind.Emotive, claimId))
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Escape closes the lightbox (it also closes on any click).
  useEffect(() => {
    if (lightboxUrl === null) {
      return
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setLightboxUrl(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [lightboxUrl])

  const photos = (data?.items ?? []).filter((item) => isImageAttachmentMimeType(item.mimeType))
  if (photos.length === 0) {
    return null
  }

  return (
    <>
      <div
        className="mrp-fade-up rounded-[15px] border border-mrp-border bg-mrp-surface p-7"
        style={{ animationDelay: '0.3s' }}
      >
        <div className="mb-[18px] flex items-center gap-2.5">
          <h2 className="text-[17px] font-extrabold">{m.portal_detail_photos()}</h2>
          {isFresh && <SectionNewBadge />}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightboxUrl(buildAttachmentDownloadUrl(photo.id, 'inline'))}
              className="relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-[9px] border border-mrp-border transition-[transform,box-shadow] duration-200 hover:scale-[1.035] hover:shadow-[var(--mrp-shadow)] active:scale-100"
            >
              <img
                src={buildAttachmentThumbnailUrl(photo.id)}
                alt={photo.caption ?? m.portal_photo_alt()}
                loading="lazy"
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>

      {lightboxUrl !== null && (
        <div
          role="dialog"
          aria-label={m.portal_photo_alt()}
          onClick={() => setLightboxUrl(null)}
          className="mrp-fade-in fixed inset-0 z-[60] grid cursor-zoom-out place-items-center bg-[rgba(6,6,8,0.9)] backdrop-blur-[6px]"
        >
          <img
            src={lightboxUrl}
            alt={m.portal_photo_alt()}
            className="mrp-pop-in-fast max-h-[84vh] max-w-[min(84vw,1100px)] rounded-[9px] object-contain outline outline-1 -outline-offset-1 outline-mrp-border"
          />
        </div>
      )}
    </>
  )
}
