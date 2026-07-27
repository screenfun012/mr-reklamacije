import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { useEffect, useRef, useState, type ReactElement } from 'react'

/** Eighths, as the paper form draws it: 0 = empty, 8 = full. */
const MAX_EIGHTHS = 8

/** Needle pivot and length from the handoff — the drawing is built around these. */
const CENTER_X = 125
const CENTER_Y = 132
const NEEDLE_LENGTH = 78

/**
 * `getTotalLength()` of the arc below, measured in Chromium AND WebKit (they agree to three
 * decimals). The exact semicircle is 100π = 314.159, but a browser flattens the arc slightly
 * longer; using the ideal number would leave a sub-pixel gap unfilled at the F end.
 */
const ARC_LENGTH = 314.204

/**
 * The needle settles in about 400 ms and the fill arrives just after it, so the dial reads as one
 * instrument catching up rather than two parts moving. These replace the spec's per-frame
 * exponential (0.19 / 0.15 per frame): a CSS transition retargets from wherever it currently is,
 * which is exactly the "five fast taps must not restart the motion" requirement, and it costs no
 * animation frame loop and no re-render.
 */
const NEEDLE_MOTION = 'duration-[400ms] ease-out motion-reduce:transition-none'
const FILL_MOTION = 'duration-[520ms] ease-out motion-reduce:transition-none'
const COLOUR_MOTION = 'duration-[320ms] ease-out motion-reduce:transition-none'

/** The one rhythm the buttons keep, unchanged. */
const SWEEP = 'duration-[280ms] ease-out motion-reduce:transition-none'

const SHORTCUTS = [
  { eighths: 0, label: 'E' },
  { eighths: 2, label: '¼' },
  { eighths: 4, label: '½' },
  { eighths: 6, label: '¾' },
  { eighths: 8, label: 'F' },
] as const

export type FuelZone = 'reserve' | 'low' | 'ok'

/**
 * The level band, from the approved design: reserve through 1/8, low through 3/8, fine above.
 * A needle sitting on a boundary counts as the lower band — a fuel warning may be early, never
 * late.
 */
export function fuelZone(eighths: number): FuelZone {
  if (eighths <= 1) {
    return 'reserve'
  }
  if (eighths <= 3) {
    return 'low'
  }
  return 'ok'
}

/**
 * The filled arc and the big digit carry the same token, so the dial has one colour at a time.
 * The reserve band is no longer painted onto the empty track: at E that left a red cap sitting
 * under the needle that read as a fault rather than as a scale.
 */
const ZONE_ARC_CLASS: Record<FuelZone, string> = {
  reserve: 'stroke-mri-red',
  low: 'stroke-mri-amb',
  ok: 'stroke-mri-grn',
}

const ZONE_TEXT_CLASS: Record<FuelZone, string> = {
  reserve: 'text-mri-red',
  low: 'text-mri-amb',
  ok: 'text-mri-grn',
}

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

/** How much of the arc is still empty. 0 = full tank, ARC_LENGTH = empty. */
export function fillDashOffset(eighths: number): number {
  return ARC_LENGTH * (1 - eighths / MAX_EIGHTHS)
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
 * re-derived — an approximated dial reads as a different instrument. The motion is not: the
 * prototype's dial snaps, and sweeping it is an approved deviation (Nikola, 2026-07-27).
 */
export function IntakeFuelGauge({ eighths, onChange }: IntakeFuelGaugeProps): ReactElement {
  const clamped = Math.min(MAX_EIGHTHS, Math.max(0, eighths))
  const percent = Math.round((clamped / MAX_EIGHTHS) * 100)
  const zone = fuelZone(clamped)

  /**
   * The dial always opens at E and travels to the stored level — on a fresh step and on a resumed
   * draft alike — so the serviser sees the number being confirmed rather than just printed.
   * Starting at 0 on both server and client keeps hydration identical; under reduced motion the
   * transitions are off, so this settles within a frame instead of animating.
   */
  const [shown, setShown] = useState(0)
  useEffect(() => {
    setShown(clamped)
  }, [clamped])

  const numberRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    // The digit swaps instantly; the nudge is what makes the swap noticeable on a tablet held at
    // arm's length. Optional call because jsdom has no Web Animations API.
    numberRef.current?.animate?.(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
      { duration: 180, easing: 'cubic-bezier(0.34, 1.26, 0.64, 1)' },
    )
  }, [clamped])

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

        {/*
          The fill. `stroke-dashoffset` is the one arc property both engines transition — measured
          2026-07-27 in Chromium and WebKit, which is the engine on the intake iPad. At E the whole
          path is hidden rather than merely emptied: a zero-length round cap still paints a dot,
          and a red dot sitting on E looks like a fault light.
        */}
        <path
          d="M25 132 A100 100 0 0 1 225 132"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={ARC_LENGTH}
          style={{ strokeDashoffset: fillDashOffset(shown), opacity: shown === 0 ? 0 : 1 }}
          className={cn(
            'transition-[stroke-dashoffset,stroke,opacity]',
            FILL_MOTION,
            ZONE_ARC_CLASS[zone],
          )}
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
          The rotation is the CSS property and NOT the `transform` attribute, because WebKit
          refuses to transition that attribute; measured, its computed transform stays `none`
          throughout. The attribute form animates in Chromium, so on a desktop it would have looked
          finished while the tablet kept snapping. Both forms render the needle in exactly the same
          place, verified in both engines at 0/45/90/135/180°. The needle stays neutral: coloured,
          it loses contrast on the light theme.
        */}
        <line
          x1={CENTER_X}
          y1={CENTER_Y}
          x2={CENTER_X - NEEDLE_LENGTH}
          y2={CENTER_Y}
          style={{
            transform: `rotate(${needleRotationDegrees(shown)}deg)`,
            transformBox: 'view-box',
            transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
          }}
          stroke="var(--mri-text)"
          strokeWidth="4"
          strokeLinecap="round"
          className={cn('transition-transform', NEEDLE_MOTION)}
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

      <div
        ref={numberRef}
        className={cn(
          'mt-0.5 font-mono text-[34px] font-extrabold leading-none tracking-[-0.02em] transition-colors',
          COLOUR_MOTION,
          ZONE_TEXT_CLASS[zone],
        )}
      >
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
