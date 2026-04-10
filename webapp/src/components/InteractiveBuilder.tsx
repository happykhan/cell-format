/**
 * Interactive genome builder — click to add chromosomes, plasmids, and MGEs.
 * Supports recursive nesting: e.g. blaKPC-2 inside Tn4401 inside pKpQIL.
 */

import { useState, useEffect } from 'react'
import type { CellSet, ChromosomeNode, MGENode } from '../wolvercote/types'

type ElementType = 'chromosome' | 'plasmid' | 'transposon' | 'integron' | 'insertion_sequence' | 'phage'

const ELEMENT_LABELS: Record<ElementType, string> = {
  chromosome: 'Chromosome',
  plasmid: 'Plasmid',
  transposon: 'Transposon',
  integron: 'Integron',
  insertion_sequence: 'Insertion sequence',
  phage: 'Prophage',
}

const ELEMENT_COLOURS: Record<string, string> = {
  chromosome: '#3a6fba',
  plasmid: '#3a9943',
  transposon: '#e05252',
  integron: '#9b59b6',
  insertion_sequence: '#f39c12',
  phage: '#16a085',
}

function elementDot(type: ElementType) {
  const colour = ELEMENT_COLOURS[type] || '#888'
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
  return `{${inner}}${m.label}`
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
  return {
    type: mgeTypeFromLabel(m.label),
    label: m.label,
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
  | { kind: 'cell' }                                              // add chr or top-level MGE to cell
  | { kind: 'chr'; chrIdx: number }                               // add MGE inside chromosome
  | { kind: 'mge'; path: MGEPath }                               // add MGE inside a (nested) MGE
  | { kind: 'edit-chr'; chrIdx: number }                         // edit a chromosome's label
  | { kind: 'edit-chr-child'; chrIdx: number; childIdx: number } // edit a chromosome child MGE
  | { kind: 'edit-mge'; path: MGEPath }                          // edit a top-level or nested MGE

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

  useEffect(() => {
    if (!syncFrom) return
    setState(cellSetToBuilderState(syncFrom))
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
  }

  const openEdit = (cellIdx: number, target: ModalTarget, currentLabel: string, currentType: ElementType) => {
    setModal({ cellIdx, target, isEdit: true })
    setNewLabel(currentLabel)
    setNewType(currentType)
  }

  const confirmAdd = () => {
    if (!modal) return
    const label = newLabel.trim()
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    const cell = next.cells[modal.cellIdx]

    if (modal.isEdit) {
      // Edit mode — update existing element in place
      const t = modal.target
      if (t.kind === 'edit-chr') {
        cell.chromosomes[t.chrIdx].label = label
      } else if (t.kind === 'edit-chr-child') {
        cell.chromosomes[t.chrIdx].mges[t.childIdx].label = label
        cell.chromosomes[t.chrIdx].mges[t.childIdx].type = newType
      } else if (t.kind === 'edit-mge') {
        const item = t.path.length === 1 ? cell.mges[t.path[0]] : getAtPath(cell.mges, t.path)
        item.label = label
        item.type = newType
      }
    } else {
      // Add mode
      if (modal.target.kind === 'cell') {
        if (newType === 'chromosome') {
          cell.chromosomes.push({ label, mges: [] })
        } else {
          cell.mges.push({ type: newType, label, mges: [] })
        }
      } else if (modal.target.kind === 'chr') {
        cell.chromosomes[modal.target.chrIdx].mges.push({ type: newType, label, mges: [] })
      } else if (modal.target.kind === 'mge') {
        const { path } = modal.target
        const root = cell.mges
        if (path.length === 1) {
          root[path[0]].mges.push({ type: newType, label, mges: [] })
        } else {
          getAtPath(root, path).mges.push({ type: newType, label, mges: [] })
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

  const removeChrMGE = (ci: number, chri: number, mgeIdx: number) => {
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    next.cells[ci].chromosomes[chri].mges.splice(mgeIdx, 1)
    update(next)
  }

  const isChrEdit = modal?.target.kind === 'edit-chr'
  const typeOptions =
    modal?.target.kind === 'cell'
      ? (['chromosome', 'plasmid', 'transposon', 'integron', 'insertion_sequence', 'phage'] as ElementType[])
      : (['transposon', 'integron', 'insertion_sequence', 'phage', 'plasmid'] as ElementType[])

  // Render an MGE as a nested card — children appear inside the parent card
  function renderMGEItem(ci: number, path: MGEPath, item: MGEItem, depth: number) {
    const colour = ELEMENT_COLOURS[item.type] || '#888'
    return (
      <div key={path.join('-')} className="mge-card" style={{ borderLeftColor: colour }}>
        <div className="mge-card-header">
          {elementDot(item.type)}
          <button
            className="builder-label-btn mge-card-label"
            onClick={() => openEdit(ci, { kind: 'edit-mge', path }, item.label, item.type)}
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

  function renderChrMGEItem(ci: number, chri: number, mgeIdx: number, item: MGEItem) {
    return (
      <div key={mgeIdx} className="builder-nested">
        {elementDot(item.type)}
        <button
          className="builder-label-btn"
          onClick={() => openEdit(ci, { kind: 'edit-chr-child', chrIdx: chri, childIdx: mgeIdx }, item.label, item.type)}
          title="Click to edit"
        >
          {item.label || `(${item.type})`}
        </button>
        <button className="builder-remove-btn" onClick={() => removeChrMGE(ci, chri, mgeIdx)}>×</button>
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

          {/* Chromosomes */}
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
              {chr.mges.map((m, mi) => renderChrMGEItem(ci, chri, mi, m))}
              <button
                className="builder-add-nested-btn"
                onClick={() => openModal(ci, { kind: 'chr', chrIdx: chri })}
              >
                + Add MGE to chromosome
              </button>
            </div>
          ))}

          {/* Top-level MGEs (plasmids etc.) — use card style, support arbitrary nesting */}
          {cell.mges.map((mge, mi) => {
            const colour = ELEMENT_COLOURS[mge.type] || '#3a9943'
            return (
              <div key={mi} className="mge-card" style={{ borderLeftColor: colour }}>
                <div className="mge-card-header">
                  {elementDot(mge.type)}
                  <button
                    className="builder-label-btn mge-card-label"
                    onClick={() => openEdit(ci, { kind: 'edit-mge', path: [mi] }, mge.label, mge.type)}
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

      <button className="gx-btn gx-btn-secondary" onClick={() => update({ cells: [...state.cells, { chromosomes: [], mges: [] }] })} style={{ marginTop: '0.75rem' }}>
        + Add cell
      </button>

      {/* Modal */}
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
                  onChange={(e) => setNewType(e.target.value as ElementType)}
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
