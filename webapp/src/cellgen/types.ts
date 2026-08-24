export interface Attributes {
  [key: string]: string
}

export interface EntityNode {
  kind: 'entity'
  label: string
  children: EntityNode[]
  attributes: Attributes
}

export interface ChromosomeNode {
  kind: 'chromosome'
  label: string
  children: EntityNode[]
  attributes: Attributes
}

export type CellularElement = ChromosomeNode | EntityNode

export interface Cell {
  replicons: CellularElement[]
}

export interface CellSet {
  cells: Cell[]
}

export interface ParseError {
  message: string
  position: number
  found: string
}

export type ParseResult =
  | { ok: true; value: CellSet }
  | { ok: false; error: ParseError }
