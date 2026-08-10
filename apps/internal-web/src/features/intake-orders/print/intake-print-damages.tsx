import { m } from '@mr/i18n'
import type { ReactElement } from 'react'

import { INTAKE_SILHOUETTE_VIEWBOX } from '../wizard/intake-silhouettes'
import type { IntakePrintModel } from './intake-print-data'
import { PRINT_BAND, PRINT_EYEBROW } from './intake-print-styles'

/** Past this many the list flows in two columns — see the comment at the list itself. */
const DEFECTS_PER_COLUMN = 6

/**
 * The drawing and what it means. Every marker prints solid red with a white digit, whatever the
 * defect type: the screen's amber and grey do not survive a printer, and a marker nobody can see
 * is a defect the customer never agreed to.
 */
export function IntakePrintDamages({ model }: { model: IntakePrintModel }): ReactElement {
  const { locale } = model

  return (
    <section>
      <div className={PRINT_BAND}>{m.intake_print_section_scheme({}, { locale })}</div>

      <div className="mt-[9px] grid grid-cols-[186px_1fr] gap-7">
        <svg
          data-testid="print-silhouette"
          width={146}
          height={238}
          viewBox={INTAKE_SILHOUETTE_VIEWBOX}
          fill="none"
          preserveAspectRatio="xMidYMid meet"
          className="text-[#17171a]"
        >
          {model.silhouette.map((path, index) => (
            <path
              key={index}
              d={path.d}
              fill="currentColor"
              fillOpacity={path.op === '0' ? '0' : '.05'}
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {model.markers.map((marker) => (
            <g
              key={marker.number}
              data-testid={`print-marker-${marker.number}`}
              fontFamily="JetBrains Mono, monospace"
              fontSize={15}
              fontWeight={700}
              textAnchor="middle"
            >
              <circle cx={marker.x} cy={marker.y} r={17} fill="#ed1c24" />
              <text x={marker.x} y={marker.textY} fill="#fff">
                {marker.number}
              </text>
            </g>
          ))}
        </svg>

        <div className="flex flex-col gap-[14px]">
          <div>
            <div className={PRINT_EYEBROW}>{m.intake_print_section_defects({}, { locale })}</div>
            {/*
              Two columns once the list is long. Measured 2026-08-10 in the browser: a defect row
              is 30px, and twelve of them in a single column push the sheet to 1247px against a
              fixed 1123 — the page overflows by 124px and the footer with both signatures walks
              onto a second sheet. Two columns fit the same twelve.
              The alternative was cutting the cap to the seven that fit, and defects are the one
              thing on this paper that must not be silently left off it.
            */}
            <div
              className={model.damages.length > DEFECTS_PER_COLUMN ? 'columns-2 gap-[18px]' : ''}
            >
              {model.damages.map((damage) => (
                <div
                  key={damage.id}
                  data-testid={`print-damage-${damage.number}`}
                  className="flex break-inside-avoid gap-3 border-b border-[#e6e7e9] py-[5px] text-[12px]"
                >
                  <span className="w-4 font-mono font-bold">{damage.number}</span>
                  <span className="flex-1">{damage.type}</span>
                  <span className="text-[#54555b]">{damage.zone}</span>
                </div>
              ))}
            </div>
            {model.damages.length === 0 ? (
              <p className="text-[11.5px] italic text-[#54555b]">
                {m.intake_print_no_damage({}, { locale })}
              </p>
            ) : null}
            {model.damagesOverflow > 0 ? (
              <p className="mt-[5px] text-[9.5px] text-[#54555b]">
                {m.intake_print_damages_more(
                  { count: model.damagesOverflow, number: model.orderNumber },
                  { locale },
                )}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-[22px]">
            <div>
              <div className={PRINT_EYEBROW}>{m.intake_print_section_services({}, { locale })}</div>
              {model.services.map((service) => (
                <div key={service} className="text-[12px] leading-[1.8]">
                  {service}
                </div>
              ))}
            </div>
            <div>
              <div className={PRINT_EYEBROW}>
                {m.intake_print_section_materials({}, { locale })}
              </div>
              {model.materials.map((material) => (
                <div key={material} className="text-[12px] leading-[1.8]">
                  {material}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
