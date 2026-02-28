import { useState, useEffect } from 'react'

export default function TextViewer({ doc }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fontSize, setFontSize] = useState(18)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.electronAPI.readTextFile(doc.path).then((text) => {
      if (text === null) {
        setError('Failed to read file')
      } else {
        setContent(text)
      }
      setLoading(false)
    })
  }, [doc.path])

  if (loading) return <div className="loading-spinner">Loading…</div>
  if (error) return <div className="viewer-error"><p>❌ {error}</p></div>

  return (
    <div className="text-viewer">
      <div className="viewer-toolbar">
        <span>Font size:</span>
        <button className="btn-icon" onClick={() => setFontSize((s) => Math.max(12, s - 2))}>A−</button>
        <span className="zoom-label">{fontSize}px</span>
        <button className="btn-icon" onClick={() => setFontSize((s) => Math.min(32, s + 2))}>A+</button>
      </div>
      <div className="text-container">
        <pre className="text-content" style={{ fontSize: `${fontSize}px` }}>
          {content}
        </pre>
      </div>
    </div>
  )
}
