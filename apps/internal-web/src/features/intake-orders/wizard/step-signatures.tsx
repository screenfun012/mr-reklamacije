import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

import { IntakeSignaturePad, type SignatureStrokes } from './intake-signature-pad'

export interface StepSignaturesProps {
  technicianName: string
  ownerName: string
  damageCount: number
  photoCount: number
  technicianStrokes: SignatureStrokes
  ownerStrokes: SignatureStrokes
  onTechnicianChange: (update: (previous: SignatureStrokes) => SignatureStrokes) => void
  onOwnerChange: (update: (previous: SignatureStrokes) => SignatureStrokes) => void
  bothSigned: boolean
}

/**
 * Step 5 — the page the customer actually reads before putting a finger on the tablet. The counts
 * are printed as their own line rather than woven into the sentence: Serbian declines them, this
 * repo cannot use ICU plurals, and "1 uočenih nedostataka" on a document someone signs is worse
 * than a plain "Nedostataka: 1".
 */
export function StepSignatures({
  technicianName,
  ownerName,
  damageCount,
  photoCount,
  technicianStrokes,
  ownerStrokes,
  onTechnicianChange,
  onOwnerChange,
  bothSigned,
}: StepSignaturesProps): ReactElement {
  return (
    <div className="flex h-full flex-col gap-[18px]">
      <div className="flex flex-none flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="mb-2 text-[25px] font-extrabold leading-tight tracking-[-0.02em]">
            {m.intake_signature_title()}
          </h2>
          <p className="max-w-[760px] text-sm leading-[1.6] text-mri-text2">
            {m.intake_signature_intro()}
          </p>
          <p className="mt-1 text-sm font-semibold leading-[1.6] text-mri-text">
            {m.intake_signature_counts({ damages: damageCount, photos: photoCount })}
          </p>
        </div>

        <span className="inline-flex flex-none items-center gap-[9px] rounded-[10px] border border-mri-border bg-mri-surface px-[15px] py-[11px] text-[13px] text-mri-text2">
          <span
            className={cn('size-[7px] rounded-full', bothSigned ? 'bg-mri-grn' : 'bg-mri-amb')}
            aria-hidden="true"
          />
          {bothSigned ? m.intake_signature_ready() : m.intake_signature_waiting()}
        </span>
      </div>

      {/* `items-start`, and no `flex-1`: the pads size themselves now (see `IntakeSignaturePad`),
          and a row that stretched them was the thing that squeezed the drawing surface to 2px. */}
      <div className="flex flex-col gap-[18px] lg:flex-row lg:items-start">
        <IntakeSignaturePad
          title={m.intake_signature_technician()}
          name={technicianName}
          strokes={technicianStrokes}
          onChange={onTechnicianChange}
        />
        <IntakeSignaturePad
          title={m.intake_signature_owner()}
          name={ownerName}
          strokes={ownerStrokes}
          onChange={onOwnerChange}
        />
      </div>
    </div>
  )
}
