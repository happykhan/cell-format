/**
 * Wolvercote SVG renderer.
 * Produces circular diagrams matching the Wolvercote spec sample image style.
 */

import type { Cell, CellSet, ChromosomeNode, MGENode } from './types'

const CHR_FILL = '#dde8f8'
const CHR_STROKE = '#3a6fba'
const CHR_SW = 8

const MGE_FILL = '#e6f5e6'
const MGE_STROKE = '#3a9943'
const MGE_SW = 5

const ELEMENT_COLOURS = ['#e05252', '#9b59b6', '#f39c12', '#16a085', '#2980b9', '#e74c3c']

const CHR_R = 90
const MGE_R = 44
const PAD = 24
const FONT = 'Inter, Arial, sans-serif'

const ARC_BAND_CHR = 16   // radial thickness of the outermost arc band on chromosomes
const ARC_BAND_MGE = 10   // radial thickness of the outermost arc band on MGE circles
const ARC_TAPER = 0.85    // each deeper nesting level is this fraction narrower
const ARC_HALF = 0.28     // half-width of each depth-0 arc marker (radians ≈ 16°)

const TYPE_COLOURS: Record<string, string> = {
  transposon: '#e05252',
  integron: '#9b59b6',
  insertion_sequence: '#f39c12',
  phage: '#f39c12',
  gene: '#c0392b',
  plasmid: MGE_STROKE,
  other: '#888888',
}

function elementColour(label: string, index: number, customColour?: string, type?: string): string {
  if (customColour) return customColour
  if (type && TYPE_COLOURS[type]) return TYPE_COLOURS[type]
  const l = label.toLowerCase()
  if (l.includes('transposon') || l.startsWith('tn')) return '#e05252'
  if (l.includes('integron') || l.startsWith('int')) return '#9b59b6'
  if (l.includes('phage')) return '#f39c12'
  if (l.includes('insertion') || l.startsWith('is')) return '#f39c12'
  if (l.includes('plasmid') || l.startsWith('p')) return MGE_STROKE   // plasmids → green
  return ELEMENT_COLOURS[index % ELEMENT_COLOURS.length]
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

class SVGBuilder {
  private parts: string[] = []

  circle(cx: number, cy: number, r: number, fill: string, stroke: string, sw: number): void {
    this.parts.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`,
    )
  }

  rectRotated(
    cx: number, cy: number, w: number, h: number,
    fill: string, deg: number,
    stroke = '', sw = 0,
  ): void {
    const strokeAttr = stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''
    this.parts.push(
      `<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" ` +
      `width="${w}" height="${h}" fill="${fill}" rx="2"${strokeAttr} ` +
      `transform="rotate(${deg.toFixed(1)},${cx.toFixed(1)},${cy.toFixed(1)})"/>`,
    )
  }

  text(x: number, y: number, content: string, size = 13, anchor = 'middle', fill = '#333'): void {
    this.parts.push(
      `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" ` +
      `font-size="${size}" fill="${fill}" font-family="${FONT}">${esc(content)}</text>`,
    )
  }

  arc(cx: number, cy: number, outerR: number, innerR: number, a0: number, a1: number, fill: string, stroke = '', sw = 0): void {
    const cos0 = Math.cos(a0), sin0 = Math.sin(a0)
    const cos1 = Math.cos(a1), sin1 = Math.sin(a1)
    const large = (a1 - a0) > Math.PI ? 1 : 0
    const d = [
      `M ${(cx + outerR * cos0).toFixed(2)},${(cy + outerR * sin0).toFixed(2)}`,
      `A ${outerR.toFixed(2)},${outerR.toFixed(2)} 0 ${large},1 ${(cx + outerR * cos1).toFixed(2)},${(cy + outerR * sin1).toFixed(2)}`,
      `L ${(cx + innerR * cos1).toFixed(2)},${(cy + innerR * sin1).toFixed(2)}`,
      `A ${innerR.toFixed(2)},${innerR.toFixed(2)} 0 ${large},0 ${(cx + innerR * cos0).toFixed(2)},${(cy + innerR * sin0).toFixed(2)}`,
      'Z',
    ].join(' ')
    const strokeAttr = stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''
    this.parts.push(`<path d="${d}" fill="${fill}"${strokeAttr}/>`)
  }

  line(x1: number, y1: number, x2: number, y2: number, stroke = '#ccc', sw = 1.5, dash = ''): void {
    const da = dash ? ` stroke-dasharray="${dash}"` : ''
    this.parts.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" ` +
      `x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ` +
      `stroke="${stroke}" stroke-width="${sw}"${da}/>`,
    )
  }

  toSVG(width: number, height: number): string {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `width="${Math.round(width)}" height="${Math.round(height)}" ` +
      `viewBox="0 0 ${Math.round(width)} ${Math.round(height)}" ` +
      `style="background:white">\n  ` +
      this.parts.join('\n  ') +
      '\n</svg>'
    )
  }
}

