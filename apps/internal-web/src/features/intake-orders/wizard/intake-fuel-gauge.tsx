import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

import { internalButtonClasses } from '~/components/internal-button'

/** Eighths, as the paper form draws it: 0 = empty, 8 = full. */
const MAX_EIGHTHS = 8

/** Geometry from the handoff — the needle must land where the drawing expects it. */
const CENTER_X = 125
const CENTER_Y = 132
const NEEDLE_LENGTH = 78

const SHORTCUTS = [
  { eighths: 0, label: 'E' },
  { eighths: 2, label: '¼' },
  { eighths: 4, label: '½' },
  { eighths: 6, label: '¾' },
  { eighths: 8, label: 'F' },
] as const

function needleTip(eighths: number): { x: number; y: number } {
  const angle = Math.PI - (eighths / MAX_EIGHTHS) * Math.PI
  return {
    x: CENTER_X + NEEDLE_LENGTH * Math.cos(angle),
    y: CENTER_Y - NEEDLE_LENGTH * Math.sin(angle),
  }
}

/** Point on the dial arc, used for the tick marks. */
function arcPoint(eighths: number, radius: number): { x: number; y: number } {
  const angle = Math.PI - (eighths / MAX_EIGHTHS) * Math.PI
  return {
    x: CENTER_X + radius * Math.cos(angle),
    y: CENTER_Y - radius * Math.sin(angle),
  }
}

function arcPath(fromEighths: number, toEighths: number, radius: number): string {
  const from = arcPoint(fromEighths, radius)
  const to = arcPoint(toEighths, radius)
  return `M ${from.x} ${from.y} A ${radius} ${radius} 0 0 1 ${to.x} ${to.y}`
}

export interface IntakeFuelGaugeProps {
  eighths: number
  onChange: (eighths: number) => void
}

/**
 * The fuel level as a dashboard dial rather than a number field: a serviser reads the
 * customer's gauge and copies the needle, which is faster and harder to get wrong than
 * translating "just under half" into a fraction.
 */
export function IntakeFuelGauge({ eighths, onChange }: IntakeFuelGaugeProps): ReactElement {
  const clamped = Math.min(MAX_EIGHTHS, Math.max(0, eighths))
  const tip = needleTip(clamped)
  const percent = Math.round((clamped / MAX_EIGHTHS) * 100)

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        viewBox="0 0 250 150"
        className="w-full max-w-[250px]"
        role="img"
        aria-label={m.intake_fuel_aria({ eighths: clamped })}
      >
        {/* Dial: the reserve end red, the middle amber, the rest neutral. */}
        <path d={arcPath(0, 8, 96)} fill="none" stroke="var(--mri-border2)" strokeWidth="10" />
        <path d={arcPath(0, 1, 96)} fill="none" stroke="var(--mri-red)" strokeWidth="10" />
        <path d={arcPath(3, 5, 96)} fill="none" stroke="var(--mri-warn)" strokeWidth="10" />

        {SHORTCUTS.map((shortcut) => {
          const inner = arcPoint(shortcut.eighths, 82)
          const outer = arcPoint(shortcut.eighths, 66)
          const text = arcPoint(shortcut.eighths, 54)
          return (
            <g key={shortcut.label}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="var(--mri-text2)"
                strokeWidth="1.5"
              />
              <text
                x={text.x}
                y={text.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-mri-text2 font-mono text-[9px]"
              >
                {shortcut.label}
              </text>
            </g>
          )
        })}

        <line
          x1={CENTER_X}
          y1={CENTER_Y}
          x2={tip.x}
          y2={tip.y}
          stroke="var(--mri-text)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={CENTER_X} cy={CENTER_Y} r="6" className="fill-mri-text" />
      </svg>

      <div className="flex flex-col items-center gap-0.5">
        <span className="font-mono text-[22px] font-bold leading-none text-mri-text">
          {clamped}/{MAX_EIGHTHS}
        </span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-mri-text2">
          {m.intake_fuel_percent({ percent })}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, clamped - 1))}
          disabled={clamped === 0}
          aria-label={m.intake_fuel_less()}
          className={internalButtonClasses('outline', 'size-12 w-12 text-lg')}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(MAX_EIGHTHS, clamped + 1))}
          disabled={clamped === MAX_EIGHTHS}
          aria-label={m.intake_fuel_more()}
          className={internalButtonClasses('outline', 'size-12 w-12 text-lg')}
        >
          +
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut.label}
            type="button"
            onClick={() => onChange(shortcut.eighths)}
            aria-pressed={clamped === shortcut.eighths}
            className={cn(
              'min-h-12 min-w-12 cursor-pointer rounded-[9px] border font-mono text-[13px] font-semibold transition-colors',
              clamped === shortcut.eighths
                ? 'border-mri-red bg-[rgba(237,28,36,0.1)] text-mri-redh'
                : 'border-mri-border2 text-mri-text2 hover:bg-mri-rowhv hover:text-mri-text',
            )}
          >
            {shortcut.label}
          </button>
        ))}
      </div>
    </div>
  )
}
