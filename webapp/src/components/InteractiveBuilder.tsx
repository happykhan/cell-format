/**
 * Interactive genome builder — click to add chromosomes, plasmids, and MGEs.
 * Supports recursive nesting: e.g. blaKPC-2 inside Tn4401 inside pKpQIL.
 */

import { useState, useEffect } from 'react'
import type { CellSet, ChromosomeNode, MGENode } from '../wolvercote/types'

type ElementType = 'chromosome' | 'plasmid' | 'transposon' | 'integron' | 'insertion_sequence' | 'phage' | 'gene' | 'other'

const ELEMENT_LABELS: Record<ElementType, string> = {
  chromosome: 'Chromosome',
  plasmid: 'Plasmid',
  transposon: 'Transposon',
  integron: 'Integron',
  insertion_sequence: 'Insertion sequence',
  phage: 'Prophage',
  gene: 'Gene',
  other: 'Other',
}

const DEFAULT_COLOURS: Record<string, string> = {
  chromosome: '#3a6fba',
  plasmid: '#3a9943',
  transposon: '#e05252',
  integron: '#9b59b6',
  insertion_sequence: '#f39c12',
  phage: '#16a085',
  gene: '#c0392b',
  other: '#888888',
}

function resolveColour(type: ElementType, customColour?: string): string {
  return customColour || DEFAULT_COLOURS[type] || '#888'
}

function elementDot(type: ElementType, customColour?: string) {
  const colour = resolveColour(type, customColour)
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: type === 'chromosome' || type === 'plasmid' ? '50%' : 2,
        background: colour,
        marginRight: 6,
        flexShrink: 0,
        verticalAlign: 'middle',
      }}
    />
  )
}

// Recursive MGE item — children can themselves have children
interface MGEItem {
  type: ElementType
  label: string
  colour?: string   // custom colour; undefined = use type default
  mges: MGEItem[]
}

interface BuilderState {
  cells: Array<{
    chromosomes: Array<{ label: string; mges: MGEItem[] }>
    mges: MGEItem[]
  }>
}

function mgeItemStr(m: MGEItem): string {
  const inner = m.mges.map(mgeItemStr).join(', ')
  const defaultCol = DEFAULT_COLOURS[m.type] || '#888'
  const attrParts: string[] = []
  // Encode type when it can't be reliably inferred from the label alone
  if (m.type !== 'plasmid' && m.type !== mgeTypeFromLabel(m.label)) {
    attrParts.push(`type="${m.type}"`)
  }
  if (m.colour && m.colour !== defaultCol) {
    attrParts.push(`colour="${m.colour}"`)
  }
  const attrs = attrParts.length ? `[${attrParts.join(', ')}]` : ''
  return `{${inner}}${m.label}${attrs}`
}

function stateToWolvercote(state: BuilderState): string {
  return state.cells
    .map((cell) => {
      const parts: string[] = []
      for (const chr of cell.chromosomes) {
        const inner = chr.mges.map(mgeItemStr).join(', ')
        parts.push(`(${inner})${chr.label}`)
      }
      for (const mge of cell.mges) {
        parts.push(mgeItemStr(mge))
      }
      return parts.join(', ')
    })
    .join(' ; ')
}

function mgeTypeFromLabel(label: string): ElementType {
  const l = label.toLowerCase()
  if (l.includes('transposon') || /^tn\d/.test(l)) return 'transposon'
  if (l.includes('integron') || /^int\d/.test(l)) return 'integron'
  if (l.includes('insertion') || /^is\d/.test(l)) return 'insertion_sequence'
  if (l.includes('phage')) return 'phage'
  return 'plasmid'
}

function mgeNodeToItem(m: MGENode): MGEItem {
  const type = (m.attributes.type as ElementType) || mgeTypeFromLabel(m.label)
  const colour = m.attributes.colour || undefined
  return {
    type,
    label: m.label,
    colour,
    mges: m.children.map(mgeNodeToItem),
  }
}

function cellSetToBuilderState(cs: CellSet): BuilderState {
  return {
    cells: cs.cells.map((cell) => ({
      chromosomes: cell.replicons
        .filter((r): r is ChromosomeNode => r.kind === 'chromosome')
        .map((ch) => ({ label: ch.label, mges: ch.children.map(mgeNodeToItem) })),
      mges: cell.replicons
        .filter((r): r is MGENode => r.kind === 'mge')
        .map(mgeNodeToItem),
    })),
  }
}

