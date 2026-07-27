import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

/** Eighths, as the paper form draws it: 0 = empty, 8 = full. */
const MAX_EIGHTHS = 8

/** Needle pivot and length from the handoff — the drawing is built around these. */
const CENTER_X = 125
const CENTER_Y = 132
const NEEDLE_LENGTH = 78

/**
 * One rhythm for the whole dial: the needle sweeps and the buttons take their colour over the same
 * 280 ms, so pressing ¾ reads as one instrument moving rather than a needle and a button reacting
 * to the same click separately.
 */
const SWEEP = 'duration-[280ms] ease-out motion-reduce:transition-none'

const SHORTCUTS = [
  { eighths: 0, label: 'E' },
  { eighths: 2, label: '¼' },
  { eighths: 4, label: '½' },
  { eighths: 6, label: '¾' },
  { eighths: 8, label: 'F' },
] as const

/**
 * The needle is drawn once at the E end and ROTATED, rather than having its tip moved, because a
 * moved tip cannot be animated. The two are the same geometry: rotating the E-end point
 * (125−78, 132) clockwise by `fuel/8 · 180°` lands exactly where the handoff's
 * `(125 + 78·cos θ, 132 − 78·sin θ)` puts it, for every eighth. Pinned by a test.
 */
export function needleRotationDegrees(eighths: number): number {
  return (eighths / MAX_EIGHTHS) * 180
}

export function needleTip(eighths: number): { x: number; y: number } {
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

        {/*
          Approved deviation from the prototype (Nikola, 2026-07-27): the prototype's needle jumps.
          A dial that sweeps reads as an instrument; one that snaps reads as a number field. Colour
          stays white as drawn — the coloured arc already says where the reserve is, and a coloured
          needle would repeat it.

          The rotation is the CSS property and NOT the `transform` attribute, because WebKit — which
          is the engine on the intake iPad — refuses to transition that attribute; measured, its
          computed transform stays `none` throughout. The attribute form animates in Chromium, so on
          a desktop it would have looked finished while the tablet kept snapping. Both forms render
          the needle in exactly the same place, verified in both engines at 0/45/90/135/180°.
        */}
        <line
          x1={CENTER_X}
          y1={CENTER_Y}
          x2={CENTER_X - NEEDLE_LENGTH}
          y2={CENTER_Y}
          style={{
            transform: `rotate(${needleRotationDegrees(clamped)}deg)`,
            transformBox: 'view-box',
            transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
          }}
          stroke="var(--mri-text)"
          strokeWidth="4"
          strokeLinecap="round"
          className={cn('transition-transform', SWEEP)}
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
          className={cn(
            'h-12 flex-1 cursor-pointer rounded-[9px] border border-mri-border2 bg-mri-inbg font-mono text-lg font-semibold text-mri-text transition-colors hover:bg-mri-rowhv disabled:cursor-not-allowed disabled:opacity-40',
            SWEEP,
          )}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(MAX_EIGHTHS, clamped + 1))}
          disabled={clamped === MAX_EIGHTHS}
          aria-label={m.intake_fuel_more()}
          className={cn(
            'h-12 flex-1 cursor-pointer rounded-[9px] border border-mri-border2 bg-mri-inbg font-mono text-lg font-semibold text-mri-text transition-colors hover:bg-mri-rowhv disabled:cursor-not-allowed disabled:opacity-40',
            SWEEP,
          )}
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
              SWEEP,
              clamped === shortcut.eighths
                ? 'border-mri-red bg-[rgba(237,28,36,0.13)] text-mri-redh'
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
