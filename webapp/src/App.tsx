import { useState, useCallback } from 'react'
import { NavBar, AppFooter, FileUpload } from '@genomicx/ui'
import { parseWolvercote } from './wolvercote/parser'
import { renderSVG } from './wolvercote/renderer'
import { parseGenBank, parseGFF, detectFileType } from './wolvercote/genbank'
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

export default function App() {
  const [text, setText] = useState(EXAMPLES[0].value)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadError, setUploadError] = useState('')

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
      <NavBar
        appName="Wolvercote"
        appSubtitle="Bacterial Genome Organisation Visualiser"
        version={__APP_VERSION__}
        githubUrl="https://github.com/happykhan/cell-format"
      />

      <main className="app-main">
        {/* Examples */}
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

        {/* GenBank / GFF upload */}
        <div className="upload-row">
          <FileUpload
            files={uploadFiles}
            onFilesChange={handleFilesChange}
            label="Import GenBank or GFF3"
            accept=".gb,.gbk,.genbank,.gff,.gff3"
            multiple={false}
            hint="Upload a GenBank or GFF3 file to auto-generate the Wolvercote format"
          />
          {uploadError && <div className="validation-error">{uploadError}</div>}
        </div>

        <div className="editor-layout">
          {/* Left: editor */}
          <div className="panel">
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

      <AppFooter
        appName="Wolvercote"
        bugReportUrl="https://github.com/happykhan/cell-format/issues"
        bugReportEmail="nabil@happykhan.com"
      />
    </div>
  )
}
