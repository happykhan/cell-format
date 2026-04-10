import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { FileUpload } from '@genomicx/ui'
import { parseWolvercote } from './wolvercote/parser'
import { renderSVG } from './wolvercote/renderer'
import { parseGenBank, parseGFF, detectFileType } from './wolvercote/genbank'
import { InteractiveBuilder } from './components/InteractiveBuilder'
import './App.css'

declare const __APP_VERSION__: string

const EXAMPLES = [
  { label: 'Chr + plasmid', value: '()chr1,{}pBAD' },
  { label: 'Chr with integron', value: '({}integron)my_chr' },
  { label: 'Chr + plasmid (integrated)', value: '({}plasmid1)chromosome,{}plasmid1' },
  { label: 'Transposon + integron', value: '( {}transposon1 )chromosome , { {}transposon2, {}integron }plasmid' },
  { label: 'Two cells', value: '()chromosome1,{}plasmidA ; ()chromosome2,{}plasmidA' },
  { label: 'With attributes', value: '()chromosome[organism="E. coli", strain="K-12"]' },
]

type Tab = 'text' | 'builder' | 'import'

export default function App() {
  const [text, setText] = useState(EXAMPLES[0].value)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadError, setUploadError] = useState('')
  const [tab, setTab] = useState<Tab>('text')
  const [builderSyncVersion, setBuilderSyncVersion] = useState(0)

  const parsed = parseWolvercote(text)
  const svgOutput = parsed.ok ? renderSVG(parsed.value) : null

  const handleFilesChange = useCallback((files: File[]) => {
    setUploadFiles(files)
    const file = files[0]
    if (!file) return
    setUploadError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const type = detectFileType(file.name, content)
      if (type === 'unknown') {
        setUploadError('Unrecognised file type. Upload a GenBank (.gb, .gbk) or GFF3 (.gff, .gff3) file.')
        return
      }
      const result = type === 'genbank' ? parseGenBank(content) : parseGFF(content)
      if (!result.wolvercote) {
        setUploadError('No recognisable replicons found in this file. Check the file contains LOCUS records or ##sequence-region directives.')
        return
      }
      setText(result.wolvercote)
    }
    reader.readAsText(file)
  }, [])

  const downloadSVG = () => {
    if (!svgOutput) return
    const blob = new Blob([svgOutput], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wolvercote.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadWolv = () => {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wolvercote.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

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
              <span className="app-header-name">Wolvercote</span>
              <span className="app-header-sub">Bacterial Genome Organisation Visualiser</span>
            </div>
          </div>
          <nav className="app-header-nav">
            <span className="app-header-version">v{__APP_VERSION__}</span>
            <Link to="/about" className="app-header-link-btn">About</Link>
            <a href="https://github.com/happykhan/cell-format" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn${tab === 'text' ? ' active' : ''}`} onClick={() => setTab('text')}>
            Text editor
          </button>
          <button
            className={`tab-btn${tab === 'builder' ? ' active' : ''}`}
            onClick={() => {
              if (tab !== 'builder' && parsed.ok) setBuilderSyncVersion((v) => v + 1)
              setTab('builder')
            }}
          >
            Interactive builder
          </button>
          <button className={`tab-btn${tab === 'import' ? ' active' : ''}`} onClick={() => setTab('import')}>
            Import GenBank / GFF
          </button>
        </div>

        {/* Examples (shown for text tab) */}
        {tab === 'text' && (
          <div className="examples-bar">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                className="example-btn"
                onClick={() => setText(ex.value)}
              >
                {ex.label}
              </button>
            ))}
          </div>
        )}

        {/* GenBank / GFF upload */}
        {tab === 'import' && (
          <div className="upload-row">
            <FileUpload
              files={uploadFiles}
              onFilesChange={handleFilesChange}
              label="Import GenBank or GFF3"
              accept=".gb,.gbk,.genbank,.gff,.gff3"
              multiple={false}
              hint="Upload a GenBank or GFF3 file to auto-generate the Wolvercote format string"
            />
            {uploadError && <div className="validation-error">{uploadError}</div>}
          </div>
        )}

        <div className="editor-layout">
          {/* Left: editor or builder */}
          <div className="panel">
            {tab === 'builder' ? (
              <>
                <div className="panel-title">Interactive builder</div>
                <InteractiveBuilder
                onUpdate={setText}
                syncFrom={parsed.ok ? parsed.value : null}
                syncVersion={builderSyncVersion}
              />
              </>
            ) : (
              <>
                <div className="panel-title">Wolvercote format</div>
                <textarea
                  className={`wolvercote-editor${!parsed.ok ? ' error' : ''}`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  spellCheck={false}
                  placeholder="Enter Wolvercote format string, e.g. ()chr1,{}pBAD"
                />
                {!parsed.ok && (
                  <div className="validation-error">
                    {parsed.error.message}
                    {parsed.error.position > 0 && ` (at position ${parsed.error.position})`}
                  </div>
                )}
              </>
            )}
            <div className="actions">
              <button className="gx-btn gx-btn-secondary" onClick={downloadWolv} disabled={!text}>
                Download .txt
              </button>
              <button className="gx-btn gx-btn-primary" onClick={downloadSVG} disabled={!svgOutput}>
                Download SVG
              </button>
            </div>
          </div>

          {/* Right: SVG preview */}
          <div className="panel">
            <div className="panel-title">Diagram preview</div>
            <div className="svg-viewer">
              {svgOutput ? (
                <div dangerouslySetInnerHTML={{ __html: svgOutput }} />
              ) : (
                <span style={{ color: 'var(--gx-text-muted)', fontSize: '0.9rem' }}>
                  Fix the format error to see the diagram
                </span>
              )}
            </div>
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