/** Pick SVG text-anchor so labels spread away from their arc position naturally. */
function arcAnchor(angle: number): string {
  const c = Math.cos(angle)
  if (c > 0.3) return 'start'
  if (c < -0.3) return 'end'
  return 'middle'
}

/** Total outward extent of arc bands for a subtree at a given initial band width. */
function totalBandExtent(elements: MGENode[], bandW: number): number {
  if (!elements.length || bandW < 3) return 0
  const childExtent = Math.max(0, ...elements.map(el =>
    el.children.length ? totalBandExtent(el.children, bandW * ARC_TAPER) : 0
  ))
  return bandW + childExtent
}

/** Draw arc band and spoke+label to a shared label ring — no radial stacking. */
function placeArcLabel(
  el: MGENode,
  cx: number, cy: number,
  outerR: number,
  mid: number,
  labelRing: number,
  svg: SVGBuilder,
  fontSize: number,
): void {
  if (!el.label) return
  // Spoke from arc edge to label ring
  svg.line(
    cx + outerR * Math.cos(mid), cy + outerR * Math.sin(mid),
    cx + labelRing * Math.cos(mid), cy + labelRing * Math.sin(mid),
    '#bbb', 0.7,
  )
  const lx = cx + (labelRing + 5) * Math.cos(mid)
  const ly = cy + (labelRing + 5) * Math.sin(mid) + 4
  svg.text(lx, ly, el.label, fontSize, arcAnchor(mid), '#444')
}

/**
 * Render child elements within a parent arc range [a0..a1], radiating outward.
 * All labels placed at a shared labelRing (pre-computed by renderArcs).
 */
function renderNestedArcs(
  elements: MGENode[],
  cx: number, cy: number,
  innerR: number, bandW: number,
  a0: number, a1: number,
  svg: SVGBuilder,
  depth: number,
  labelRing: number,
): void {
  const n = elements.length
  if (!n || bandW < 3) return
  const outerR = innerR + bandW
  const span = a1 - a0
  const gap = 0.025
  const arcSpan = Math.max(0.01, (span - gap * n) / n)

  elements.forEach((el, i) => {
    const ea0 = a0 + i * (arcSpan + gap)
    const ea1 = ea0 + arcSpan
    const mid = (ea0 + ea1) / 2
    const colour = elementColour(el.label, i + depth * 7, el.attributes.colour, el.attributes.type)
    svg.arc(cx, cy, outerR, innerR, ea0, ea1, colour, 'white', 0.5)

    if (el.label && arcSpan > 0.18) {
      placeArcLabel(el, cx, cy, outerR, mid, labelRing, svg, 10)
    }

    if (el.children.length) {
      renderNestedArcs(el.children, cx, cy, outerR, bandW * ARC_TAPER, ea0, ea1, svg, depth + 1, labelRing)
    }
  })
}

/**
 * Render top-level elements as fixed-width arc markers on the circle edge.
 * Computes a shared label ring for all depths so no labels touch arcs or each other.
 */
function renderArcs(
  elements: MGENode[],
  cx: number, cy: number,
  baseR: number, bandW: number,
  svg: SVGBuilder,
  startAngle = -Math.PI / 2,
): void {
  const n = elements.length
  if (!n) return
  const innerR = baseR
  const outerR = baseR + bandW
  const halfSpan = Math.min(ARC_HALF, Math.PI / n - 0.04)

  // Compute label ring: outside the deepest possible arc band + clearance
  const maxChildExtent = Math.max(0, ...elements.map(el =>
    el.children.length ? totalBandExtent(el.children, bandW * ARC_TAPER) : 0
  ))
  const labelRing = outerR + maxChildExtent + 14

  elements.forEach((el, i) => {
    const center = startAngle + (2 * Math.PI * i) / n
    const a0 = center - halfSpan
    const a1 = center + halfSpan
    const colour = elementColour(el.label, i, el.attributes.colour, el.attributes.type)

    svg.arc(cx, cy, outerR, innerR, a0, a1, colour, 'white', 0.5)

    if (el.label) {
      placeArcLabel(el, cx, cy, outerR, center, labelRing, svg, 11)
    }

    if (el.children.length) {
      renderNestedArcs(el.children, cx, cy, outerR, bandW * ARC_TAPER, a0, a1, svg, 1, labelRing)
    }
  })
}

