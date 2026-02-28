export default function Library({ library, onSelect, onAddFiles }) {
  if (library.length === 0) {
    return (
      <div className="library-empty">
        <div className="empty-icon">📖</div>
        <h2>Your library is empty</h2>
        <p>Add PDF or text documents to start reading</p>
        <button className="btn-primary btn-large" onClick={onAddFiles}>
          + Add Documents
        </button>
      </div>
    )
  }

  return (
    <div className="library">
      <div className="library-grid">
        {library.map((doc) => (
          <div key={doc.path} className="book-card" onClick={() => onSelect(doc)}>
            <div className="book-cover">
              <span className="book-icon">{doc.ext === 'pdf' ? '📄' : '📝'}</span>
              <span className="book-ext">{doc.ext.toUpperCase()}</span>
            </div>
            <div className="book-info">
              <p className="book-name" title={doc.name}>{doc.name}</p>
            </div>
          </div>
        ))}
        <div className="book-card book-card--add" onClick={onAddFiles}>
          <div className="book-cover book-cover--add">
            <span className="book-icon">+</span>
          </div>
          <div className="book-info">
            <p className="book-name">Add more</p>
          </div>
        </div>
      </div>
    </div>
  )
}
