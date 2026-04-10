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
            Bacterial genomes are not just chromosomes. A typical clinical isolate carries
            a chromosome plus a handful of plasmids, each of which may harbour transposons,
            integrons, or resistance genes nested inside one another. Standard formats like
            GenBank and GFF describe sequences well — but they say nothing about how those
            replicons relate to each other inside a cell.
          </p>
          <p className="about-page-lead">
            Wolvercote is a compact, human-readable notation that fills that gap. Inspired
            by the Newick format for phylogenetic trees, it encodes the complete genomic
            organisation of a bacterial cell — chromosomes, plasmids, and arbitrarily nested
            mobile genetic elements — in a single line of text.
          </p>

          <h2>The notation at a glance</h2>
          <p>
            Parentheses <code>()</code> mark a chromosome; curly braces <code>{'{}'}</code> mark a plasmid or
            MGE. Nesting them shows what lives inside what. A comma separates replicons
            in the same cell; a semicolon separates different cells.
          </p>
          <table className="about-table">
            <tbody>
              <tr>
                <td><code>()chr1</code></td>
                <td>A chromosome labelled <em>chr1</em></td>
              </tr>
              <tr>
                <td><code>()chr1, {'{}'}pBAD</code></td>
                <td>Chromosome plus a plasmid in the same cell</td>
              </tr>
              <tr>
                <td><code>{'{ {}blaKPC-3 }pKpQIL'}</code></td>
                <td>Resistance gene <em>blaKPC-3</em> nested inside plasmid <em>pKpQIL</em></td>
              </tr>
              <tr>
                <td><code>{'{ { {}blaKPC-3 }Tn4401 }pKpQIL'}</code></td>
                <td>KPC gene inside a transposon inside a plasmid — three levels deep</td>
              </tr>
              <tr>
                <td><code>A ; B</code></td>
                <td>Two cells, e.g. from a metagenomics sample</td>
              </tr>
              <tr>
                <td><code>[key="value"]</code></td>
                <td>Metadata annotation on any element</td>
              </tr>
            </tbody>
          </table>

          <h2>Why it matters</h2>
          <p>
            Mobile genetic elements are the main vehicle for spread of antimicrobial
            resistance. Understanding <em>where</em> a resistance gene sits — on a conjugative
            plasmid, inside a transposon, or integrated into the chromosome — is just as
            important as knowing the gene is there. Wolvercote makes that structure explicit
            and comparable across isolates without requiring large intermediate files or
            bespoke graph databases.
          </p>
          <p>
            The recursive grammar allows structures of any depth. A single Wolvercote string
            can capture, for example, a <em>Klebsiella pneumoniae</em> chromosome carrying the
            <em>blaKPC-3</em> gene nested inside transposon Tn4401 inside the IncFII/IncR
            plasmid pKpQIL — exactly the arrangement seen in KPC-producing outbreak strains.
          </p>

          <h2>This tool</h2>
          <p>
            This web application lets you build and visualise Wolvercote strings interactively.
            Use the builder to add chromosomes, plasmids, and nested MGEs by clicking, or type
            the format string directly. You can also import a GenBank or GFF3 file to auto-generate
            a starting string from an existing assembly. The diagram preview updates live.
          </p>
          <p>
            Strings and SVG diagrams can be downloaded for use in presentations or manuscripts.
          </p>

          <h2>Team</h2>
          <p>
            Developed at the{' '}
            <a href="https://www.pathogensurveillance.net" target="_blank" rel="noreferrer">
              Centre for Genomic Pathogen Surveillance
            </a>
            , Pandemic Sciences Institute, University of Oxford — part of the WHO Collaborating
            Centre on Genomic Surveillance of AMR and the NIHR Global Health Research Unit.
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
