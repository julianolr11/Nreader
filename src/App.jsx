import { useState } from 'react'
import Library from './components/Library'
import PDFViewer from './components/PDFViewer'
import TextViewer from './components/TextViewer'

export default function App() {
  const [library, setLibrary] = useState([])
  const [currentDoc, setCurrentDoc] = useState(null)
  const [darkMode, setDarkMode] = useState(true)

  const handleOpenFiles = async () => {
    const files = await window.electronAPI.openFileDialog()
    if (files.length > 0) {
      setLibrary((prev) => {
        const existing = new Set(prev.map((f) => f.path))
        const newFiles = files.filter((f) => !existing.has(f.path))
        return [...prev, ...newFiles]
      })
    }
  }

  const handleSelectDoc = (doc) => {
    setCurrentDoc(doc)
  }

  const handleBack = () => {
    setCurrentDoc(null)
  }

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      <header className="app-header">
        <div className="header-left">
          {currentDoc && (
            <button className="btn-icon" onClick={handleBack} title="Back to library">
              ← Library
            </button>
          )}
          <h1 className="app-title">📚 Nreader</h1>
        </div>
        <div className="header-right">
          {!currentDoc && (
            <button className="btn-primary" onClick={handleOpenFiles}>
              + Add Documents
            </button>
          )}
          {currentDoc && (
            <span className="doc-title">{currentDoc.name}</span>
          )}
          <button className="btn-icon" onClick={() => setDarkMode(!darkMode)} title="Toggle theme">
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="app-main">
        {!currentDoc ? (
          <Library
            library={library}
            onSelect={handleSelectDoc}
            onAddFiles={handleOpenFiles}
          />
        ) : currentDoc.ext === 'pdf' ? (
          <PDFViewer doc={currentDoc} />
        ) : (
          <TextViewer doc={currentDoc} />
        )}
      </main>
    </div>
  )
}
