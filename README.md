# Wolvercote format

A compact, human-readable notation for describing the organisation of bacterial genomes — inspired by the Newick format for phylogenetic trees.

## Overview

Long-read sequencing now routinely produces complete bacterial genome assemblies, revealing the full complement of chromosomes, plasmids, and mobile genetic elements (MGEs) in a cell. The Wolvercote format provides a standard way to record and share this information in a single line of text.

**Key features**

- Describes chromosomes, plasmids, transposons, integrons, and other MGEs
- Captures nested containment (e.g. an integron inside a plasmid)
- Represents multiple cells in one string (e.g. two strains sharing a plasmid)
- Supports free-text labels and key-value attributes
- Machine-parseable and human-readable

## Web app

**[wolvercote.genomicx.org](https://wolvercote.genomicx.org)** — paste a Wolvercote string and get an SVG diagram. Or upload a GenBank/GFF3 file to generate the format automatically.

## Format definition

### Grammar

```
CellSet      → Cell (';' Cell)*
Cell         → Replicon (',' Replicon)*
Replicon     → Chromosome | MGE
Chromosome   → '(' MGE* ')' Label AttributeSet?
MGE          → '{' MGE* '}' Label AttributeSet?
Label        → string | empty
AttributeSet → '[' KeyValue (',' KeyValue)* ']'
KeyValue     → Key '=' '"' Value '"'
```

- `( ... )` — chromosome
- `{ ... }` — non-chromosomal element (plasmid, transposon, integron, phage, etc.)
- `;` — separates cells in a multi-cell set
- `,` — separates replicons within a cell
- `[key="value"]` — optional attributes on any element

### Examples

**Single chromosome with an integron**
```
({}integron)my_chr
```

**Chromosome and a plasmid**
```
()chr1, {}pBAD
```

**Chromosome and plasmid where the plasmid is also integrated in the chromosome**
```
({}plasmid1)chromosome, {}plasmid1
```

**Chromosome with a transposon; plasmid carrying a transposon and an integron**
```
( {}transposon1 )chromosome , { {}transposon2, {}integron }plasmid
```

**Two cells sharing the same plasmid**
```
()chromosome1, {}plasmidA ; ()chromosome2, {}plasmidA
```

**Chromosome with attributes**
```
()chromosome[organism="Escherichia coli", strain="K-12"]
```

**Plasmid with nested integrons, each carrying identical gene cassettes**
```
()chromosome, { {}integronA }plasmid1, { {}integronA }plasmid2
```

## Web app (`webapp/`)

A fully client-side React application built with [@genomicx/ui](https://github.com/genomicx/genomicx-ui).

### Features

- **Live parser** — type or paste a Wolvercote string; errors shown inline with position
- **SVG renderer** — circular diagrams: blue for chromosomes, green for plasmids, coloured rectangles on borders for MGEs
- **GenBank / GFF3 import** — upload an annotated assembly file to auto-generate the Wolvercote string
- **Download** — export the diagram as SVG or the format string as plain text
- **No server required** — everything runs in the browser

### Run locally

```bash
cd webapp
npm install
npm run dev
```

### Build

```bash
cd webapp
npm run build   # output in webapp/dist/
```

## Authors

Centre for Genomic Pathogen Surveillance, University of Oxford

- Julio Diaz Caballero
- Nabil-Fareed Alikhan
- Khalil AbuDahab
- David Aanensen
