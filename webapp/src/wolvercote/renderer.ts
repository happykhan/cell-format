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

function elementColour(label: string, index: number): string {
  const l = label.toLowerCase()
  if (l.includes('transposon') || l.startsWith('tn')) return '#e05252'
  if (l.includes('integron') || l.startsWith('int')) return '#9b59b6'
  if (l.includes('phage')) return '#f39c12'
  if (l.includes('insertion') || l.startsWith('is')) return '#f39c12'
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

  rectRotated(cx: number, cy: number, w: number, h: number, fill: string, deg: number): void {
    this.parts.push(
      `<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" ` +
      `width="${w}" height="${h}" fill="${fill}" rx="2" ` +
      `transform="rotate(${deg.toFixed(1)},${cx.toFixed(1)},${cy.toFixed(1)})"/>`,
    )
  }

  text(x: number, y: number, content: string, size = 13, anchor = 'middle', fill = '#333'): void {
    this.parts.push(
      `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" ` +
      `font-size="${size}" fill="${fill}" font-family="${FONT}">${esc(content)}</text>`,
    )
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

function renderNested(
  elements: MGENode[],
  px: number,
  py: number,
  pr: number,
  svg: SVGBuilder,
): void {
  const n = elements.length
  elements.forEach((el, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    const bx = px + pr * Math.cos(angle)
    const by = py + pr * Math.sin(angle)
    const colour = elementColour(el.label, i)
    const deg = (angle * 180) / Math.PI + 90
    svg.rectRotated(bx, by, 18, 11, colour, deg)
    const lx = px + (pr + 26) * Math.cos(angle)
    const ly = py + (pr + 26) * Math.sin(angle)
    if (el.label) svg.text(lx, ly + 4, el.label, 12, 'middle', '#444')
  })
}

function measureCell(cell: Cell): [number, number] {
  const chrs = cell.replicons.filter((r): r is ChromosomeNode => r.kind === 'chromosome')
  const mges = cell.replicons.filter((r): r is MGENode => r.kind === 'mge')

  const chrColW = CHR_R * 2 + PAD * 2
  const mgeColW = mges.length ? MGE_R * 2 + PAD * 2 + 50 : 0
  const width = chrColW + mgeColW + PAD

  const chrColH = Math.max(chrs.length, 1) * (CHR_R * 2 + PAD) + PAD + 30
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
    const totalH = chrs.length * CHR_R * 2 + (chrs.length - 1) * PAD
    const startY = oy + (height - totalH) / 2
    chrs.forEach((ch, i) => {
      const cx = ox + CHR_R + PAD
      const cy = startY + i * (CHR_R * 2 + PAD) + CHR_R
      svg.circle(cx, cy, CHR_R, CHR_FILL, CHR_STROKE, CHR_SW)
      if (ch.label) svg.text(cx, cy + 5 + (ch.children.length ? 0 : CHR_R * 0.4), ch.label, 15)
      renderNested(ch.children, cx, cy, CHR_R, svg)
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
      if (mge.label) svg.text(mx, my - MGE_R - 10, mge.label, 13)
      renderNested(mge.children, mx, my, MGE_R, svg)
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
