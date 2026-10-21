/** Compose Figure 3 from the same containment renderer used by the browser. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const compiled = process.argv[2]
if (!compiled) throw new Error('Pass the directory containing compiled CellGen TypeScript modules.')
const { parseCellGen } = await import(pathToFileURL(path.resolve(compiled, 'parser.js')))
const { renderContainmentSVG } = await import(pathToFileURL(path.resolve(compiled, 'containmentRenderer.js')))
const specs = JSON.parse(fs.readFileSync(path.join(here, 'structures.json'), 'utf8'))
const contexts = JSON.parse(fs.readFileSync(path.join(here, 'query-results.json'), 'utf8')).contexts
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const text = (x, y, value, size = 22, weight = 400, family = 'Arial, sans-serif') =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="#18212b">${escape(value)}</text>`

const panels = specs.map((entry, i) => {
  const input = fs.readFileSync(path.join(here, 'records', entry.record + '.cellgen'), 'utf8')
  const parsed = parseCellGen(input)
  assert.equal(parsed.ok, true, entry.record)
  const svg = renderContainmentSVG(parsed.value)
  const visit = node => {
    assert(svg.includes(`>${escape(node.label)}</text>`), `${entry.record}: missing visible ${node.label}`)
    node.children.forEach(visit)
  }
  visit(parsed.value.cells[0].replicons[0])
  fs.writeFileSync(path.join(here, 'records', entry.record + '.svg'), svg)
  const dimensions = svg.match(/width="([\d.]+)" height="([\d.]+)"/)
  const width = Number(dimensions[1]), height = Number(dimensions[2])
  const x = 20 + (i % 3) * 400, y = 15 + Math.floor(i / 3) * 470
  const group = entry.plasmid_group === 'singleton' ? 'distinct backbone' : 'UVA01-like group'
  const scale = 1.3
  const drawing = svg.replace(/<svg[^>]+>/, `<svg x="${x + (360 - width * scale) / 2}" y="${y + 65}" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}">`)
  const code = contexts[i].cellgen_display
  const split = code.indexOf('[') >= 0 ? code.indexOf('[') : code.lastIndexOf('}') + 1
  const lines = [code.slice(0, split), code.slice(split)]
  assert.equal(parseCellGen(lines.join('\n')).ok, true, `${entry.record}: displayed line breaks`)
  return [text(x, y + 22, `${String.fromCharCode(65 + i)}  ${entry.isolate}`, 24, 700),
    text(x, y + 49, `${entry.accession} | ${group}`, 18), drawing,
    text(x + 5, y + 398, lines[0], 20, 400, 'Courier New, monospace'),
    text(x + 5, y + 426, lines[1], 20, 400, 'Courier New, monospace')].join('\n')
})
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="7.2in" height="5.76in" viewBox="0 0 1200 960"><rect width="1200" height="960" fill="white"/>\n${panels.join('\n')}\n</svg>\n`
fs.writeFileSync(path.resolve(here, '../../figures/Figure_3_Sheppard_collection.svg'), svg)
console.log('Rendered six complete containment trees and six validated compact CellGen forms.')
