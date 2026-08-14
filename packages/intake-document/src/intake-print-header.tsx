import type { CSSProperties, ReactElement } from 'react'

import { DOCUMENT_FONT_MONO } from './intake-print-styles.js'

const HEADER_STYLE = {
  /** The black band, edge to edge, as "Obaveze kupca" carries it. */
  band: {
    display: 'flex',
    flex: 'none',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: '#17171a',
    paddingLeft: '54px',
    paddingRight: '54px',
    paddingTop: '18px',
    paddingBottom: '18px',
    color: '#fff',
  },
  /**
   * `display: block` is stated because an image is inline by default, and the browsers this renders
   * in only agree that it is a block because a CSS reset told them so. This document carries its
   * own.
   */
  emblem: { display: 'block', height: '46px', width: 'auto' },
  titleBlock: { marginLeft: '8px' },
  title: {
    fontSize: '22px',
    fontWeight: 900,
    textTransform: 'uppercase',
    lineHeight: 1,
    letterSpacing: '-0.02em',
  },
  subtitle: { marginTop: '4px', fontSize: '10.5px', color: '#b9babd' },
  numberBlock: { marginLeft: 'auto', textAlign: 'right' },
  number: { fontFamily: DOCUMENT_FONT_MONO, fontSize: '20px', fontWeight: 700 },
  timestamp: {
    fontFamily: DOCUMENT_FONT_MONO,
    fontSize: '9.5px',
    letterSpacing: '0.08em',
    color: '#b9babd',
  },
} satisfies Record<string, CSSProperties>

/**
 * The band both papers open with. Shared so the two documents a vehicle collects here are recognisably
 * one shop's paper — the emblem, the order number and the moment are in the same place on each.
 *
 * `logoSrc` is a prop and never a default, for the same reason it is one on the sheets: a browser
 * wants a URL its own server answers, and the API has no server to ask and hands over the bytes as a
 * `data:` URI. A default would be one of the two and print a broken image for the other.
 */
export function IntakePrintHeader({
  logoSrc,
  title,
  subtitle,
  number,
  timestamp,
}: {
  logoSrc: string
  title: string
  /** Null on a paper whose title says everything — the handover record has no second line. */
  subtitle: string | null
  number: string
  /** Null while the moment has not happened yet: an unsigned handover has no date to print. */
  timestamp: string | null
}): ReactElement {
  return (
    <header style={HEADER_STYLE.band}>
      {/* The full emblem — red MR, white script, white "MADE IN SERBIA" ring — because that is
          what the black band on "Obaveze kupca" carries. The plain wordmark is the app's own
          chrome and reads as a different mark beside it. */}
      <img src={logoSrc} alt="MR Engines" style={HEADER_STYLE.emblem} />
      <div style={HEADER_STYLE.titleBlock}>
        <div style={HEADER_STYLE.title}>{title}</div>
        {subtitle === null ? null : <div style={HEADER_STYLE.subtitle}>{subtitle}</div>}
      </div>
      <div style={HEADER_STYLE.numberBlock}>
        <div style={HEADER_STYLE.number}>{number}</div>
        {timestamp === null ? null : <div style={HEADER_STYLE.timestamp}>{timestamp}</div>}
      </div>
    </header>
  )
}
