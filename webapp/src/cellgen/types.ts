export interface Attributes {
  [key: string]: string
}

export interface MGENode {
  kind: 'mge'
  label: string
  children: MGENode[]
  attributes: Attributes
}

export interface ChromosomeNode {
  kind: 'chromosome'
  label: string
  children: MGENode[]
  attributes: Attributes
}

export type Replicon = ChromosomeNode | MGENode

export interface Cell {
  replicons: Replicon[]
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
