import { Link } from 'react-router-dom'
import { ThemeToggle } from '@genomicx/ui'
import '../App.css'

declare const __APP_VERSION__: string

export default function About() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-header-brand">
            <svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="11" cy="16" r="9" fill="#dde8f8" stroke="#3a6fba" strokeWidth="2.5"/>
              <circle cx="24" cy="10" r="5" fill="#e6f5e6" stroke="#3a9943" strokeWidth="2"/>
              <rect x="17" y="10" width="5" height="3" rx="1" fill="#e05252" transform="rotate(-30 19.5 11.5)"/>
            </svg>
            <div>
              <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="app-header-name">Wolvercote</span>
              </Link>
              <span className="app-header-sub">Bacterial Genome Organisation Visualiser</span>
            </div>
          </div>
          <nav className="app-header-nav">
            <span className="app-header-version">v{__APP_VERSION__}</span>
            <ThemeToggle />
            <Link to="/" className="app-header-link-btn">← Back</Link>
            <a href="https://github.com/happykhan/cell-format" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
        </div>
      </header>

      <main className="app-main about-page">
        <div className="about-page-inner">
          <h1 className="about-page-title">About Wolvercote</h1>
          <p className="about-page-lead">
            A compact, human- and machine-readable notation for describing the genomic organisation
            of bacterial cells — chromosomes, plasmids, and nested mobile genetic elements — inspired
            by the Newick format for phylogenetic trees.
          </p>

          <h2>Abstract</h2>
          <p>
            Understanding the genomic composition of bacterial cells is central to decoding mechanisms
            of evolution, adaptation, and pathogenicity. In bacteria, the diversity and structural
            complexity of mobile genetic elements (MGEs) — including plasmids, transposons, integrons,
            and bacteriophages — pose enduring challenges for data representation and comparative analysis.
          </p>
          <p>
            The Wolvercote format is a novel, human- and machine-readable framework designed to
            comprehensively describe the genetic content of individual bacterial cells. It integrates
            chromosomal and non-chromosomal components, together with metadata such as annotations,
            host information, and mobility characteristics, within a unified, hierarchical structure.
          </p>
          <p>
            Its utility has been demonstrated through a case study on <em>Klebsiella pneumoniae</em> genomes,
            showing how it captures intricate MGE arrangements, supports detection of potential horizontal
            gene transfer events, and enables direct comparison of genomic architectures across isolates.
          </p>

          <h2>Background</h2>
          <p>
            Whole-genome sequencing has become a cornerstone of microbial genomics, enabling the
            investigation of evolution, adaptation, and transmission in unprecedented detail. Long-read
            sequencing technologies generate high-quality, complete bacterial genomes that include both
            chromosomal and MGE content.
          </p>
          <p>
            Traditional formats — such as GenBank, GFF, or assembly graphs — describe sequences and
            features effectively but do not explicitly capture the within-cell relationships between
            chromosomes and accessory elements. This limits the ability to model and share the full
            genomic composition of individual cells, especially when MGEs are nested or interact
            dynamically through horizontal gene transfer.
          </p>
          <p>
            Wolvercote addresses this by providing a flexible, recursive grammar that unifies
            chromosomal and non-chromosomal entities within a single syntactic framework, while
            allowing metadata annotation at any level.
          </p>

          <h2>Format syntax</h2>
          <table className="about-table">
            <tbody>
              <tr><td><code>()label</code></td><td>Chromosome</td></tr>
              <tr><td><code>{'{}'}label</code></td><td>Plasmid / mobile genetic element</td></tr>
              <tr><td><code>({}Tn3)chr</code></td><td>Transposon on chromosome</td></tr>
              <tr><td><code>{'{ {}blaKPC }plas'}</code></td><td>Resistance gene nested inside plasmid</td></tr>
              <tr><td><code>A , B</code></td><td>Two replicons in the same cell</td></tr>
              <tr><td><code>A ; B</code></td><td>Two separate cells</td></tr>
              <tr><td><code>[key="value"]</code></td><td>Attribute annotation on any element</td></tr>
            </tbody>
          </table>

          <h2>Grammar</h2>
          <p>The formal grammar allows infinite nesting of MGEs within other MGEs, reflecting real biological complexity:</p>
          <pre className="about-grammar">{`CellSet    → Cell (';' Cell)*
Cell       → Replicon (',' Replicon)*
Chromosome → '(' MGE* ')' Label Attrs?
MGE        → '{' MGE* '}' Label Attrs?
Attrs      → '[' Key '=' '"' Value '"' (',' ...)* ']'`}</pre>
          <p>Example encoding a <em>K. pneumoniae</em> chromosome carrying a conjugative plasmid:</p>
          <pre className="about-grammar">{`({{} pCTX-M [type="plasmid", mobility="conjugative"]} chromosome [host="Klebsiella pneumoniae"])`}</pre>

          <h2>Key features</h2>
          <ul className="about-feature-list">
            <li><strong>Within-cell linkage</strong> — chromosomes and plasmids are no longer treated as separate entities but as interdependent elements of a cellular system.</li>
            <li><strong>Recursive nesting</strong> — any MGE can contain other MGEs, faithfully representing transposons inside plasmids, resistance cassettes inside integrons, and so on.</li>
            <li><strong>Rich metadata</strong> — key-value attributes can capture resistance genes, host, mobility, source, and any other contextual information.</li>
            <li><strong>Lightweight and interoperable</strong> — plain text that parses to JSON; compatible with GenBank/GFF3 import and SVG export.</li>
            <li><strong>Multi-cell support</strong> — cells separated by <code>;</code> enable representation of metagenomics samples or co-cultures.</li>
          </ul>

          <h2>Case study: <em>Klebsiella pneumoniae</em></h2>
          <p>
            Applied to 50 complete <em>K. pneumoniae</em> genomes, Wolvercote-encoded representations enabled:
          </p>
          <ul className="about-feature-list">
            <li>automated extraction of shared MGEs across isolates,</li>
            <li>identification of potential horizontal gene transfer events, and</li>
            <li>clustering of strains based on full cell composition rather than sequence identity alone.</li>
          </ul>
          <p>
            These analyses revealed a compact yet expressive encoding, allowing rich comparative analyses
            without reliance on large intermediate files or bespoke graph structures.
          </p>

          <h2>Authors</h2>
          <p>
            Developed at the{' '}
            <a href="https://www.pathogensurveillance.net" target="_blank" rel="noreferrer">
              Centre for Genomic Pathogen Surveillance
            </a>
            , Pandemic Sciences Institute, University of Oxford, in collaboration with the WHO
            Collaborating Centre on Genomic Surveillance of AMR and the NIHR Global Health Research Unit.
          </p>
          <ul className="about-authors">
            <li>Julio Diaz Caballero</li>
            <li>Nabil-Fareed Alikhan</li>
            <li>Khalil AbuDahab</li>
            <li>David Aanensen</li>
          </ul>

          <h2>Links</h2>
          <div className="about-links">
            <a href="https://github.com/happykhan/cell-format" target="_blank" rel="noreferrer">GitHub repository</a>
            <a href="https://github.com/happykhan/cell-format/issues" target="_blank" rel="noreferrer">Report a bug</a>
            <a href="https://www.pathogensurveillance.net" target="_blank" rel="noreferrer">CGPS website</a>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        Wolvercote &mdash; bacterial genome organisation format &bull;{' '}
        <a href="https://github.com/happykhan/cell-format/issues" target="_blank" rel="noreferrer">
          Report a bug
        </a>
      </footer>
    </div>
  )
}
