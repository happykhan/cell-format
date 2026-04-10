/**
 * Interactive genome builder — click to add chromosomes, plasmids, and MGEs.
 * Produces a Wolvercote format string from UI interactions.
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

function elementDot(type: ElementType, _label: string) {
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
        verticalAlign: 'middle',
      }}
    />
  )
}

interface BuilderState {
  cells: Array<{
    chromosomes: Array<{ label: string; mges: Array<{ type: ElementType; label: string }> }>
    mges: Array<{ type: ElementType; label: string; mges: Array<{ type: ElementType; label: string }> }>
  }>
}

function stateToWolvercote(state: BuilderState): string {
  return state.cells
    .map((cell) => {
      const parts: string[] = []
      for (const chr of cell.chromosomes) {
        const inner = chr.mges.map((m) => `{}${m.label}`).join(', ')
        parts.push(`(${inner})${chr.label}`)
      }
      for (const mge of cell.mges) {
        const inner = mge.mges.map((m) => `{}${m.label}`).join(', ')
        parts.push(`{${inner}}${mge.label}`)
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

function cellSetToBuilderState(cs: CellSet): BuilderState {
  return {
    cells: cs.cells.map((cell) => ({
      chromosomes: cell.replicons
        .filter((r): r is ChromosomeNode => r.kind === 'chromosome')
        .map((ch) => ({
          label: ch.label,
          mges: ch.children.map((m) => ({ type: mgeTypeFromLabel(m.label), label: m.label })),
        })),
      mges: cell.replicons
        .filter((r): r is MGENode => r.kind === 'mge')
        .map((m) => ({
          type: mgeTypeFromLabel(m.label),
          label: m.label,
          mges: m.children.map((c) => ({ type: mgeTypeFromLabel(c.label), label: c.label })),
        })),
    })),
  }
}

interface Props {
  onUpdate: (wolvercote: string) => void
  syncFrom?: CellSet | null
  syncVersion?: number
}

export function InteractiveBuilder({ onUpdate, syncFrom, syncVersion }: Props) {
  const [state, setState] = useState<BuilderState>({ cells: [{ chromosomes: [], mges: [] }] })

  useEffect(() => {
    if (!syncFrom) return
    setState(cellSetToBuilderState(syncFrom))
  }, [syncVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const [modal, setModal] = useState<{
    show: boolean
    cellIdx: number
    chrIdx?: number
    mgeIdx?: number
    forNested: boolean
  } | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<ElementType>('chromosome')

  const update = (next: BuilderState) => {
    setState(next)
    onUpdate(stateToWolvercote(next))
  }

  const addCell = () => {
    update({ cells: [...state.cells, { chromosomes: [], mges: [] }] })
  }

  const removeCell = (idx: number) => {
    const cells = state.cells.filter((_, i) => i !== idx)
    update({ cells: cells.length ? cells : [{ chromosomes: [], mges: [] }] })
  }

  const openModal = (cellIdx: number, forNested: boolean, chrIdx?: number, mgeIdx?: number) => {
    setModal({ show: true, cellIdx, chrIdx, mgeIdx, forNested })
    setNewLabel('')
    setNewType(forNested ? 'transposon' : 'chromosome')
  }

  const confirmAdd = () => {
    if (!modal) return
    const label = newLabel.trim()
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    const cell = next.cells[modal.cellIdx]

    if (!modal.forNested) {
      if (newType === 'chromosome') {
        cell.chromosomes.push({ label, mges: [] })
      } else {
        cell.mges.push({ type: newType, label, mges: [] })
      }
    } else {
      const mge = { type: newType, label }
      if (modal.chrIdx !== undefined) {
        cell.chromosomes[modal.chrIdx].mges.push(mge)
      } else if (modal.mgeIdx !== undefined) {
        cell.mges[modal.mgeIdx].mges.push(mge)
      }
    }
    update(next)
    setModal(null)
  }

  const removeChromosome = (cellIdx: number, chrIdx: number) => {
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    next.cells[cellIdx].chromosomes.splice(chrIdx, 1)
    update(next)
  }

  const removeMGE = (cellIdx: number, mgeIdx: number) => {
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    next.cells[cellIdx].mges.splice(mgeIdx, 1)
    update(next)
  }

  const removeNestedChr = (cellIdx: number, chrIdx: number, mgeIdx: number) => {
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    next.cells[cellIdx].chromosomes[chrIdx].mges.splice(mgeIdx, 1)
    update(next)
  }

  const removeNestedMGE = (cellIdx: number, mgeIdx: number, nestedIdx: number) => {
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    next.cells[cellIdx].mges[mgeIdx].mges.splice(nestedIdx, 1)
    update(next)
  }

  const typeOptions = modal?.forNested
    ? (['transposon', 'integron', 'insertion_sequence', 'phage'] as ElementType[])
    : (['chromosome', 'plasmid', 'transposon', 'integron', 'insertion_sequence', 'phage'] as ElementType[])

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
                {elementDot('chromosome', chr.label)}
                <span>{chr.label || '(chromosome)'}</span>
                <button className="builder-remove-btn" onClick={() => removeChromosome(ci, chri)}>×</button>
              </div>
              {chr.mges.map((mge, mi) => (
                <div key={mi} className="builder-nested">
                  {elementDot(mge.type, mge.label)}
                  <span>{mge.label || `(${mge.type})`}</span>
                  <button className="builder-remove-btn" onClick={() => removeNestedChr(ci, chri, mi)}>×</button>
                </div>
              ))}
              <button className="builder-add-nested-btn" onClick={() => openModal(ci, true, chri, undefined)}>
                + Add MGE to chromosome
              </button>
            </div>
          ))}

          {/* Top-level MGEs */}
          {cell.mges.map((mge, mi) => (
            <div key={mi} className="builder-replicon builder-mge">
              <div className="builder-replicon-header">
                {elementDot(mge.type, mge.label)}
                <span>{mge.label || `(${mge.type})`}</span>
                <button className="builder-remove-btn" onClick={() => removeMGE(ci, mi)}>×</button>
              </div>
              {mge.mges.map((nested, ni) => (
                <div key={ni} className="builder-nested">
                  {elementDot(nested.type, nested.label)}
                  <span>{nested.label || `(${nested.type})`}</span>
                  <button className="builder-remove-btn" onClick={() => removeNestedMGE(ci, mi, ni)}>×</button>
                </div>
              ))}
              <button className="builder-add-nested-btn" onClick={() => openModal(ci, true, undefined, mi)}>
                + Add MGE inside
              </button>
            </div>
          ))}

          <button className="builder-add-btn" onClick={() => openModal(ci, false)}>
            + Add element
          </button>
        </div>
      ))}

      <button className="gx-btn gx-btn-secondary" onClick={addCell} style={{ marginTop: '0.75rem' }}>
        + Add cell
      </button>

      {/* Modal */}
      {modal?.show && (
        <div className="builder-modal-overlay" onClick={() => setModal(null)}>
          <div className="builder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="builder-modal-title">
              {modal.forNested ? 'Add MGE' : 'Add element'}
            </div>

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

            <label className="builder-modal-label">Label (optional)</label>
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
              <button className="gx-btn gx-btn-primary" onClick={confirmAdd}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
