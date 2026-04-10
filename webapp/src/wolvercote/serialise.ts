/**
 * Serialise a CellSet back to a Wolvercote format string.
 */

import type { Cell, CellSet, MGENode, Replicon } from './types'

export function to_wolvercote(cellSet: CellSet): string {
  return cellSet.cells.map(cellStr).join(' ; ')
}

function cellStr(cell: Cell): string {
  return cell.replicons.map(repliconStr).join(', ')
}

function repliconStr(r: Replicon): string {
  if (r.kind === 'chromosome') {
    const inner = r.children.map(mgeStr).join(', ')
    const attrs = attrsStr(r.attributes)
    return `(${inner})${r.label}${attrs}`
  }
  return mgeStr(r)
}

function mgeStr(m: MGENode): string {
  const inner = m.children.map(mgeStr).join(', ')
  const attrs = attrsStr(m.attributes)
  return `{${inner}}${m.label}${attrs}`
}

function attrsStr(attrs: Record<string, string>): string {
  const pairs = Object.entries(attrs)
  if (!pairs.length) return ''
  return '[' + pairs.map(([k, v]) => `${k}="${v}"`).join(', ') + ']'
}
