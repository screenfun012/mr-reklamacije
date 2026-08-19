import { describe, expect, it } from 'vitest'

import {
  dataTableCardClassName,
  dataTableDestructiveActionClassName,
  dataTableIconActionClassName,
  dataTableRowHoverOnlyClassName,
  dataTableRowInteractiveClassName,
  dataTableRowNavigableClassName,
  dataTableTextActionClassName,
  listItemInteractiveClassName,
  panelClassName,
  panelHeaderClassName,
} from '../field-control-styles.js'

describe('listItemInteractiveClassName', () => {
  it('uses preset CSS class for list item hover states', () => {
    expect(listItemInteractiveClassName).toBe('mr-list-item-interactive')
  })
})

describe('dataTableRowInteractiveClassName', () => {
  it('includes muted row hover for data tables', () => {
    expect(dataTableRowInteractiveClassName).toContain('hover:bg-muted/40')
    expect(dataTableRowInteractiveClassName).toContain('transition-colors')
  })
})

describe('dataTableRowNavigableClassName', () => {
  it('combines border, hover, and pointer cursor for internal list rows', () => {
    expect(dataTableRowNavigableClassName).toContain('cursor-pointer')
    expect(dataTableRowNavigableClassName).toContain(dataTableRowInteractiveClassName)
  })
})

describe('dataTableRowHoverOnlyClassName', () => {
  it('combines border and hover without navigation cursor', () => {
    expect(dataTableRowHoverOnlyClassName).toContain(dataTableRowInteractiveClassName)
    expect(dataTableRowHoverOnlyClassName).not.toContain('cursor-pointer')
  })
})

describe('dataTable action classes', () => {
  it('keeps icon and text actions visually subordinate to row hover', () => {
    expect(dataTableIconActionClassName).toContain('text-muted-foreground')
    expect(dataTableIconActionClassName).toContain('hover:bg-muted/60')
    expect(dataTableTextActionClassName).toContain('hover:bg-muted/60')
    expect(dataTableDestructiveActionClassName).toContain('hover:bg-destructive/10')
  })
})

describe('panel classes', () => {
  // The panel is the one shape every admin screen was missing: internal-web wraps its filters, its
  // list and every dashboard block in it, while admin wrapped only tables — which is most of why
  // its screens read as loose rows on a page rather than as a screen.
  it('shares its radius and border with the data-table card', () => {
    // Not cosmetic: a filter panel sits directly above the list card, and two different radii on
    // one screen edge is the kind of thing you see without being able to name.
    expect(panelClassName).toContain('rounded-[14px]')
    expect(dataTableCardClassName).toContain('rounded-[14px]')
    expect(panelClassName).toContain('border-border')
  })

  it('paints the panel on the card surface, not the page', () => {
    expect(panelClassName).toContain('bg-card')
  })

  it('separates the header from the body with a rule', () => {
    expect(panelHeaderClassName).toContain('border-b')
  })
})
