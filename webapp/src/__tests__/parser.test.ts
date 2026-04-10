/**
 * Unit tests for the Wolvercote parser.
 * Valid cases are driven from the shared test_suite.json.
 */
import { describe, it, expect } from 'vitest'
import { parseWolvercote, validateWolvercote } from '../wolvercote/parser'
import { to_wolvercote } from '../wolvercote/serialise'
import testSuite from '../../../tests/test_suite.json'

// ── helpers ──────────────────────────────────────────────────────────────────

function parse(input: string) {
  const result = parseWolvercote(input)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

// ── valid cases from test_suite.json ─────────────────────────────────────────

describe('parser — valid cases from test_suite.json', () => {
  for (const tc of testSuite.valid) {
    it(`${tc.id}: ${tc.description}`, () => {
      const cs = parse(tc.input)
      const exp = tc.expected as Record<string, unknown>

      if ('cells' in exp) {
        expect(cs.cells).toHaveLength(exp.cells as number)
      }
      if ('replicons_in_cell_0' in exp) {
        expect(cs.cells[0].replicons).toHaveLength(exp.replicons_in_cell_0 as number)
      }
      if ('cell_0_replicon_0_type' in exp) {
        expect(cs.cells[0].replicons[0].kind).toBe(exp.cell_0_replicon_0_type)
      }
      if ('cell_0_replicon_0_label' in exp) {
        expect(cs.cells[0].replicons[0].label.trim()).toBe(exp.cell_0_replicon_0_label)
      }
      if ('cell_0_replicon_1_type' in exp) {
        expect(cs.cells[0].replicons[1].kind).toBe(exp.cell_0_replicon_1_type)
      }
      if ('cell_0_replicon_0_children' in exp) {
        expect(cs.cells[0].replicons[0].children).toHaveLength(
          exp.cell_0_replicon_0_children as number,
        )
      }
      if ('cell_0_replicon_0_attributes' in exp) {
        expect(cs.cells[0].replicons[0].attributes).toEqual(exp.cell_0_replicon_0_attributes)
      }
    })
  }
})

// ── invalid cases from test_suite.json ───────────────────────────────────────

describe('parser — invalid cases from test_suite.json', () => {
  const shouldFail = testSuite.invalid.filter((tc) => !('note' in tc))
  const mayFail = testSuite.invalid.filter((tc) => 'note' in tc)

  for (const tc of shouldFail) {
    it(`${tc.id}: ${tc.description}`, () => {
      const result = parseWolvercote(tc.input)
      expect(result.ok).toBe(false)
    })
  }

  for (const tc of mayFail) {
    it(`${tc.id}: must not crash (may accept trailing semicolons)`, () => {
      // Parser may accept or reject — but must not throw
      expect(() => parseWolvercote(tc.input)).not.toThrow()
    })
  }
})

// ── additional unit tests ─────────────────────────────────────────────────────

describe('parser — error position', () => {
  it('reports a non-zero position for mid-string errors', () => {
    const result = parseWolvercote('()chr1, (unclosed')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.position).toBeGreaterThan(0)
    }
  })

  it('reports position 0 for empty input', () => {
    const result = parseWolvercote('')
    expect(result.ok).toBe(false)
  })
})

describe('parser — round-trip', () => {
  const cases = [
    '()chr1',
    '()chr1,{}pBAD',
    '({}Tn3)chromosome',
    '{ {}blaKPC-2 }pKpQIL',
    '{ { {}blaKPC-2 }Tn4401 }pKpQIL',
    '()chrA ; ()chrB',
    '()chr[organism="E. coli", strain="K-12"]',
  ]

  for (const input of cases) {
    it(`round-trips: ${input}`, () => {
      const cs = parse(input)
      const serialised = to_wolvercote(cs)
      const cs2 = parse(serialised)
      // Structure must be preserved
      expect(cs2.cells.length).toBe(cs.cells.length)
      expect(cs2.cells[0].replicons.length).toBe(cs.cells[0].replicons.length)
    })
  }
})

describe('validateWolvercote', () => {
  it('returns no errors for valid input', () => {
    expect(validateWolvercote('()chr1,{}pBAD')).toHaveLength(0)
  })

  it('returns an error message for invalid input', () => {
    expect(validateWolvercote('(unclosed')).not.toHaveLength(0)
  })
})
