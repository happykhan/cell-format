import { useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { FileUpload, ThemeToggle } from '@genomicx/ui'
import { parseWolvercote } from './wolvercote/parser'
import { renderSVG } from './wolvercote/renderer'
import { parseGenBank, parseGFF, detectFileType } from './wolvercote/genbank'
import { InteractiveBuilder } from './components/InteractiveBuilder'
import './App.css'

declare const __APP_VERSION__: string

const EXAMPLES = [
  { label: 'Chr + plasmid', value: '()chr1,{}pBAD' },
  { label: 'Chr with integron', value: '({}integron)my_chr' },
  { label: 'Transposon + integron', value: '( {}transposon1 )chromosome , { {}transposon2, {}integron }plasmid' },
  { label: 'Two cells', value: '()chromosome1,{}plasmidA ; ()chromosome2,{}plasmidA' },
  { label: 'KPC in Tn4401 (pKpQIL)', value: '()chromosome, { { {}blaKPC-3[type="gene"] }Tn4401 }pKpQIL' },
  { label: 'OXA-48 in Tn1999', value: '()chromosome, { { {}blaOXA-48[type="gene"] }Tn1999 }pOXA-48a' },
  { label: 'CTX-M on ISEcp1', value: '()chromosome, { { {}blaCTX-M-15[type="gene"] }ISEcp1 }pCTX-M-3' },
  { label: 'Kp CAV1193 (real)', value: '()CAV1193, {}pCAV1193-166, {}pCAV1193-258, {}pCAV1193-78, { { {}blaKPC-3[type="gene"] }Tn4401 }pKPC_CAV1193' },
  { label: 'With attributes', value: '()chromosome, { {}blaKPC[type="gene"], {}ISEcp1[type="insertion_sequence"], {}intI[type="integron"] }pResistance' },
]

export default function App() {
  const [text, setText] = useState(EXAMPLES[0].value)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadError, setUploadError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [builderSyncVersion, setBuilderSyncVersion] = useState(0)
  const [copied, setCopied] = useState(false)
  const fromBuilder = useRef(false)

  const parsed = parseWolvercote(text)
  const svgOutput = parsed.ok ? renderSVG(parsed.value) : null

  const handleBuilderUpdate = useCallback((wolvStr: string) => {
    fromBuilder.current = true
    setText(wolvStr)
  }, [])

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    fromBuilder.current = false
    const val = e.target.value
    setText(val)
    const result = parseWolvercote(val)
    if (result.ok || val.trim() === '') setBuilderSyncVersion((v) => v + 1)
  }

  const loadExample = (value: string) => {
    fromBuilder.current = false
    setText(value)
    setBuilderSyncVersion((v) => v + 1)
  }

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
      fromBuilder.current = false
      setText(result.wolvercote)
      setBuilderSyncVersion((v) => v + 1)
      setShowImport(false)
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

  const downloadPNG = () => {
    if (!svgOutput) return
    const blob = new Blob([svgOutput], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth * 2   // 2× for retina
      canvas.height = img.naturalHeight * 2
      const ctx = canvas.getContext('2d')!
      ctx.scale(2, 2)
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, img.naturalWidth, img.naturalHeight)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      const pngUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = pngUrl
      a.download = 'wolvercote.png'
      a.click()
    }
    img.src = url
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

  const copyFormat = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
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
            <ThemeToggle />
            <Link to="/about" className="app-header-link-btn">About</Link>
            <a href="https://github.com/happykhan/cell-format" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {/* Examples bar */}
        <div className="examples-bar">
          {EXAMPLES.map((ex) => (
            <button key={ex.label} className="example-btn" onClick={() => loadExample(ex.value)}>
              {ex.label}
            </button>
          ))}
        </div>

        {/* Import toggle */}
        <div className="import-toggle-row">
          <button
            className="import-toggle-btn"
            onClick={() => setShowImport((v) => !v)}
          >
            {showImport ? '− Hide import' : '+ Import GenBank / GFF'}
          </button>
        </div>

        {showImport && (
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
          {/* Left: builder + live format string */}
          <div className="panel">
            <div className="panel-title">Interactive builder</div>
            <InteractiveBuilder
              onUpdate={handleBuilderUpdate}
              syncFrom={parsed.ok ? parsed.value : null}
              syncVersion={builderSyncVersion}
            />

            {/* Wolvercote format string — always visible, always editable */}
            <div className="format-preview">
              <div className="format-preview-header">
                <div className="format-preview-label">Wolvercote format</div>
                <button
                  className="copy-btn"
                  onClick={copyFormat}
                  disabled={!text}
                  title="Copy to clipboard"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <textarea
                className={`wolvercote-editor format-preview-textarea${!parsed.ok ? ' error' : ''}`}
                value={text}
                onChange={handleTextareaChange}
                spellCheck={false}
                placeholder="e.g. ()chr1,{}pBAD"
                rows={2}
              />
              {!parsed.ok && (
                <div className="validation-error">
                  {parsed.error.message}
                  {parsed.error.position > 0 && ` (at position ${parsed.error.position})`}
                </div>
              )}
            </div>

            <div className="actions">
              <button className="gx-btn gx-btn-secondary" onClick={downloadWolv} disabled={!text}>
                Download .txt
              </button>
              <button className="gx-btn gx-btn-secondary" onClick={downloadSVG} disabled={!svgOutput}>
                Download SVG
              </button>
              <button className="gx-btn gx-btn-primary" onClick={downloadPNG} disabled={!svgOutput}>
                Download PNG
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
