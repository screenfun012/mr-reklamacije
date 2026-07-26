import { m } from '@mr/i18n'
import {
  IntakeDamageType,
  INTAKE_DAMAGE_MAP_HEIGHT,
  INTAKE_DAMAGE_MAP_WIDTH,
  type IntakeDamage,
  type IntakeVehicleType,
} from '@mr/shared'
import type { MouseEvent, ReactElement } from 'react'

import { INTAKE_SILHOUETTES, INTAKE_SILHOUETTE_VIEWBOX } from './intake-silhouettes'

/**
 * Marker colours, from the prototype: a dent is amber with dark digits, rust is grey, a scratch
 * and a crack are red with white digits. The same colour carries into the defect list and the
 * print, so the number in the circle is recognisable in all three.
 */
export function intakeDamageMarkerColour(type: IntakeDamageType): { fill: string; text: string } {
  if (type === IntakeDamageType.Dent) {
    return { fill: 'var(--mri-warn)', text: '#141417' }
  }
  if (type === IntakeDamageType.Rust) {
    return { fill: 'var(--mri-archived)', text: '#fff' }
  }
  return { fill: 'var(--mri-red)', text: '#fff' }
}

export interface IntakeDamageMapProps {
  vehicleType: IntakeVehicleType
  damages: readonly IntakeDamage[]
  /** Tapping the drawing adds a marker; omit to render read-only (detail, print). */
  onPlace?: (point: { x: number; y: number }) => void
}

/**
 * The damage map. Coordinates are converted into the silhouette's own space
 * (`x = (clientX − rect.left) / rect.width * 340`) and stored that way, never as screen pixels —
 * that is what makes a marker sit in the same place on the tablet, on a desktop and on paper.
 */
export function IntakeDamageMap({
  vehicleType,
  damages,
  onPlace,
}: IntakeDamageMapProps): ReactElement {
  const handleClick = (event: MouseEvent<SVGSVGElement>): void => {
    if (onPlace === undefined) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      return
    }
    onPlace({
      x: ((event.clientX - rect.left) / rect.width) * INTAKE_DAMAGE_MAP_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * INTAKE_DAMAGE_MAP_HEIGHT,
    })
  }

  return (
    <svg
      onClick={handleClick}
      width="236"
      height="386"
      viewBox={INTAKE_SILHOUETTE_VIEWBOX}
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      className="max-h-full text-mri-sil"
      style={{ cursor: onPlace === undefined ? 'default' : 'crosshair', touchAction: 'none' }}
      role={onPlace === undefined ? 'img' : 'button'}
      aria-label={m.intake_map_aria()}
    >
      {INTAKE_SILHOUETTES[vehicleType].map((path, index) => (
        <path
          key={index}
          d={path.d}
          fill="currentColor"
          fillOpacity={path.op}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {/* Which end is which — without it a marker on a symmetrical silhouette is ambiguous. */}
      <g
        fill="currentColor"
        opacity=".55"
        fontFamily="JetBrains Mono, monospace"
        fontSize="9"
        letterSpacing="1.4"
      >
        <text x="6" y="20">
          {m.intake_map_rear()}
        </text>
        <text x="6" y="548">
          {m.intake_map_front()}
        </text>
      </g>

      {damages.map((damage, index) => {
        const colour = intakeDamageMarkerColour(damage.type)
        return (
          <g
            key={damage.id}
            fontFamily="JetBrains Mono, monospace"
            fontSize="15"
            fontWeight="700"
            textAnchor="middle"
          >
            <circle cx={damage.x} cy={damage.y} r="16" fill={colour.fill} />
            {/* The array index IS the number shown on the map, in the list and on the print. */}
            <text x={damage.x} y={damage.y + 6} fill={colour.text}>
              {index + 1}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
