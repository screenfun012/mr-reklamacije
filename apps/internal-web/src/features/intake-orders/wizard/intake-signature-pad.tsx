import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { useRef, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'

/** The space the pad captures in and the sheet prints from — one definition, in the package. */
export { SIGNATURE_PAD_HEIGHT, SIGNATURE_PAD_WIDTH, SIGNATURE_VIEW_BOX } from '@mr/intake-document'
import { SIGNATURE_PAD_HEIGHT, SIGNATURE_PAD_WIDTH, SIGNATURE_VIEW_BOX } from '@mr/intake-document'

/** Strokes of `[x, y]` points, already normalized into the 460×200 space. */
export type SignatureStrokes = readonly (readonly [number, number][])[]

/**
 * A single tap is not a signature. Two points is a flick — the customer brushing the tablet while
 * handing it back. Three is the shortest thing a person actually draws.
 */
export function isSignatureFilled(strokes: SignatureStrokes): boolean {
  return strokes.some((stroke) => stroke.length > 2)
}

export function signatureStrokesToPath(strokes: SignatureStrokes): string {
  return strokes
    .filter((stroke) => stroke.length > 0)
    .map((stroke) => `M${stroke.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}`)
    .join(' ')
}

export interface IntakeSignaturePadProps {
  title: string
  /** Whose signature this is — the serviser's own name, or the owner's. */
  name: string
  strokes: SignatureStrokes
  /**
   * An UPDATER, not a value. Pointer moves arrive faster than React re-renders — the browser
   * coalesces them and several land in one task — so a handler that read `strokes` from its
   * closure would append to the same stale array each time and keep only the last point. A fast
   * flick then produced a two-point stroke, which `isSignatureFilled` correctly refuses, and the
   * customer's signature silently did not count.
   */
  onChange: (update: (previous: SignatureStrokes) => SignatureStrokes) => void
}

export function IntakeSignaturePad({
  title,
  name,
  strokes,
  onChange,
}: IntakeSignaturePadProps): ReactElement {
  const drawing = useRef(false)
  const signed = isSignatureFilled(strokes)

  const pointIn = (event: ReactPointerEvent<HTMLDivElement>): [number, number] | null => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      return null
    }
    return [
      ((event.clientX - rect.left) / rect.width) * SIGNATURE_PAD_WIDTH,
      ((event.clientY - rect.top) / rect.height) * SIGNATURE_PAD_HEIGHT,
    ]
  }

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-[13px] rounded-[15px] border bg-mri-surface px-5 py-[18px]',
        // An unsigned pad is outlined in red and lit: on step 5 it is the only thing left to do.
        signed ? 'border-mri-border' : 'border-mri-red shadow-[0_0_0_3px_rgba(237,28,36,0.14)]',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
          {title}
        </span>
        <span className="ml-auto text-[13.5px] font-bold">{name}</span>
      </div>

      <div
        onPointerDown={(event) => {
          const point = pointIn(event)
          if (point === null) {
            return
          }
          drawing.current = true
          onChange((previous) => [...previous, [point]])
        }}
        onPointerMove={(event) => {
          if (!drawing.current) {
            return
          }
          const point = pointIn(event)
          if (point === null) {
            return
          }
          onChange((previous) => {
            const last = previous[previous.length - 1]
            if (last === undefined) {
              return previous
            }
            return [...previous.slice(0, -1), [...last, point]]
          })
        }}
        // Leaving the pad ends the stroke, as the prototype does — simpler than pointer capture and
        // it matches what a finger sliding off the edge should mean.
        onPointerUp={() => {
          drawing.current = false
        }}
        onPointerLeave={() => {
          drawing.current = false
        }}
        style={{ touchAction: 'none' }}
        className={cn(
          // The pad carries its OWN shape, and deliberately not `flex-1`. It used to take whatever
          // height was left over, and there was none: the step root's `h-full` resolves against a
          // parent with no definite height, so the whole chain collapsed and the drawing surface
          // measured 2px — the height of its own border. Points still landed (the `rect.height === 0`
          // guard reads 2, not 0), so nothing errored; there was simply nowhere to sign.
          //
          // The aspect is the pad's own 460×200 space, so what is drawn matches what is printed:
          // the sheet renders the path in that ratio, and a signature drawn in a squashed box would
          // come out stretched on paper.
          'relative aspect-[460/200] w-full flex-none cursor-crosshair rounded-[6px] bg-mri-inbg',
          signed
            ? 'border border-solid border-[rgba(31,169,113,0.45)]'
            : 'border border-dashed border-mri-border2',
        )}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={SIGNATURE_VIEW_BOX}
          preserveAspectRatio="none"
          className="absolute inset-0"
          aria-hidden="true"
        >
          <path
            d={signatureStrokesToPath(strokes)}
            stroke="var(--mri-sigink)"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {signed ? (
          <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center font-mono text-[10px] tracking-[0.14em] text-mri-grn">
            {m.intake_signature_done()}
          </span>
        ) : (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-[15px] text-mri-text2">
            {m.intake_signature_placeholder()}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onChange(() => [])}
        className="h-12 flex-none cursor-pointer rounded-[10px] border border-mri-border2 bg-mri-inbg text-[13px] font-bold uppercase tracking-[0.06em] text-mri-text2"
      >
        {m.intake_signature_clear()}
      </button>
    </div>
  )
}