function measureCell(cell: Cell): [number, number] {
  const chrs = cell.replicons.filter((r): r is ChromosomeNode => r.kind === 'chromosome')
  const mges = cell.replicons.filter((r): r is MGENode => r.kind === 'mge')

  // Compute max label ring extent across all chromosomes and MGEs
  const chrLabelExt = chrs.reduce((mx, ch) => {
    const ext = ch.children.length
      ? ARC_BAND_CHR + totalBandExtent(ch.children, ARC_BAND_CHR * ARC_TAPER) + 14 + 50
      : 0
    return Math.max(mx, ext)
  }, 60)
  const mgeLabelExt = mges.reduce((mx, mge) => {
    const ext = mge.children.length
      ? ARC_BAND_MGE + totalBandExtent(mge.children, ARC_BAND_MGE * ARC_TAPER) + 14 + 50
      : 0
    return Math.max(mx, ext)
  }, 50)

  const chrColW = CHR_R * 2 + PAD * 2 + chrLabelExt
  const mgeColW = mges.length ? MGE_R * 2 + PAD * 2 + mgeLabelExt : 0
  const width = chrColW + mgeColW + PAD

  const chrColH = Math.max(chrs.length, 1) * (CHR_R * 2 + PAD + 160) + PAD + 30
  const mgeColH = mges.length ? mges.length * (MGE_R * 2 + PAD + 30) + PAD + 30 : 0
  const height = Math.max(chrColH, mgeColH, CHR_R * 2 + PAD * 2 + 60)

  return [width, height]
}

function renderCell(cell: Cell, ox: number, oy: number, height: number, svg: SVGBuilder): number {
  const chrs = cell.replicons.filter((r): r is ChromosomeNode => r.kind === 'chromosome')
  const mges = cell.replicons.filter((r): r is MGENode => r.kind === 'mge')
  const chrColW = CHR_R * 2 + PAD * 2

  // Chromosomes — vertically centred
  if (chrs.length) {
    const totalH = chrs.length * CHR_R * 2 + (chrs.length - 1) * (PAD + 160)
    const startY = oy + (height - totalH) / 2
    chrs.forEach((ch, i) => {
      const cx = ox + chrColW / 2        // centred so arcs have equal space on both sides
      const cy = startY + i * (CHR_R * 2 + PAD + 160) + CHR_R
      svg.circle(cx, cy, CHR_R, CHR_FILL, CHR_STROKE, CHR_SW)
      renderArcs(ch.children, cx, cy, CHR_R, ARC_BAND_CHR, svg)
      if (ch.label) svg.text(cx, cy + 5 + (ch.children.length ? 0 : CHR_R * 0.4), ch.label, 15)
    })
  }

  // MGEs — right column
  const mgeColX = ox + chrColW + PAD
  if (mges.length) {
    const totalMH = mges.length * MGE_R * 2 + (mges.length - 1) * PAD
    const labelSpace = mges.length * 30
    const startMY = oy + (height - totalMH - labelSpace) / 2 + 30
    mges.forEach((mge, i) => {
      const mx = mgeColX + MGE_R + PAD
      const my = startMY + i * (MGE_R * 2 + PAD + 30) + MGE_R
      svg.circle(mx, my, MGE_R, MGE_FILL, MGE_STROKE, MGE_SW)
      renderArcs(mge.children, mx, my, MGE_R, ARC_BAND_MGE, svg)
      // Label in the centre of the MGE circle (like chromosome labels), not above
      if (mge.label) svg.text(mx, my + 5, mge.label, 13)
    })
    return mgeColX + MGE_R * 2 + PAD * 2 + 50
  }

  return ox + chrColW + PAD
}

export function renderSVG(cellSet: CellSet): string {
  const cells = cellSet.cells
  if (!cells.length) return '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"/>'

  const dims = cells.map(measureCell)
  const totalW = dims.reduce((s, [w]) => s + w, 0) + (cells.length - 1) * PAD + PAD * 2
  const height = Math.max(...dims.map(([, h]) => h)) + PAD * 2

  const svg = new SVGBuilder()
  let x = PAD
  cells.forEach((cell, i) => {
    const [w] = dims[i]
    renderCell(cell, x, PAD, height - PAD * 2, svg)
    x += w
    if (i < cells.length - 1) {
      svg.line(x + PAD / 2, PAD, x + PAD / 2, height - PAD, '#ccc', 1.5, '6,4')
      x += PAD
    }
  })

  return svg.toSVG(totalW, height)
}
