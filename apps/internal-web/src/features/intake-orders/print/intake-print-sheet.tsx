import { m } from '@mr/i18n'
import type { IntakeOrderDetail } from '@mr/shared'
import type { ReactElement } from 'react'

import { SIGNATURE_VIEW_BOX } from '../wizard/intake-signature-pad'
import { IntakePrintCondition } from './intake-print-condition'
import { IntakePrintDamages } from './intake-print-damages'
import {
  buildIntakePrintModel,
  type IntakePrintLocale,
  type IntakePrintModel,
} from './intake-print-data'
import { IntakePrintPhotos } from './intake-print-photos'
import { PRINT_EYEBROW, PRINT_RULE } from './intake-print-styles'

/**
 * A4 at 96dpi. A FIXED height, never `min-height`: the page must not be allowed to grow into a
 * second one — when the content is too tall it is the rules in `intake-print-data.ts` that give,
 * not the paper.
 */
const SHEET = 'flex h-[1123px] w-[794px] flex-none flex-col bg-white text-[#17171a]'

function SignatureBox({
  path,
  role,
  name,
}: {
  path: string | null
  role: string
  name: string
}): ReactElement {
  return (
    <div>
      <div className="h-[50px]" data-testid="print-signature">
        {path === null ? null : (
          <svg
            viewBox={SIGNATURE_VIEW_BOX}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMax meet"
          >
            <path d={path} stroke="#17171a" strokeWidth={4} fill="none" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="h-px bg-[#17171a]" />
      <div className="mt-[5px] flex justify-between">
        <span className="font-mono text-[8.5px] font-bold uppercase tracking-[0.16em] text-[#54555b]">
          {role}
        </span>
        <span className="text-[11px] font-bold">{name}</span>
      </div>
    </div>
  )
}

/**
 * The printed work order. Rendered from the order's data, never from the screen's components: the
 * paper has its own typographic scale, a white background and no theme.
 *
 * `print-color-adjust: exact` is not decoration — without it the printer drops the red bands and
 * the defect markers, and the sheet loses the two things a reader navigates by.
 */
export function IntakePrintSheet({
  order,
  locale,
}: {
  order: IntakeOrderDetail
  /** Chosen in the preview, never read from the app: the paper speaks the customer's language. */
  locale: IntakePrintLocale
}): ReactElement {
  const model: IntakePrintModel = buildIntakePrintModel(order, locale)

  return (
    <div
      id="intake-print-sheet"
      className={SHEET}
      style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      {/* The black band, edge to edge, as "Obaveze kupca" carries it. */}
      <header className="flex flex-none items-center gap-4 bg-[#17171a] px-[54px] py-[18px] text-white">
        {/* The full emblem — red MR, white script, white "MADE IN SERBIA" ring — because that is
            what the black band on "Obaveze kupca" carries. The plain wordmark is the app's own
            chrome and reads as a different mark beside it. */}
        <img src="/internal/logo-emblem-white.png" alt="MR Engines" className="h-[46px] w-auto" />
        <div className="ml-2">
          <div className="text-[22px] font-black uppercase leading-none tracking-[-0.02em]">
            {m.intake_print_title({}, { locale })}
          </div>
          <div className="mt-1 text-[10.5px] text-[#b9babd]">
            {m.intake_print_subtitle({}, { locale })}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono text-[20px] font-bold">{model.orderNumber}</div>
          <div className="font-mono text-[9.5px] tracking-[0.08em] text-[#b9babd]">
            {model.receivedAt}
          </div>
        </div>
      </header>

      {/* `flex-1 min-h-0` rather than a calc against the band's height: the band is content-sized,
          and a hard-coded number here would silently push the footer off the page the day its
          padding changes. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-[54px] pb-[50px] pt-[18px]">
        <div className="grid grid-cols-2 gap-[34px]">
          <div>
            <div className={PRINT_EYEBROW}>{m.intake_print_section_owner({}, { locale })}</div>
            <div className="mt-[7px] text-[15px] font-extrabold">{model.ownerName}</div>
            <div className="mt-[3px] text-[11.5px] leading-[1.6] text-[#54555b]">
              {model.ownerAddress}
              <br />
              <span className="font-mono">{model.ownerPhone}</span>
            </div>
          </div>
          <div>
            <div className={PRINT_EYEBROW}>
              {m.intake_print_section_vehicle({ type: model.vehicleTypeLabel }, { locale })}
            </div>
            <div className="mt-[7px] text-[15px] font-extrabold">
              {model.vehicle} · <span className="font-mono">{model.plate}</span>
            </div>
            <div className="mt-[3px] text-[11.5px] leading-[1.6] text-[#54555b]">
              <span className="font-mono">{model.vin}</span>
              <br />
              <span className="font-mono">{model.mileage}</span> · {model.arrivalMode}
            </div>
          </div>
        </div>

        <div className={PRINT_RULE} />

        <IntakePrintCondition model={model} />

        <IntakePrintDamages model={model} />

        <IntakePrintPhotos model={model} />

        {/* Pinned to the bottom whatever the blocks above did. */}
        <footer className="mt-auto border-t-[2.5px] border-[#ed1c24] pt-[14px]">
          {model.amended === null ? null : (
            <div className="mb-[11px] flex items-center gap-2.5 border-[1.5px] border-[#ed1c24] bg-[rgba(237,28,36,0.06)] px-[11px] py-[7px]">
              <span className="flex-none font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#ed1c24]">
                {m.intake_print_amended({}, { locale })}
              </span>
              <span className="ml-auto font-mono text-[9px]">
                {model.amended.at} · {model.amended.by}
              </span>
            </div>
          )}

          <div className="mb-[14px] max-w-[600px] text-[9.5px] leading-[1.5] text-[#54555b]">
            {m.intake_print_legal(
              { count: model.photoCount, number: model.orderNumber },
              { locale },
            )}
          </div>

          <div className="grid grid-cols-2 gap-10">
            <SignatureBox
              path={model.technicianSignature}
              role={m.intake_print_role_technician({}, { locale })}
              name={model.technicianName}
            />
            <SignatureBox
              path={model.ownerSignature}
              role={m.intake_print_role_owner({}, { locale })}
              name={model.ownerName}
            />
          </div>
        </footer>
      </div>
    </div>
  )
}