// Path into the MGEItem tree: array of indices navigating into .mges
type MGEPath = number[]

function getAtPath(root: MGEItem[], path: MGEPath): MGEItem {
  let node = root[path[0]]
  for (let i = 1; i < path.length; i++) node = node.mges[path[i]]
  return node
}

// Modal identifies *where* to add or what to edit
type ModalTarget =
  | { kind: 'cell' }
  | { kind: 'chr'; chrIdx: number }
  | { kind: 'chr-mge'; chrIdx: number; path: MGEPath }
  | { kind: 'mge'; path: MGEPath }
  | { kind: 'edit-chr'; chrIdx: number }
  | { kind: 'edit-chr-mge'; chrIdx: number; path: MGEPath }
  | { kind: 'edit-mge'; path: MGEPath }

interface ModalState {
  cellIdx: number
  target: ModalTarget
  isEdit: boolean
}

interface Props {
  onUpdate: (wolvercote: string) => void
  syncFrom?: CellSet | null
  syncVersion?: number
}

export function InteractiveBuilder({ onUpdate, syncFrom, syncVersion }: Props) {
  const [state, setState] = useState<BuilderState>({ cells: [{ chromosomes: [], mges: [] }] })
  const [modal, setModal] = useState<ModalState | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<ElementType>('chromosome')
  const [newColour, setNewColour] = useState('')

  useEffect(() => {
    if (syncFrom) {
      setState(cellSetToBuilderState(syncFrom))
    } else {
      setState({ cells: [{ chromosomes: [], mges: [] }] })
    }
  }, [syncVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: BuilderState) => {
    setState(next)
    onUpdate(stateToWolvercote(next))
  }

  const openModal = (cellIdx: number, target: ModalTarget) => {
    const forNested = target.kind !== 'cell'
    setModal({ cellIdx, target, isEdit: false })
    setNewLabel('')
    setNewType(forNested ? 'transposon' : 'chromosome')
    setNewColour('')
  }

  const openEdit = (cellIdx: number, target: ModalTarget, currentLabel: string, currentType: ElementType, currentColour?: string) => {
    setModal({ cellIdx, target, isEdit: true })
    setNewLabel(currentLabel)
    setNewType(currentType)
    setNewColour(currentColour || '')
  }

  const confirmAdd = () => {
    if (!modal) return
    const label = newLabel.trim()
    const defaultCol = DEFAULT_COLOURS[newType] || '#888'
    const colour = newColour && newColour !== defaultCol ? newColour : undefined
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    const cell = next.cells[modal.cellIdx]

    if (modal.isEdit) {
      const t = modal.target
      if (t.kind === 'edit-chr') {
        cell.chromosomes[t.chrIdx].label = label
      } else if (t.kind === 'edit-chr-mge') {
        const root = cell.chromosomes[t.chrIdx].mges
        const item = t.path.length === 1 ? root[t.path[0]] : getAtPath(root, t.path)
        item.label = label
        item.type = newType
        item.colour = colour
      } else if (t.kind === 'edit-mge') {
        const item = t.path.length === 1 ? cell.mges[t.path[0]] : getAtPath(cell.mges, t.path)
        item.label = label
        item.type = newType
        item.colour = colour
      }
    } else {
      if (modal.target.kind === 'cell') {
        if (newType === 'chromosome') {
          cell.chromosomes.push({ label, mges: [] })
        } else {
          cell.mges.push({ type: newType, label, colour, mges: [] })
        }
      } else if (modal.target.kind === 'chr') {
        cell.chromosomes[modal.target.chrIdx].mges.push({ type: newType, label, colour, mges: [] })
      } else if (modal.target.kind === 'chr-mge') {
        const { chrIdx, path } = modal.target
        const root = cell.chromosomes[chrIdx].mges
        const target = path.length === 1 ? root[path[0]] : getAtPath(root, path)
        target.mges.push({ type: newType, label, colour, mges: [] })
      } else if (modal.target.kind === 'mge') {
        const { path } = modal.target
        const root = cell.mges
        if (path.length === 1) {
          root[path[0]].mges.push({ type: newType, label, colour, mges: [] })
        } else {
          getAtPath(root, path).mges.push({ type: newType, label, colour, mges: [] })
        }
      }
    }

    update(next)
    setModal(null)
  }

  const removeCell = (idx: number) => {
    const cells = state.cells.filter((_, i) => i !== idx)
    update({ cells: cells.length ? cells : [{ chromosomes: [], mges: [] }] })
  }

  const removeChromosome = (ci: number, chri: number) => {
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    next.cells[ci].chromosomes.splice(chri, 1)
    update(next)
  }

  const removeMGE = (ci: number, path: MGEPath) => {
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    const root = next.cells[ci].mges
    if (path.length === 1) {
      root.splice(path[0], 1)
    } else {
      const parent = getAtPath(root, path.slice(0, -1))
      parent.mges.splice(path[path.length - 1], 1)
    }
    update(next)
  }

  const removeChrNestedMGE = (ci: number, chrIdx: number, path: MGEPath) => {
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    const root = next.cells[ci].chromosomes[chrIdx].mges
    if (path.length === 1) {
      root.splice(path[0], 1)
    } else {
      const parent = getAtPath(root, path.slice(0, -1))
      parent.mges.splice(path[path.length - 1], 1)
    }
    update(next)
  }

  const isChrEdit = modal?.target.kind === 'edit-chr'

  const typeOptions =
    modal?.target.kind === 'cell'
      ? (['chromosome', 'plasmid', 'transposon', 'integron', 'insertion_sequence', 'phage', 'gene', 'other'] as ElementType[])
      : (['gene', 'transposon', 'integron', 'insertion_sequence', 'phage', 'plasmid', 'other'] as ElementType[])

  function renderMGEItem(ci: number, path: MGEPath, item: MGEItem, depth: number) {
    const colour = resolveColour(item.type, item.colour)
    return (
      <div key={path.join('-')} className="mge-card" style={{ borderLeftColor: colour }}>
        <div className="mge-card-header">
          {elementDot(item.type, item.colour)}
          <button
            className="builder-label-btn mge-card-label"
            onClick={() => openEdit(ci, { kind: 'edit-mge', path }, item.label, item.type, item.colour)}
            title="Click to edit"
          >
            {item.label || `(${item.type})`}
          </button>
          <button className="builder-remove-btn" title="Remove" onClick={() => removeMGE(ci, path)}>×</button>
        </div>
        {item.mges.map((child, ni) => renderMGEItem(ci, [...path, ni], child, depth + 1))}
        <button
          className="mge-add-inside-btn"
          onClick={() => openModal(ci, { kind: 'mge', path })}
        >
          + Add inside {item.label || item.type}
        </button>
      </div>
    )
  }

  function renderChrMGEItem(ci: number, chrIdx: number, path: MGEPath, item: MGEItem) {
    const colour = resolveColour(item.type, item.colour)
    return (
      <div key={path.join('-')} className="mge-card" style={{ borderLeftColor: colour }}>
        <div className="mge-card-header">
          {elementDot(item.type, item.colour)}
          <button
            className="builder-label-btn mge-card-label"
            onClick={() => openEdit(ci, { kind: 'edit-chr-mge', chrIdx, path }, item.label, item.type, item.colour)}
            title="Click to edit"
          >
            {item.label || `(${item.type})`}
          </button>
          <button className="builder-remove-btn" title="Remove" onClick={() => removeChrNestedMGE(ci, chrIdx, path)}>×</button>
        </div>
        {item.mges.map((child, ni) => renderChrMGEItem(ci, chrIdx, [...path, ni], child))}
        <button
          className="mge-add-inside-btn"
          onClick={() => openModal(ci, { kind: 'chr-mge', chrIdx, path })}
        >
          + Add inside {item.label || item.type}
        </button>
      </div>
    )
  }

  return (
    <div className="builder">
      {state.cells.map((cell, ci) => (
        <div key={ci} className="builder-cell">
          <div className="builder-cell-header">
            <span className="builder-cell-title">Cell {ci + 1}</span>
            {state.cells.length > 1 && (
              <button className="builder-remove-btn" onClick={() => removeCell(ci)} title="Remove cell">×</button>
            )}
          </div>

          {cell.chromosomes.map((chr, chri) => (
            <div key={chri} className="builder-replicon builder-chr">
              <div className="builder-replicon-header">
                {elementDot('chromosome')}
                <button
                  className="builder-label-btn"
                  onClick={() => openEdit(ci, { kind: 'edit-chr', chrIdx: chri }, chr.label, 'chromosome')}
                  title="Click to edit"
                >
                  {chr.label || '(chromosome)'}
                </button>
                <button className="builder-remove-btn" onClick={() => removeChromosome(ci, chri)}>×</button>
              </div>
              {chr.mges.map((m, mi) => renderChrMGEItem(ci, chri, [mi], m))}
              <button
                className="builder-add-nested-btn"
                onClick={() => openModal(ci, { kind: 'chr', chrIdx: chri })}
              >
                + Add MGE to chromosome
              </button>
            </div>
          ))}

          {cell.mges.map((mge, mi) => {
            const colour = resolveColour(mge.type, mge.colour)
            return (
              <div key={mi} className="mge-card" style={{ borderLeftColor: colour }}>
                <div className="mge-card-header">
                  {elementDot(mge.type, mge.colour)}
                  <button
                    className="builder-label-btn mge-card-label"
                    onClick={() => openEdit(ci, { kind: 'edit-mge', path: [mi] }, mge.label, mge.type, mge.colour)}
                    title="Click to edit"
                  >
                    {mge.label || `(${mge.type})`}
                  </button>
                  <button className="builder-remove-btn" onClick={() => removeMGE(ci, [mi])}>×</button>
                </div>
                {mge.mges.map((child, ni) => renderMGEItem(ci, [mi, ni], child, 1))}
                <button
                  className="mge-add-inside-btn"
                  onClick={() => openModal(ci, { kind: 'mge', path: [mi] })}
                >
                  + Add inside {mge.label || mge.type}
                </button>
              </div>
            )
          })}

          <button className="builder-add-btn" onClick={() => openModal(ci, { kind: 'cell' })}>
            + Add element
          </button>
        </div>
      ))}

      <button
        className="gx-btn gx-btn-secondary"
        onClick={() => update({ cells: [...state.cells, { chromosomes: [], mges: [] }] })}
        style={{ marginTop: '0.75rem' }}
      >
        + Add cell
      </button>

      {modal && (
        <div className="builder-modal-overlay" onClick={() => setModal(null)}>
          <div className="builder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="builder-modal-title">
              {modal.isEdit ? 'Edit element' : modal.target.kind === 'cell' ? 'Add element' : 'Add MGE'}
            </div>

            {!isChrEdit && (
              <>
                <label className="builder-modal-label">Type</label>
                <select
                  className="builder-modal-select"
                  value={newType}
                  onChange={(e) => {
                    const t = e.target.value as ElementType
                    setNewType(t)
                    // Reset colour when type changes so it defaults to new type's colour
                    if (!newColour || newColour === DEFAULT_COLOURS[newType]) setNewColour('')
                  }}
                >
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>{ELEMENT_LABELS[t]}</option>
                  ))}
                </select>
              </>
            )}

            <label className="builder-modal-label">Label</label>
            <input
              className="builder-modal-input"
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={`e.g. ${newType === 'chromosome' ? 'chr1' : newType === 'plasmid' ? 'pBAD' : 'Tn3'}`}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && confirmAdd()}
            />

            {!isChrEdit && (
              <>
                <label className="builder-modal-label">
                  Colour{' '}
                  <span style={{ color: 'var(--gx-text-muted)', fontWeight: 400 }}>
                    (default: {DEFAULT_COLOURS[newType] || '#888'})
                  </span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="color"
                    value={newColour || DEFAULT_COLOURS[newType] || '#888888'}
                    onChange={(e) => setNewColour(e.target.value)}
                    style={{ width: 36, height: 28, border: '1px solid var(--gx-border)', borderRadius: 4, cursor: 'pointer', padding: 2 }}
                  />
                  <input
                    className="builder-modal-input"
                    type="text"
                    value={newColour || DEFAULT_COLOURS[newType] || '#888888'}
                    onChange={(e) => setNewColour(e.target.value)}
                    placeholder={DEFAULT_COLOURS[newType] || '#888888'}
                    style={{ flex: 1 }}
                  />
                  {newColour && newColour !== DEFAULT_COLOURS[newType] && (
                    <button
                      className="builder-remove-btn"
                      title="Reset to default"
                      onClick={() => setNewColour('')}
                      style={{ marginLeft: 0 }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </>
            )}

            <div className="builder-modal-actions">
              <button className="gx-btn gx-btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="gx-btn gx-btn-primary" onClick={confirmAdd}>
                {modal.isEdit ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
