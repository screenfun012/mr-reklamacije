import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

/** Eighths, as the paper form draws it: 0 = empty, 8 = full. */
const MAX_EIGHTHS = 8

/** Needle pivot and length from the handoff — the drawing is built around these. */
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

export interface IntakeFuelGaugeProps {
  eighths: number
  onChange: (eighths: number) => void
}

/**
 * The fuel level as a dashboard dial: a serviser copies the customer's needle, which is
 * faster and harder to get wrong than translating "just under half" into a fraction.
 *
 * Every path, tick and radius below is lifted from `prijem-prototip-v2` rather than
 * re-derived — an approximated dial reads as a different instrument.
 */
export function IntakeFuelGauge({ eighths, onChange }: IntakeFuelGaugeProps): ReactElement {
  const clamped = Math.min(MAX_EIGHTHS, Math.max(0, eighths))
  const tip = needleTip(clamped)
  const percent = Math.round((clamped / MAX_EIGHTHS) * 100)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width="244"
        height="146"
        viewBox="0 0 250 150"
        fill="none"
        role="img"
        aria-label={m.intake_fuel_aria({ eighths: clamped })}
        className="max-w-full"
      >
        <path
          d="M25 132 A100 100 0 0 1 225 132"
          stroke="var(--mri-border2)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M25 132 A100 100 0 0 1 79 47"
          stroke="var(--mri-red)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M79 47 A100 100 0 0 1 152 36"
          stroke="var(--mri-warn)"
          strokeWidth="14"
          strokeLinecap="round"
        />

        <g stroke="var(--mri-text2)" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="132" x2="4" y2="132" />
          <line x1="52" y1="62" x2="41" y2="53" />
          <line x1="125" y1="32" x2="125" y2="18" />
          <line x1="198" y1="62" x2="209" y2="53" />
          <line x1="232" y1="132" x2="246" y2="132" />
        </g>

        <g
          fill="var(--mri-text2)"
          fontFamily="JetBrains Mono, monospace"
          fontSize="12"
          fontWeight="600"
        >
          <text x="2" y="148">
            E
          </text>
          <text x="30" y="46">
            ¼
          </text>
          <text x="118" y="14">
            ½
          </text>
          <text x="204" y="46">
            ¾
          </text>
          <text x="236" y="148">
            F
          </text>
        </g>

        <line
          x1={CENTER_X}
          y1={CENTER_Y}
          x2={tip.x}
          y2={tip.y}
          stroke="var(--mri-text)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r="10"
          fill="var(--mri-raised)"
          stroke="var(--mri-text)"
          strokeWidth="3"
        />
      </svg>

      <div className="mt-0.5 font-mono text-[34px] font-extrabold leading-none tracking-[-0.02em] text-mri-text">
        {clamped}
        <span className="text-[20px] text-mri-text2">/{MAX_EIGHTHS}</span>
      </div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-mri-text2">
        {m.intake_fuel_percent({ percent })}
      </div>

      <div className="mt-3 flex w-full gap-[7px]">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, clamped - 1))}
          disabled={clamped === 0}
          aria-label={m.intake_fuel_less()}
          className="h-12 flex-1 cursor-pointer rounded-[9px] border border-mri-border2 bg-mri-inbg font-mono text-lg font-semibold text-mri-text transition-colors hover:bg-mri-rowhv disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(MAX_EIGHTHS, clamped + 1))}
          disabled={clamped === MAX_EIGHTHS}
          aria-label={m.intake_fuel_more()}
          className="h-12 flex-1 cursor-pointer rounded-[9px] border border-mri-border2 bg-mri-inbg font-mono text-lg font-semibold text-mri-text transition-colors hover:bg-mri-rowhv disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>

      <div className="mt-[9px] flex w-full gap-1.5">
        {SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut.label}
            type="button"
            onClick={() => onChange(shortcut.eighths)}
            aria-pressed={clamped === shortcut.eighths}
            className={cn(
              'h-11 flex-1 cursor-pointer rounded-lg border font-mono text-xs font-semibold transition-colors',
              clamped === shortcut.eighths
                ? 'border-mri-red bg-[rgba(237,28,36,0.13)] text-mri-text'
                : 'border-mri-border2 bg-mri-inbg text-mri-text2 hover:text-mri-text',
            )}
          >
            {shortcut.label}
          </button>
        ))}
      </div>
    </div>
  )
}
