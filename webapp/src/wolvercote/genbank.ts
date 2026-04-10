/**
 * GenBank / GFF3 parser that extracts genomic elements and generates
 * a Wolvercote format string.
 *
 * GenBank: parses LOCUS, DEFINITION, FEATURES sections.
 * GFF3: parses ##sequence-region and feature lines.
 */

interface RepliconInfo {
  id: string
  type: 'chromosome' | 'plasmid' | 'mge'
  label: string
  mges: string[]
}

// Keywords used to classify replicons and features
const CHROMOSOME_KEYWORDS = ['chromosome', 'chr', 'main', 'genome']
const PLASMID_KEYWORDS = ['plasmid', 'pbad', 'p', 'contig']
const MGE_KEYWORDS = ['transposon', 'tn', 'integron', 'intg', 'insertion', 'is', 'phage', 'prophage', 'icr', 'imex']

function classifyByLabel(label: string): 'chromosome' | 'plasmid' | 'mge' {
  const l = label.toLowerCase()
  if (MGE_KEYWORDS.some(k => l.includes(k))) return 'mge'
  if (PLASMID_KEYWORDS.some(k => l.startsWith(k) || l.includes('plasmid'))) return 'plasmid'
  if (CHROMOSOME_KEYWORDS.some(k => l.includes(k))) return 'chromosome'
  return 'chromosome' // default: assume chromosome
}

function repliconToWolvercote(rep: RepliconInfo): string {
  const mgeStr = rep.mges.map(m => `{}${m}`).join(', ')
  const inner = mgeStr ? ` ${mgeStr} ` : ''
  if (rep.type === 'chromosome') {
    return `(${inner})${rep.label}`
  } else {
    return `{${inner}}${rep.label}`
  }
}

// ── GenBank parser ────────────────────────────────────────────────────────────

export function parseGenBank(text: string): { wolvercote: string; replicons: RepliconInfo[] } {
  const replicons: RepliconInfo[] = []
  const lines = text.split('\n')

  let currentReplicon: RepliconInfo | null = null
  let inFeatures = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // New record starts with LOCUS
    if (line.startsWith('LOCUS')) {
      const parts = line.split(/\s+/)
      const id = parts[1] ?? 'unknown'
      const label = id
      const type = classifyByLabel(label)
      currentReplicon = { id, type, label, mges: [] }
      replicons.push(currentReplicon)
      inFeatures = false
      continue
    }

    if (line.startsWith('DEFINITION') && currentReplicon) {
      const def = line.replace('DEFINITION', '').trim().toLowerCase()
      if (def.includes('plasmid')) currentReplicon.type = 'plasmid'
      else if (def.includes('chromosome')) currentReplicon.type = 'chromosome'
      continue
    }

    if (line.startsWith('FEATURES')) {
      inFeatures = true
      continue
    }

    if (line.startsWith('ORIGIN') || line.startsWith('//')) {
      inFeatures = false
      continue
    }

    if (inFeatures && currentReplicon) {
      // Feature lines: "     mobile_element     1..5000"
      //                "                        /mobile_element_type="transposon:Tn3""
      const featureMatch = line.match(/^\s{5}(\w+)\s+/)
      if (featureMatch) {
        const featureType = featureMatch[1].toLowerCase()
        if (['mobile_element', 'transposon', 'integron', 'repeat_region'].includes(featureType)) {
          // Look ahead for /mobile_element_type or /note qualifier
          let mgeLabel = featureType
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const qual = lines[j].match(/\/(?:mobile_element_type|note|gene|locus_tag)="([^"]+)"/)
            if (qual) {
              mgeLabel = qual[1].split(':').pop() ?? mgeLabel
              mgeLabel = mgeLabel.replace(/[^a-zA-Z0-9_\-. ]/g, '').trim()
              break
            }
            if (!lines[j].startsWith('  ')) break
          }
          if (mgeLabel && !currentReplicon.mges.includes(mgeLabel)) {
            currentReplicon.mges.push(mgeLabel)
          }
        }
      }
    }
  }

  return buildResult(replicons)
}

// ── GFF3 parser ───────────────────────────────────────────────────────────────

export function parseGFF(text: string): { wolvercote: string; replicons: RepliconInfo[] } {
  const replicons: Map<string, RepliconInfo> = new Map()
  const lines = text.split('\n')

  for (const line of lines) {
    if (line.startsWith('#')) {
      // ##sequence-region seqname start end
      const m = line.match(/^##sequence-region\s+(\S+)/)
      if (m) {
        const id = m[1]
        if (!replicons.has(id)) {
          replicons.set(id, { id, type: classifyByLabel(id), label: id, mges: [] })
        }
      }
      continue
    }
    if (!line.trim()) continue

    const cols = line.split('\t')
    if (cols.length < 9) continue

    const seqId = cols[0]
    const featureType = cols[2].toLowerCase()
    const attrs = cols[8]

    // Ensure replicon exists
    if (!replicons.has(seqId)) {
      replicons.set(seqId, { id: seqId, type: classifyByLabel(seqId), label: seqId, mges: [] })
    }
    const rep = replicons.get(seqId)!

    // Update type from feature type
    if (featureType === 'chromosome') rep.type = 'chromosome'
    else if (featureType === 'plasmid') rep.type = 'plasmid'

    // Extract MGEs
    if (['mobile_genetic_element', 'transposable_element', 'integron', 'transposon',
         'insertion_sequence', 'repeat_region'].includes(featureType)) {
      // Parse Name= or ID= from attributes
      const nameMatch = attrs.match(/(?:Name|ID)=([^;]+)/)
      let mgeLabel = nameMatch ? nameMatch[1] : featureType
      mgeLabel = mgeLabel.split(':').pop() ?? mgeLabel
      mgeLabel = mgeLabel.replace(/[^a-zA-Z0-9_\-. ]/g, '').trim()
      if (mgeLabel && !rep.mges.includes(mgeLabel)) {
        rep.mges.push(mgeLabel)
      }
    }
  }

  return buildResult([...replicons.values()])
}

function buildResult(replicons: RepliconInfo[]): { wolvercote: string; replicons: RepliconInfo[] } {
  if (replicons.length === 0) {
    return { wolvercote: '', replicons: [] }
  }

  // Group into a single cell (all replicons together)
  const parts = replicons.map(repliconToWolvercote)
  return {
    wolvercote: parts.join(', '),
    replicons,
  }
}

export function detectFileType(filename: string, content: string): 'genbank' | 'gff' | 'unknown' {
  if (filename.match(/\.(gb|gbk|genbank)$/i)) return 'genbank'
  if (filename.match(/\.(gff|gff3)$/i)) return 'gff'
  if (content.startsWith('LOCUS') || content.startsWith('##FASTA') === false && content.includes('     source')) return 'genbank'
  if (content.startsWith('##gff-version') || content.startsWith('##GFF')) return 'gff'
  return 'unknown'
}
