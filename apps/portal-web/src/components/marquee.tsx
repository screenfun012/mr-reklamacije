import { m } from '@mr/i18n'
import { Fragment } from 'react'

/**
 * Endless services strip on the hero bottom edge. Content is repeated 4× and
 * the track slides -50% for a seamless 36s loop (design spec).
 */
export function ServicesMarquee() {
  const items = [
    m.portal_marquee_1(),
    m.portal_marquee_2(),
    m.portal_marquee_3(),
    m.portal_marquee_4(),
    m.portal_marquee_5(),
  ]
  const loops = [0, 1, 2, 3]

  return (
    <div className="relative z-[2] overflow-hidden border-t border-white/[0.12] bg-[rgba(8,8,10,0.55)] py-[11px] backdrop-blur-[8px]">
      <div aria-hidden className="mrp-marquee-track flex w-max">
        {loops.map((loop) => (
          <Fragment key={loop}>
            {items.map((item) => (
              <span
                key={`${loop}-${item}`}
                className="inline-flex items-center gap-[26px] whitespace-nowrap pr-[26px] font-mono text-[10.5px] font-medium tracking-[0.18em] text-white/45"
              >
                {item}
                <span className="size-[5px] flex-none rotate-45 bg-mrp-red" />
              </span>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
