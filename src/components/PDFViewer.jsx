import { useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export default function PDFViewer({ doc }) {
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages)
    setPageNumber(1)
    setLoading(false)
  }, [])

  const onDocumentLoadError = useCallback((err) => {
    setError(err.message)
    setLoading(false)
  }, [])

  const prevPage = () => setPageNumber((p) => Math.max(1, p - 1))
  const nextPage = () => setPageNumber((p) => Math.min(numPages, p + 1))

  const handlePageInput = (e) => {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val) && val >= 1 && val <= numPages) {
      setPageNumber(val)
    }
  }

  if (error) {
    return (
      <div className="viewer-error">
        <p>❌ Failed to load PDF: {error}</p>
      </div>
    )
  }

  return (
    <div className="pdf-viewer">
      <div className="viewer-toolbar">
        <button className="btn-icon" onClick={prevPage} disabled={pageNumber <= 1}>
          ◀ Prev
        </button>
        <span className="page-info">
          Page{' '}
          <input
            type="number"
            value={pageNumber}
            min={1}
            max={numPages || 1}
            onChange={handlePageInput}
            className="page-input"
          />{' '}
          of {numPages || '—'}
        </span>
        <button className="btn-icon" onClick={nextPage} disabled={pageNumber >= numPages}>
          Next ▶
        </button>
        <div className="zoom-controls">
          <button className="btn-icon" onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}>−</button>
          <span className="zoom-label">{Math.round(scale * 100)}%</span>
          <button className="btn-icon" onClick={() => setScale((s) => Math.min(3, s + 0.1))}>+</button>
        </div>
      </div>

      <div className="pdf-container">
        {loading && <div className="loading-spinner">Loading PDF…</div>}
        <Document
          file={doc.path}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  )
}
