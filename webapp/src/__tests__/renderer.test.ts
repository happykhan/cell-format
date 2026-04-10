/**
 * Unit tests for the SVG renderer.
 */
import { describe, it, expect } from 'vitest'
import { parseWolvercote } from '../wolvercote/parser'
import { renderSVG } from '../wolvercote/renderer'

function parse(input: string) {
  const result = parseWolvercote(input)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

function svg(input: string) {
  return renderSVG(parse(input))
}

describe('renderSVG', () => {
  it('returns valid SVG markup', () => {
    const out = svg('()chr1')
    expect(out).toMatch(/^<svg /)
    expect(out).toMatch(/<\/svg>$/)
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('renders a chromosome circle', () => {
    const out = svg('()chr1')
    expect(out).toContain('#dde8f8')  // CHR_FILL
    expect(out).toContain('#3a6fba')  // CHR_STROKE
    expect(out).toContain('<circle')
  })

  it('renders the chromosome label', () => {
    const out = svg('()myChromosome')
    expect(out).toContain('myChromosome')
  })

  it('renders a plasmid circle', () => {
    const out = svg('{}pBAD')
    expect(out).toContain('#e6f5e6')  // MGE_FILL
    expect(out).toContain('#3a9943')  // MGE_STROKE
  })

  it('renders nested MGE elements as arc sectors', () => {
    const out = svg('({}Tn3)chr1')
    expect(out).toContain('<path')   // arc elements use SVG path
    expect(out).toContain('Tn3')
  })

  it('shows containment for deeply nested elements', () => {
    const out = svg('{ { {}blaKPC-2 }Tn4401 }pKpQIL')
    // Arc borders use white stroke to visually separate sectors
    expect(out).toContain('stroke="white"')
    // Outermost child label present; deeply nested label omitted (too small)
    expect(out).toContain('Tn4401')
    expect(out).toContain('pKpQIL')
  })

  it('renders multiple cells with a separator line', () => {
    const out = svg('()chrA ; ()chrB')
    expect(out).toContain('stroke-dasharray')  // dashed separator
  })

  it('width increases with more replicons', () => {
    const single = svg('()chr1')
    const withPlasmid = svg('()chr1,{}pBAD')
    const wSingle = parseInt(single.match(/width="(\d+)"/)?.[1] ?? '0')
    const wDouble = parseInt(withPlasmid.match(/width="(\d+)"/)?.[1] ?? '0')
    expect(wDouble).toBeGreaterThan(wSingle)
  })

  it('returns empty SVG for empty cell set', () => {
    // The renderer handles empty input gracefully
    const out = renderSVG({ cells: [] })
    expect(out).toContain('<svg')
  })

  it('escapes ampersands in labels', () => {
    // Build a CellSet manually with a label containing & to test SVG escaping
    const cs = {
      cells: [{
        replicons: [{
          kind: 'chromosome' as const,
          label: 'E&Coli',
          children: [],
          attributes: {},
        }],
      }],
    }
    const out = renderSVG(cs)
    expect(out).not.toContain('E&Coli')  // raw & must be escaped
    expect(out).toContain('&amp;')
  })
})
