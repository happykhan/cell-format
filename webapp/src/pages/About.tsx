import { Link } from 'react-router-dom'
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
            <Link to="/" className="app-header-link-btn">← Back</Link>
            <a href="https://github.com/happykhan/cell-format" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
        </div>
      </header>

      <main className="app-main about-page">
        <div className="about-page-inner">
          <h1 className="about-page-title">About Wolvercote</h1>
          <p className="about-page-lead">
            A compact, human-readable notation for describing the organisation of bacterial genomes —
            chromosomes, plasmids, and nested mobile genetic elements — inspired by the Newick format
            for phylogenetic trees.
          </p>

          <h2>Format syntax</h2>
          <table className="about-table">
            <tbody>
              <tr><td><code>()label</code></td><td>Chromosome</td></tr>
              <tr><td><code>{'{}'}label</code></td><td>Plasmid / mobile genetic element</td></tr>
              <tr><td><code>({}Tn3)chr</code></td><td>Transposon on chromosome border</td></tr>
              <tr><td><code>{'{ {}blaKPC }plas'}</code></td><td>Resistance gene nested inside plasmid</td></tr>
              <tr><td><code>A , B</code></td><td>Two replicons in the same cell</td></tr>
              <tr><td><code>A ; B</code></td><td>Two separate cells</td></tr>
              <tr><td><code>[key="value"]</code></td><td>Attribute annotation on any element</td></tr>
            </tbody>
          </table>

          <h2>Authors</h2>
          <p>
            Developed at the{' '}
            <a href="https://www.pathogensurveillance.net" target="_blank" rel="noreferrer">
              Centre for Genomic Pathogen Surveillance
            </a>
            , University of Oxford.
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
