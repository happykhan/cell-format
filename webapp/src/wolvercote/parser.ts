/**
 * Wolvercote format parser.
 *
 * Grammar:
 *   CellSet     → Cell (';' Cell)*
 *   Cell        → Replicon (',' Replicon)*
 *   Replicon    → Chromosome | MGE
 *   Chromosome  → '(' MGE* ')' Label AttributeSet?
 *   MGE         → '{' MGE* '}' Label AttributeSet?  |  empty
 *   Label       → string (letters, digits, underscore, hyphen, dot, space) | empty
 *   AttributeSet→ '[' KeyValue (',' KeyValue)* ']'
 *   KeyValue    → Key '=' '"' Value '"'
 */

import type { Attributes, Cell, CellSet, ChromosomeNode, MGENode, ParseResult } from './types'

class Parser {
  private input: string
  private pos: number

  constructor(input: string) {
    this.input = input
    this.pos = 0
  }

  private peek(): string {
    this.skipWS()
    return this.input[this.pos] ?? ''
  }

  private consume(): string {
    this.skipWS()
    return this.input[this.pos++] ?? ''
  }

  private skipWS(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++
    }
  }

  private expect(ch: string): void {
    const got = this.consume()
    if (got !== ch) {
      throw this.error(`Expected '${ch}' but found '${got || 'end of input'}'`)
    }
  }

  private error(msg: string): ParseError {
    const found = this.input[this.pos] ?? 'end of input'
    return { kind: 'error', message: msg, position: this.pos, found }
  }

  parseCellSet(): CellSet {
    const cells: Cell[] = []
    cells.push(this.parseCell())
    while (this.peek() === ';') {
      this.consume() // ';'
      if (this.peek() === '') break // trailing semicolon ok
      cells.push(this.parseCell())
    }
    if (this.peek() !== '') {
      throw this.error(`Unexpected character '${this.peek()}' after end of expression`)
    }
    return { cells }
  }

  private parseCell(): Cell {
    const replicons = []
    replicons.push(this.parseReplicon())
    while (this.peek() === ',') {
      this.consume() // ','
      // After comma we must have a replicon opener
      const next = this.peek()
      if (next !== '(' && next !== '{') {
        throw this.error(`Expected '(' or '{' after ',' but found '${next || 'end of input'}'`)
      }
      replicons.push(this.parseReplicon())
    }
    return { replicons }
  }

  private parseReplicon(): ChromosomeNode | MGENode {
    const next = this.peek()
    if (next === '(') {
      return this.parseChromosome()
    } else if (next === '{') {
      return this.parseMGE()
    } else {
      throw this.error(`Expected '(' for chromosome or '{' for MGE but found '${next || 'end of input'}'`)
    }
  }

  private parseChromosome(): ChromosomeNode {
    this.expect('(')
    const children: MGENode[] = []
    while (this.peek() !== ')') {
      if (this.peek() === '') throw this.error("Unclosed '(' — missing ')'")
      children.push(this.parseMGE())
      if (this.peek() === ',') this.consume()
    }
    this.expect(')')
    const label = this.parseLabel()
    const attributes = this.parseAttributes()
    return { kind: 'chromosome', label, children, attributes }
  }

  private parseMGE(): MGENode {
    this.expect('{')
    const children: MGENode[] = []
    while (this.peek() !== '}') {
      if (this.peek() === '') throw this.error("Unclosed '{' — missing '}'")
      children.push(this.parseMGE())
      if (this.peek() === ',') this.consume()
    }
    this.expect('}')
    const label = this.parseLabel()
    const attributes = this.parseAttributes()
    return { kind: 'mge', label, children, attributes }
  }

  private parseLabel(): string {
    this.skipWS()
    let label = ''
    // Labels: alphanumeric, underscore, hyphen, dot, space (but not special chars)
    while (
      this.pos < this.input.length &&
      /[a-zA-Z0-9_\-. ]/.test(this.input[this.pos]) &&
      !['(', ')', '{', '}', '[', ']', ',', ';', '=', '"'].includes(this.input[this.pos])
    ) {
      label += this.input[this.pos++]
    }
    return label.trim()
  }

  private parseAttributes(): Attributes {
    this.skipWS()
    if (this.peek() !== '[') return {}
    this.consume() // '['
    const attrs: Attributes = {}
    while (this.peek() !== ']') {
      if (this.peek() === '') throw this.error("Unclosed '[' — missing ']'")
      const key = this.parseAttrKey()
      this.skipWS()
      this.expect('=')
      this.skipWS()
      this.expect('"')
      const value = this.parseAttrValue()
      this.expect('"')
      attrs[key] = value
      this.skipWS()
      if (this.peek() === ',') this.consume()
    }
    this.expect(']')
    return attrs
  }

  private parseAttrKey(): string {
    this.skipWS()
    let key = ''
    while (
      this.pos < this.input.length &&
      this.input[this.pos] !== '=' &&
      this.input[this.pos] !== '"' &&
      this.input[this.pos] !== ']'
    ) {
      key += this.input[this.pos++]
    }
    return key.trim()
  }

  private parseAttrValue(): string {
    let value = ''
    // Values can contain anything except unescaped '"'
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      value += this.input[this.pos++]
    }
    return value
  }
}

interface ParseError {
  kind: 'error'
  message: string
  position: number
  found: string
}

export function parseWolvercote(input: string): ParseResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return {
      ok: false,
      error: { message: 'Input is empty', position: 0, found: '' },
    }
  }
  try {
    const parser = new Parser(trimmed)
    const value = parser.parseCellSet()
    return { ok: true, value }
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e && e.kind === 'error') {
      const err = e as ParseError
      return {
        ok: false,
        error: { message: err.message, position: err.position, found: err.found },
      }
    }
    return {
      ok: false,
      error: { message: String(e), position: 0, found: '' },
    }
  }
}

export function validateWolvercote(input: string): string[] {
  const result = parseWolvercote(input)
  if (result.ok) return []
  return [`Position ${result.error.position}: ${result.error.message}`]
}
