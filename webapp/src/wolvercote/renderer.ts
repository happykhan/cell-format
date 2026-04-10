/**
 * Wolvercote SVG renderer.
 * Renders a CellSet to an SVG string matching the sample image style:
 *  - Chromosomes: large blue filled circles
 *  - MGEs (plasmids/other): smaller green circles
 *  - Nested MGEs: coloured rectangles placed on the border of their parent
 *  - Labels: text near each element
 *  - Multiple cells: laid out side by side
 */

import type { Cell, CellSet, ChromosomeNode, MGENode } from './types'

// Colour palette
const CHROMOSOME_FILL = '#dde8f8'
const CHROMOSOME_STROKE = '#3a6fba'
const CHROMOSOME_STROKE_WIDTH = 8

const MGE_FILL = '#e6f5e6'
const MGE_STROKE = '#3a9943'
const MGE_STROKE_WIDTH = 5

// Colours for nested elements placed on borders
const ELEMENT_COLOURS = [
  '#e05252', // red — transposon
  '#9b59b6', // purple — integron
  '#f39c12', // orange
  '#16a085', // teal
  '#2980b9', // blue
  '#e74c3c', // crimson
]

interface Layout {
  x: number
  y: number
  r: number // radius
}

function elementColor(label: string, index: number): string {
  // Try to pick a meaningful colour from the label
  const l = label.toLowerCase()
  if (l.includes('transposon') || l.includes('tn')) return '#e05252'
  if (l.includes('integron') || l.includes('int')) return '#9b59b6'
  if (l.includes('plasmid') || l.includes('pbad')) return MGE_STROKE
  if (l.includes('phage')) return '#f39c12'
  return ELEMENT_COLOURS[index % ELEMENT_COLOURS.length]
}

function renderNestedElements(
  elements: MGENode[],
  parentX: number,
  parentY: number,
  parentR: number,
  svgParts: string[],
): void {
  // Place nested elements evenly around the parent circle border
  const n = elements.length
  elements.forEach((el, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    const bx = parentX + parentR * Math.cos(angle)
    const by = parentY + parentR * Math.sin(angle)
    const color = elementColor(el.label, i)
    const w = 16
    const h = 10

    // Rotate the rectangle to be tangent to the circle
    const deg = (angle * 180) / Math.PI + 90
    svgParts.push(
      `<rect x="${bx - w / 2}" y="${by - h / 2}" width="${w}" height="${h}" fill="${color}" rx="2"` +
      ` transform="rotate(${deg.toFixed(1)},${bx.toFixed(1)},${by.toFixed(1)})" />`,
    )

    // Label
    const labelX = parentX + (parentR + 20) * Math.cos(angle)
    const labelY = parentY + (parentR + 20) * Math.sin(angle)
    if (el.label) {
      svgParts.push(
        `<text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle"` +
        ` font-size="12" fill="#444" font-family="Inter, sans-serif">${escapeXML(el.label)}</text>`,
      )
    }
  })
}

function renderChromosome(
  ch: ChromosomeNode,
  layout: Layout,
  svgParts: string[],
): void {
  const { x, y, r } = layout
  // Draw circle
  svgParts.push(
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${CHROMOSOME_FILL}"` +
    ` stroke="${CHROMOSOME_STROKE}" stroke-width="${CHROMOSOME_STROKE_WIDTH}" />`,
  )
  // Label inside at bottom
  if (ch.label) {
    svgParts.push(
      `<text x="${x}" y="${y + r * 0.55}" text-anchor="middle"` +
      ` font-size="14" fill="#333" font-family="Inter, sans-serif">${escapeXML(ch.label)}</text>`,
    )
  }
  // Nested MGEs on border
  renderNestedElements(ch.children, x, y, r, svgParts)
}

function renderMGECircle(
  mge: MGENode,
  layout: Layout,
  svgParts: string[],
): void {
  const { x, y, r } = layout
  svgParts.push(
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${MGE_FILL}"` +
    ` stroke="${MGE_STROKE}" stroke-width="${MGE_STROKE_WIDTH}" />`,
  )
  // Label above
  if (mge.label) {
    svgParts.push(
      `<text x="${x}" y="${y - r - 8}" text-anchor="middle"` +
      ` font-size="13" fill="#333" font-family="Inter, sans-serif">${escapeXML(mge.label)}</text>`,
    )
  }
  // Nested elements on border
  renderNestedElements(mge.children, x, y, r, svgParts)
}

function renderCell(cell: Cell, offsetX: number, svgParts: string[]): number {
  // Find chromosomes and top-level MGEs
  const chromosomes = cell.replicons.filter((r): r is ChromosomeNode => r.kind === 'chromosome')
  const mges = cell.replicons.filter((r): r is MGENode => r.kind === 'mge')

  const chrR = 90
  const mgeR = 42
  const padding = 20

  // Layout: chromosomes stacked vertically, MGEs arranged top-right
  let maxWidth = 0
  let maxHeight = 0
  let curY = chrR + padding + 30 // extra top padding for labels above

  const chrLayouts: Layout[] = chromosomes.map(() => {
    const layout = { x: offsetX + chrR + padding, y: curY, r: chrR }
    curY += chrR * 2 + padding
    maxWidth = Math.max(maxWidth, chrR * 2 + padding * 2)
    maxHeight = Math.max(maxHeight, curY)
    return layout
  })

  // MGEs: place to the right of the chromosomes
  const mgeStartX = offsetX + chrR * 2 + padding * 3 + mgeR
  let mgeY = mgeR + padding + 30
  const mgeLayouts: Layout[] = mges.map(() => {
    const layout = { x: mgeStartX, y: mgeY, r: mgeR }
    mgeY += mgeR * 2 + padding + 30 // extra space for labels
    maxWidth = Math.max(maxWidth, mgeStartX - offsetX + mgeR + padding * 2 + 40)
    maxHeight = Math.max(maxHeight, mgeY + mgeR)
    return layout
  })

  chromosomes.forEach((ch, idx) => renderChromosome(ch, chrLayouts[idx], svgParts))
  mges.forEach((mge, idx) => renderMGECircle(mge, mgeLayouts[idx], svgParts))

  return Math.max(maxWidth, offsetX + chrR * 2 + padding * 3)
}

function escapeXML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderSVG(cellSet: CellSet): string {
  const svgParts: string[] = []
  let x = 10
  let totalWidth = 10
  const height = 320

  // Draw cell separator lines between cells
  const cellWidths: number[] = []
  for (const cell of cellSet.cells) {
    const before = x
    const tempParts: string[] = []
    x = renderCell(cell, before, tempParts)
    cellWidths.push(x - before)
    svgParts.push(...tempParts)
    totalWidth = x + 10

    // Separator between cells
    if (cellSet.cells.indexOf(cell) < cellSet.cells.length - 1) {
      svgParts.push(
        `<line x1="${x}" y1="10" x2="${x}" y2="${height - 10}"` +
        ` stroke="#ccc" stroke-width="1.5" stroke-dasharray="6,4" />`,
      )
      x += 20
      totalWidth = x
    }
  }

  const svgContent = svgParts.join('\n  ')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}"` +
    ` viewBox="0 0 ${totalWidth} ${height}">\n  ${svgContent}\n</svg>`
  )
}
