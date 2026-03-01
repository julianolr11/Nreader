import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import * as pdfjsLib from 'pdfjs-dist'

// Polyfill para Promise.withResolvers (Node < 22)
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

// Use local worker wrapper (adds polyfill and imports the real worker)
const workerSrc =
  typeof window !== 'undefined' && window.location?.protocol === 'file:'
    ? './pdf-worker-wrapper.js'
    : '/pdf-worker-wrapper.js'
GlobalWorkerOptions.workerSrc = workerSrc

// Traduções
const translations = {
  pt: {
    backToHome: '← Voltar ao início',
    viewLibrary: '📚 Ver estante',
    addBook: 'Adicionar livro',
    opening: 'Abrindo...',
    dragOrClick: 'Arraste ou clique',
    theme: 'Tema',
    light: 'Claro',
    dark: 'Escuro',
    font: 'Fonte',
    recentBooks: '📖 Últimos Lidos',
    settings: '⚙️ Configurações',
    myLibrary: 'Minha Estante',
    searchPlaceholder: 'Buscar por título ou categoria...',
    sortByCategory: 'Ordenar por Categoria',
    sortAlphabetical: 'Ordenar Alfabética',
    sortByReading: 'Ordenar por Leitura',
    sortByRecent: 'Adicionados Recentemente',
    finish: 'Finalizar',
    ratingModalTitle: 'Avalie essa leitura',
    noBookFoundNoCategory: 'Sem categoria',
    new: 'Novo',
    addedAt: 'Adicionado em',
    lastRead: 'Última vez lido:',
    neverRead: 'Nunca lido',
    noBookFound: 'Nenhum livro encontrado',
    noBookInLibrary: 'Nenhum livro na estante ainda',
    noCategory: 'Sem Categoria',
    addToLibrary: 'Adicionar à Estante',
    file: 'Arquivo',
    title: 'Título',
    category: 'Categoria',
    selectCategory: 'Selecione...',
    addNewCategory: '+ Adicionar nova',
    categoryName: 'Nome da categoria',
    bookName: 'Nome do livro',
    save: 'Salvar',
    cancel: 'Cancelar',
    continueReading: 'Continuar Leitura',
    readFromStart: 'Ler do Início',
    close: 'Fechar',
    readingProgress: 'Progresso de Leitura',
    rating: 'Avaliação',
    previous: 'Anterior',
    next: 'Próxima',
    rateReading: 'Avalie essa leitura:',
    loadingFile: 'Carregando arquivo...',
    dragBookHere: 'Arraste para cá seu livro',
    supportedFormats: 'Formatos aceitos: TXT, MD, PDF',
    settingsTitle: '⚙️ Configurações',
    interfaceLanguage: 'Idioma da Interface',
    portuguese: 'Português',
    english: 'English',
    saveChanges: 'Salvar Alterações',
    completed: '% concluído',
    deleteCategory: 'Deseja excluir essa categoria?',
    yes: 'Sim',
    no: 'Não'
  },
  en: {
    backToHome: '← Back to home',
    viewLibrary: '📚 View library',
    addBook: 'Add book',
    opening: 'Opening...',
    dragOrClick: 'Drag or click',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    font: 'Font',
    recentBooks: '📖 Recent Books',
    settings: '⚙️ Settings',
    myLibrary: 'My Library',
    searchPlaceholder: 'Search by title or category...',
    sortByCategory: 'Sort by Category',
    sortAlphabetical: 'Sort Alphabetically',
    sortByReading: 'Sort by Reading',
    sortByRecent: 'Recently Added',
    finish: 'Finish',
    ratingModalTitle: 'Rate this reading',
    noBookFoundNoCategory: 'No category',
    new: 'New',
    addedAt: 'Added on',
    lastRead: 'Last read:',
    neverRead: 'Never read',
    noBookFound: 'No book found',
    noBookInLibrary: 'No books in library yet',
    noCategory: 'No Category',
    addToLibrary: 'Add to Library',
    file: 'File',
    title: 'Title',
    category: 'Category',
    selectCategory: 'Select...',
    addNewCategory: '+ Add new',
    categoryName: 'Category name',
    bookName: 'Book name',
    save: 'Save',
    cancel: 'Cancel',
    continueReading: 'Continue Reading',
    readFromStart: 'Read from Start',
    close: 'Close',
    readingProgress: 'Reading Progress',
    rating: 'Rating',
    previous: 'Previous',
    next: 'Next',
    rateReading: 'Rate this reading:',
    loadingFile: 'Loading file...',
    dragBookHere: 'Drag your book here',
    supportedFormats: 'Supported formats: TXT, MD, PDF',
    settingsTitle: '⚙️ Settings',
    interfaceLanguage: 'Interface Language',
    portuguese: 'Português',
    english: 'English',
    saveChanges: 'Save Changes',
    completed: '% completed',
    deleteCategory: 'Do you want to delete this category?',
    yes: 'Yes',
    no: 'No'
  }
}

const STORAGE_KEY = 'nreader.v1.state'
const CATEGORIES_STORAGE_KEY = 'nreader.v1.categories'
const DEFAULT_CATEGORIES = {
  pt: [
    'Ficção',
    'Não-ficção',
    'Técnico',
    'Biografia',
    'Romance',
    'Fantasia',
    'Autoajuda',
    'História',
    'Ciência'
  ],
  en: [
    'Fiction',
    'Non-fiction',
    'Technical',
    'Biography',
    'Romance',
    'Fantasy',
    'Self-help',
    'History',
    'Science'
  ]
}
const VIEW_TRANSITION_DURATION = 220

const loadState = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

const saveState = (nextState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
}

const chunkText = (text, chunkSize) => {
  if (!text) return ['']
  const chunks = []
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize))
  }
  return chunks
}

const isMarkdownFile = (filePath) => {
  return filePath?.toLowerCase().endsWith('.md') ?? false
}

function PdfPage({ base64Content, pageNum, fontScale = 1 }) {
  const canvasRef = useRef(null)
  const renderTaskRef = useRef(null)
  const abortControllerRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const containerRef = useRef(null)

  useEffect(() => {
    // Cancelar qualquer operação anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    const renderPdfPage = async () => {
      if (!canvasRef.current || signal.aborted) return

      // Cancelar renderização anterior se estiver em progresso
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch (e) {
          // Ignorar erro ao cancelar
        }
        renderTaskRef.current = null
      }

      try {
        const binaryString = atob(base64Content)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        if (signal.aborted) return

        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
        
        if (signal.aborted) return

        const page = await pdf.getPage(pageNum)
        const renderScale = Math.max(0.8, Math.min(4, 2 * fontScale))
        const viewport = page.getViewport({ scale: renderScale })

        if (signal.aborted) return

        // Limpar canvas antes de renderizar
        canvasRef.current.width = viewport.width
        canvasRef.current.height = viewport.height

        const context = canvasRef.current.getContext('2d')
        renderTaskRef.current = page.render({
          canvasContext: context,
          viewport: viewport
        })
        
        await renderTaskRef.current.promise
        renderTaskRef.current = null
      } catch (err) {
        if (err.name !== 'RenderingCancelledError' && !signal.aborted) {
          console.error('Erro ao renderizar PDF:', err)
        }
        renderTaskRef.current = null
      }
    }

    renderPdfPage()

    // Limpeza: cancelar renderização ao desmontar ou quando props mudam
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch (e) {
          // Ignorar erro ao cancelar
        }
        renderTaskRef.current = null
      }
    }
  }, [base64Content, pageNum, fontScale])

  // Zoom com mouse wheel
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        setZoom(prev => {
          const next = prev * delta
          return Math.max(0.5, Math.min(next, 3))
        })
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pageNum])

  return (
    <div
      className="pdf-scroll"
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start' }}
    >
      <canvas
        ref={canvasRef}
        style={{ maxWidth: '100%', height: 'auto', display: 'block', transform: `scale(${zoom})`, transformOrigin: 'top left' }}
      />
    </div>
  )
}

// Categorias pré-definidas
const CATEGORIES = [
  'Ficção',
  'Não-ficção',
  'Técnico',
  'Biografia',
  'Romance',
  'Fantasia',
  'Autoajuda',
  'História',
  'Ciência'
]

// Componente StarRating reutilizável
function StarRating({ value, onChange }) {
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          className={`star ${star <= value ? 'filled' : 'empty'}`}
          onClick={() => onChange(star)}
          type="button"
        >
          {star <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}

// Componente Modal de Configurações
function SettingsModal({ isOpen, onClose, language, onLanguageChange }) {
  const t = translations[language] || translations.pt
  
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>{t.settingsTitle}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="settings-content">
          <div className="settings-section">
            <label>{t.interfaceLanguage}</label>
            <select value={language} onChange={(e) => onLanguageChange(e.target.value)} className="settings-select">
              <option value="pt">{t.portuguese}</option>
              <option value="en">{t.english}</option>
            </select>
          </div>
        </div>

        <div className="settings-footer">
          <button onClick={onClose} className="action-btn primary">
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}

// Componente Modal
function BookModal({ isOpen, onClose, onSave, initialData, categories = [], onAddCategory = () => {}, language = 'pt' }) {
  const t = translations[language] || translations.pt
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [coverImage, setCoverImage] = useState(null)

  // Reset form when modal opens with new data
  useEffect(() => {
    if (isOpen && initialData) {
      setTitle(initialData.title || '')
      setCategory('')
      setCustomCategory('')
      setCoverImage(null)
    }
  }, [isOpen, initialData])

  const handleSave = () => {
    const finalCategory = category === 'custom' ? customCategory.trim() : category
    if (category === 'custom' && finalCategory) {
      onAddCategory(finalCategory)
    }
    onSave({ title, category: finalCategory, coverImage })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="book-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <button className="modal-close" onClick={onClose}>✕</button>
          
          {/* Esquerda - Capa */}
          <div className="modal-left">
            <div className="cover-container">
              <div className="cover-upload-section">
                {coverImage ? (
                  <img src={coverImage} alt="Capa" className="cover-image" />
                ) : (
                  <div className="cover-placeholder">
                    {initialData?.extension?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="cover-overlay">
                  <label className="cover-edit-btn">
                    📁 Fazer upload
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = (event) => setCoverImage(event.target?.result)
                          reader.readAsDataURL(file)
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Direita - Informações */}
          <div className="modal-right">
            <div className="book-info">
              <h2 className="add-book-title">{t.addToLibrary}</h2>

              <div className="book-field">
                <label>{t.file}</label>
                <div className="field-value file-name">{initialData?.fileName}</div>
              </div>

              <div className="book-field">
                <label>{t.title}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t.bookName}
                  className="book-input"
                />
              </div>

              <div className="book-field">
                <label>{t.category}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="book-select"
                >
                  <option value="">{t.selectCategory}</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="custom">{t.addNewCategory}</option>
                </select>
                {category === 'custom' && (
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder={t.categoryName}
                    className="book-input"
                  />
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={handleSave} className="action-btn primary">
                {t.save}
              </button>
              <button onClick={onClose} className="action-btn secondary">
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Componente de Modal de Preview do Livro
function BookPreviewModal({ book, recentBooks = [], onClose, onContinueReading, onRefresh, categories = [], onAddCategory, language = 'pt' }) {
  const t = translations[language] || translations.pt
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(book?.title || '')
  const [editCategory, setEditCategory] = useState(book?.category || '')
  const [customCategoryInput, setCustomCategoryInput] = useState('')
  const [rating, setRating] = useState(book?.rating || 0)
  const [coverFile, setCoverFile] = useState(null)
  const [isUploadingCover, setIsUploadingCover] = useState(false)

  // Sincronizar estados quando o book mudar
  useEffect(() => {
    if (book) {
      setEditTitle(book.title || '')
      setEditCategory(book.category || '')
      setCustomCategoryInput('')
      setRating(book.rating || 0)
    }
  }, [book])

  const handleSaveChanges = async () => {
    let finalCategory = editCategory
    
    // Se selecionou "custom" e digitou algo, usa o valor customizado
    if (editCategory === 'custom' && customCategoryInput.trim()) {
      finalCategory = customCategoryInput.trim()
      // Adicionar a nova categoria à lista
      if (!categories.includes(finalCategory)) {
        onAddCategory?.(finalCategory)
      }
    }
    
    if (book && (editTitle !== book.title || finalCategory !== book.category)) {
      await window.nreader?.saveToLibrary?.({
        ...book,
        title: editTitle,
        category: finalCategory || null
      })
      setIsEditing(false)
      setCustomCategoryInput('')
      onRefresh?.()
    } else {
      setIsEditing(false)
      setCustomCategoryInput('')
    }
  }

  const progress = recentBooks.find(
    (item) => item.libraryId === book?.id || item.filePath === book?.fileName || item.title === book?.title
  )
  const percentage = progress?.percentage ?? 0
  const isCompleted = percentage >= 100

  const handleRatingChange = async (newRating) => {
    setRating(newRating)
    if (book) {
      await window.nreader?.saveToLibrary?.({
        ...book,
        rating: newRating
      })
      onRefresh?.()
    }
  }

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0]
    if (file && book) {
      setIsUploadingCover(true)
      const reader = new FileReader()
      reader.onload = async (event) => {
        const base64 = event.target?.result
        await window.nreader?.saveToLibrary?.({
          ...book,
          coverImage: base64
        })
        onRefresh?.()
        setIsUploadingCover(false)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="book-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <button className="modal-close" onClick={onClose}>✕</button>
          
          {/* Esquerda - Capa */}
          <div className="modal-left">
            <div className="cover-container">
              {book?.coverImage ? (
                <img src={book.coverImage} alt={book?.title} className="cover-image" />
              ) : (
                <div className="cover-placeholder">
                  {book?.extension?.toUpperCase().slice(1) || '?'}
                </div>
              )}
              <div className="cover-overlay">
                <label className="cover-edit-btn">
                  ✎ Editar capa
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    disabled={isUploadingCover}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Direita - Informações */}
          <div className="modal-right">
            <div className="book-info">
              <div className="book-field">
                <label>{t.title}</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="edit-input"
                  />
                ) : (
                  <div className="field-value">
                    <h2>{book?.title}</h2>
                    <button onClick={() => setIsEditing(true)} className="edit-icon-btn">
                      ✎
                    </button>
                  </div>
                )}
              </div>

              <div className="book-field">
                <label>{t.category}</label>
                {isEditing ? (
                  <>
                    <select
                      value={editCategory}
                      onChange={(e) => {
                        setEditCategory(e.target.value)
                        setCustomCategoryInput('')
                      }}
                      className="book-select"
                    >
                      <option value="">{t.selectCategory}</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="custom">{t.addNewCategory}</option>
                    </select>
                    {editCategory === 'custom' && (
                      <input
                        type="text"
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        placeholder={t.categoryName}
                        className="book-input"
                        style={{ marginTop: '8px' }}
                      />
                    )}
                  </>
                ) : (
                  <div className="field-value">
                    <p>{book?.category || t.noCategory}</p>
                    <button onClick={() => setIsEditing(true)} className="edit-icon-btn">
                      ✎
                    </button>
                  </div>
                )}
              </div>

              <div className="book-field">
                <label>{t.readingProgress}</label>
                <div className="progress-display">{percentage}%</div>
              </div>

              <div className="book-field">
                <label>{t.rating}</label>
                <StarRating value={rating} onChange={handleRatingChange} />
              </div>

              <div className="book-field">
                <label>{t.addedAt}</label>
                <p className="field-value-text">{new Date(book?.addedAt).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US')}</p>
              </div>

              <div className="book-field">
                <label>{t.lastRead}</label>
                <p className="field-value-text">
                  {progress?.lastAccessed
                    ? new Date(progress.lastAccessed).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US')
                    : t.neverRead}
                </p>
              </div>

              {isEditing && (
                <button onClick={handleSaveChanges} className="save-btn">
                  {t.saveChanges}
                </button>
              )}
            </div>

            <div className="modal-actions">
              <div className="action-buttons">
                <button
                  onClick={() => {
                    onClose()
                    onContinueReading?.()
                  }}
                  className="action-btn primary"
                >
                  {isCompleted ? t.readFromStart : t.continueReading}
                </button>
                <button onClick={onClose} className="action-btn secondary">
                  {t.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Componente Estante
function Library({ onOpenBook, onBack, recentBooks = [], categories = [], language = 'pt', refreshKey = 0 }) {
  const t = translations[language] || translations.pt
  const [books, setBooks] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('categoria')
  const [selectedBook, setSelectedBook] = useState(null)
  const [categoryToDelete, setCategoryToDelete] = useState(null)

  useEffect(() => {
    loadBooks()
  }, [refreshKey])

  const loadBooks = async () => {
    const libraryBooks = await window.nreader?.listLibrary?.()
    setBooks(libraryBooks || [])
  }

  // Verificar se livro foi adicionado há menos de 3 dias
  const isNewBook = (addedAt) => {
    if (!addedAt) return false
    const now = Date.now()
    const added = new Date(addedAt).getTime()
    const daysDiff = (now - added) / (1000 * 60 * 60 * 24)
    return daysDiff < 3
  }

  const handleDeleteCategory = async (categoryName) => {
    setCategoryToDelete(categoryName)
  }

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return
    
    // Atualizar todos os livros dessa categoria para null (sem categoria)
    const booksToUpdate = books.filter(book => book.category === categoryToDelete)
    
    for (const book of booksToUpdate) {
      await window.nreader?.saveToLibrary?.({
        id: book.id,
        category: null
      })
    }
    
    // Remover apenas se for uma categoria customizada
    const defaultCats = DEFAULT_CATEGORIES.pt.concat(DEFAULT_CATEGORIES.en)
    if (!defaultCats.includes(categoryToDelete)) {
      const updatedCustom = customCategories.filter(cat => cat !== categoryToDelete)
      setCustomCategories(updatedCustom)
    }
    
    // Recarregar os livros
    await loadBooks()
    setCategoryToDelete(null)
  }

  const handleBookClick = (book) => {
    setSelectedBook(book)
  }

  const handleOpenBook = async () => {
    if (selectedBook) {
      const bookData = await window.nreader?.openFromLibrary?.(selectedBook.id)
      if (bookData) {
        onOpenBook(bookData)
      }
      setSelectedBook(null)
    }
  }

  // Filtrar livros por termo de busca
  const filteredBooks = books.filter((book) => {
    const search = searchTerm.toLowerCase()
    return (
      book.title.toLowerCase().includes(search) ||
      (book.category && book.category.toLowerCase().includes(search))
    )
  })

  // Ordenar livros
  const sortedBooks = [...filteredBooks].sort((a, b) => {
    if (sortBy === 'alfabetica') {
      return a.title.localeCompare(b.title)
    } else if (sortBy === 'leitura') {
      const progressA = recentBooks.find(
        (item) => item.libraryId === a.id || item.filePath === a.fileName || item.title === a.title
      )?.percentage ?? 0
      const progressB = recentBooks.find(
        (item) => item.libraryId === b.id || item.filePath === b.fileName || item.title === b.title
      )?.percentage ?? 0
      return progressB - progressA
    } else if (sortBy === 'recente') {
      // recentemente adicionados (mais novos primeiro)
      const dateA = new Date(a.addedAt || 0).getTime()
      const dateB = new Date(b.addedAt || 0).getTime()
      return dateB - dateA
    } else {
      // categoria
      const catA = a.category || ''
      const catB = b.category || ''
      if (catA !== catB) {
        return catA.localeCompare(catB)
      }
      return a.title.localeCompare(b.title)
    }
  })

  return (
    <div className="library">
      <header className="library-header">
        <button onClick={onBack}>← {language === 'en' ? 'Back' : 'Voltar'}</button>
        <h2>{t.myLibrary}</h2>
      </header>

      <div className="library-controls">
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          className="search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="sort-dropdown"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="categoria">{t.sortByCategory}</option>
          <option value="alfabetica">{t.sortAlphabetical}</option>
          <option value="leitura">{t.sortByReading}</option>
          <option value="recente">{t.sortByRecent}</option>
        </select>
      </div>
      
      <div className="books-grid">
        {sortedBooks.length === 0 ? (
          <p className="muted">{searchTerm ? t.noBookFound : t.noBookInLibrary}</p>
        ) : sortBy === 'categoria' ? (
          // Renderizar por categoria com divisores
          (() => {
            const categories = {}
            sortedBooks.forEach((book) => {
              const cat = book.category || t.noCategory
              if (!categories[cat]) categories[cat] = []
              categories[cat].push(book)
            })

            const defaultCategoriesList = [...DEFAULT_CATEGORIES.pt, ...DEFAULT_CATEGORIES.en]
            const isCustomCategory = (cat) => {
              return cat !== t.noCategory && !defaultCategoriesList.includes(cat)
            }

            // Ordenar categorias para que "Sem categoria" apareça no final
            const sortedCategories = Object.keys(categories).sort((a, b) => {
              if (a === t.noCategory) return 1  // "Sem categoria" vai para o final
              if (b === t.noCategory) return -1
              return a.localeCompare(b)  // Outros em ordem alfabética
            })

            return sortedCategories.map((category) => (
              <div key={category} className="category-group">
                <div className="category-header">
                  <h3 className="category-title">{category}</h3>
                  {isCustomCategory(category) && (
                    <button 
                      className="delete-category-btn" 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteCategory(category)
                      }}
                      title={language === 'en' ? 'Delete category' : 'Excluir categoria'}
                    >
                      🗑️
                    </button>
                  )}
                </div>
                <hr className="category-divider" />
                <div className="category-books">
                  {categories[category].map((book) => {
                    const progress = recentBooks.find(
                      (item) => item.libraryId === book.id || item.filePath === book.fileName || item.title === book.title
                    )
                    const isCompleted = (progress?.percentage ?? 0) >= 100

                    return (
                      <div
                        key={book.id}
                        className={`book-card ${isCompleted ? 'completed' : ''}`}
                        onClick={() => handleBookClick(book)}
                      >
                        {book.coverImage ? (
                          <img src={book.coverImage} alt={book.title} className="book-cover" />
                        ) : (
                          <div className="book-cover-placeholder">
                            {book.extension?.toUpperCase().slice(1) || '?'}
                          </div>
                        )}
                        {isCompleted && <span className="completion-check">✓</span>}
                        {isNewBook(book.addedAt) && <span className="new-badge">{t.new}</span>}
                        <div className="book-title-with-progress">
                          <h3 className="truncate">{book.title}</h3>
                          <span className="book-progress">{progress?.percentage ?? 0}%</span>
                        </div>
                        <p className="muted small truncate">{book.category}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          })()
        ) : (
          // Renderizar normal para outras ordenações
          sortedBooks.map((book) => {
            const progress = recentBooks.find(
              (item) => item.libraryId === book.id || item.filePath === book.fileName || item.title === book.title
            )
            const isCompleted = (progress?.percentage ?? 0) >= 100

            return (
              <div
                key={book.id}
                className={`book-card ${isCompleted ? 'completed' : ''}`}
                onClick={() => handleBookClick(book)}
              >
                {book.coverImage ? (
                  <img src={book.coverImage} alt={book.title} className="book-cover" />
                ) : (
                  <div className="book-cover-placeholder">
                    {book.extension?.toUpperCase().slice(1) || '?'}
                  </div>
                )}
                {isCompleted && <span className="completion-check">✓</span>}
                {isNewBook(book.addedAt) && <span className="new-badge">{t.new}</span>}
                <div className="book-title-with-progress">
                  <h3 className="truncate">{book.title}</h3>
                  <span className="book-progress">{progress?.percentage ?? 0}%</span>
                </div>
                <p className="muted small truncate">{book.category}</p>
              </div>
            )
          })
        )}
      </div>

      {selectedBook && (
        <BookPreviewModal
          book={selectedBook}
          recentBooks={recentBooks}
          onClose={() => setSelectedBook(null)}
          onContinueReading={handleOpenBook}
          onRefresh={loadBooks}
          categories={categories}
          onAddCategory={(newCategory) => {
            if (!categories.includes(newCategory) && !customCategories.includes(newCategory)) {
              setCustomCategories([...customCategories, newCategory])
            }
          }}
          language={language}
        />
      )}

      {categoryToDelete && (
        <div className="modal-overlay" onClick={() => setCategoryToDelete(null)}>
          <div className="delete-category-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t.deleteCategory}</h3>
            <div className="delete-category-actions">
              <button onClick={confirmDeleteCategory} className="action-btn primary">
                {t.yes}
              </button>
              <button onClick={() => setCategoryToDelete(null)} className="action-btn secondary">
                {t.no}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const appName = window.nreader?.getAppName?.() ?? 'Nreader'
  const initial = loadState()

  const [theme, setTheme] = useState(initial.theme ?? 'light')
  const [fontSize, setFontSize] = useState(initial.fontSize ?? 20)
  const [book, setBook] = useState(initial.book ?? null)
  const [currentPage, setCurrentPage] = useState(initial.currentPage ?? 0)
  const [isOpening, setIsOpening] = useState(false)
  const [libraryRefresh, setLibraryRefresh] = useState(0)
  const [isMarkdown, setIsMarkdown] = useState(false)
  const [pdfPageCount, setPdfPageCount] = useState(1)
  const [recentBooks, setRecentBooks] = useState(initial.recentBooks ?? [])
  const [language, setLanguage] = useState(initial.language ?? 'pt')
  const [customCategories, setCustomCategories] = useState(() => {
    try {
      const saved = localStorage.getItem(CATEGORIES_STORAGE_KEY)
      if (!saved) return []
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  // Categories é calculado dinamicamente (padrão + customizadas)
  const categories = useMemo(() => {
    const defaultCats = DEFAULT_CATEGORIES[language]
    return [...defaultCats, ...customCategories.filter(cat => !defaultCats.includes(cat))]
  }, [language, customCategories])
  
  // Novos estados
  const [view, setView] = useState('home') // 'home' | 'reader' | 'library'
  const [viewTransitionClass, setViewTransitionClass] = useState('view-fade-in')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingAddBook, setIsDraggingAddBook] = useState(false)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [isSplashVisible, setIsSplashVisible] = useState(false)
  const [isSplashFading, setIsSplashFading] = useState(false)
  const [currentBookRating, setCurrentBookRating] = useState(0)
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const viewTransitionTimerRef = useRef(null)
  const pageRef = useRef(null)
  
  const t = translations[language] || translations.pt

  const changeView = useCallback((nextView, onAfterChange) => {
    if (nextView === view) {
      onAfterChange?.()
      return
    }

    setViewTransitionClass('view-fade-out')

    if (viewTransitionTimerRef.current) {
      clearTimeout(viewTransitionTimerRef.current)
    }

    viewTransitionTimerRef.current = setTimeout(() => {
      setView(nextView)
      setViewTransitionClass('view-fade-in')
      onAfterChange?.()
    }, VIEW_TRANSITION_DURATION)
  }, [view])

  const chunkSize = useMemo(() => {
    const base = 2500
    return Math.max(1200, Math.floor(base - (fontSize - 20) * 60))
  }, [fontSize])

  useEffect(() => {
    if (book?.isPdf && book?.content) {
      const detectPages = async () => {
        try {
          const binaryString = atob(book.content)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
          setPdfPageCount(pdf.numPages)
        } catch (err) {
          console.error('Erro ao contar páginas do PDF:', err)
          setPdfPageCount(1)
        }
      }
      detectPages()
    }
  }, [book?.isPdf, book?.content])

  useEffect(() => {
    return () => {
      if (viewTransitionTimerRef.current) {
        clearTimeout(viewTransitionTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const fadeInTimer = setTimeout(() => {
      setIsSplashVisible(true)
    }, 40)

    const startFadeTimer = setTimeout(() => {
      setIsSplashFading(true)
    }, 3000)

    const hideTimer = setTimeout(() => {
      setShowSplash(false)
    }, 3650)

    return () => {
      clearTimeout(fadeInTimer)
      clearTimeout(startFadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(customCategories))
  }, [customCategories])

  // Traduzir categorias padrão quando o idioma muda
  const handleAddCategory = useCallback((newCategory) => {
    const normalized = (newCategory || '').trim()
    if (!normalized) return
    setCustomCategories((prev) => {
      const defaultCats = DEFAULT_CATEGORIES.pt.concat(DEFAULT_CATEGORIES.en)
      // Não adicionar se já existe (padrão ou customizada)
      if (defaultCats.includes(normalized) || prev.some((categoryItem) => categoryItem.toLowerCase() === normalized.toLowerCase())) {
        return prev
      }
      return [...prev, normalized]
    })
  }, [])

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage)
    persist({ language: newLanguage })
  }

  // Sincronizar rating do livro atual
  useEffect(() => {
    if (book?.rating !== undefined) {
      setCurrentBookRating(book.rating)
    }
  }, [book])

  const pages = useMemo(() => {
    if (book?.isPdf) {
      return Array(pdfPageCount).fill(null)
    }
    if (isMarkdown) {
      return [book?.content ?? '']
    }
    // Apenas textos comuns dividem em páginas
    return chunkText(book?.content ?? '', chunkSize)
  }, [book?.content, book?.isPdf, chunkSize, pdfPageCount, isMarkdown])
  const pageCount = pages.length
  const safePage = Math.min(Math.max(currentPage, 0), pageCount - 1)

  const updateRecentBooks = useCallback((bookData, page, totalPages) => {
    const currentPageNumber = totalPages > 0 ? Math.min(Math.max(page + 1, 1), totalPages) : 0
    const percentage = totalPages > 0 ? Math.round((currentPageNumber / totalPages) * 100) : 0
    
    const recentBook = {
      title: bookData.title,
      filePath: bookData.filePath,
      libraryId: bookData.libraryId ?? bookData.id ?? null,
      lastPage: page,
      totalPages: totalPages,
      percentage: percentage,
      lastAccessed: Date.now(),
      isPdf: bookData.isPdf
    }

    setRecentBooks(prevBooks => {
      const filtered = prevBooks.filter(b => {
        if (recentBook.libraryId) {
          return b.libraryId !== recentBook.libraryId
        }
        return b.filePath !== bookData.filePath
      })
      const updated = [recentBook, ...filtered].slice(0, 5)
      // Persistir imediatamente
      saveState({
        theme,
        fontSize,
        book,
        currentPage: page,
        recentBooks: updated
      })
      return updated
    })
  }, [theme, fontSize, book])

  // Atualizar histórico após book estar pronto
  useEffect(() => {
    if (book && pageCount > 0 && view === 'reader') {
      // Delay para garantir que tudo está carregado
      const timer = setTimeout(() => {
        updateRecentBooks(book, currentPage, pageCount)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [book?.filePath, updateRecentBooks])

  // Monitora Esc para sair do fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen])

  const persist = (override = {}) => {
    const newState = {
      theme,
      fontSize,
      book,
      currentPage,
      recentBooks,
      language,
      ...override
    }
    saveState(newState)
  }

  const openBook = async () => {
    try {
      setIsOpening(true)
      const result = await window.nreader?.openBook?.()
      if (!result || result.canceled) return

      const isMd = isMarkdownFile(result.filePath)
      const isPdf = result.isPdf ?? false

      const nextBook = {
        title: result.title,
        filePath: result.filePath,
        content: result.content,
        isPdf
      }

      setBook(nextBook)
      setIsMarkdown(isMd && !isPdf)
      setCurrentPage(0)
      changeView('reader')
      persist({ book: nextBook, currentPage: 0 })
    } finally {
      setIsOpening(false)
    }
  }

  const openBookForLibrary = async () => {
    try {
      setIsOpening(true)
      const result = await window.nreader?.openBook?.()
      if (!result || result.canceled) return

      setIsLoadingFile(true)
      setIsOpening(false)
      
      // Simula processamento do arquivo
      await new Promise(resolve => setTimeout(resolve, 800))

      const fileName = result.filePath.split(/[\\/]/).pop()
      const ext = fileName.split('.').pop().toLowerCase()

      setPendingFile({
        filePath: result.filePath,
        fileName: fileName,
        title: result.title || fileName.replace(/\.[^/.]+$/, ''),
        extension: `.${ext}`
      })
      
      setIsLoadingFile(false)
      setIsModalOpen(true)
    } catch (err) {
      console.error('Erro ao abrir arquivo:', err)
      setIsLoadingFile(false)
      setIsOpening(false)
    }
  }

  const goToPrevious = () => {
    const next = Math.max(safePage - 1, 0)
    setCurrentPage(next)
    persist({ currentPage: next })
    if (book) {
      updateRecentBooks(book, next, pageCount)
    }
  }

  const goToNext = () => {
    const isLastPage = safePage >= pageCount - 1

    if (isLastPage) {
      // Marca leitura como concluída e abre modal de avaliação
      const finalPage = Math.max(pageCount - 1, 0)
      setCurrentPage(finalPage)
      persist({ currentPage: finalPage })
      if (book) {
        updateRecentBooks(book, finalPage, pageCount)
      }
      setShowFinishModal(true)
      return
    }

    const next = Math.min(safePage + 1, pageCount - 1)
    setCurrentPage(next)
    persist({ currentPage: next })
    if (!book?.isPdf && pageRef.current) {
      requestAnimationFrame(() => {
        pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }
    if (book) {
      updateRecentBooks(book, next, pageCount)
    }
  }

  const onChangeTheme = (nextTheme) => {
    setTheme(nextTheme)
    persist({ theme: nextTheme })
  }

  const onChangeFontSize = (nextFontSize) => {
    const value = Math.min(30, Math.max(8, Number(nextFontSize)))
    setFontSize(value)
    persist({ fontSize: value })
  }

  // Drag & Drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const file = files[0]
    const ext = file.name.split('.').pop().toLowerCase()
    
    if (!['txt', 'md', 'pdf'].includes(ext)) {
      alert('Formato não suportado. Use .txt, .md ou .pdf')
      return
    }

    setIsLoadingFile(true)
    
    // Simula processamento do arquivo
    await new Promise(resolve => setTimeout(resolve, 800))

    setPendingFile({
      filePath: file.path,
      fileName: file.name,
      title: file.name.replace(/\.[^/.]+$/, ''),
      extension: `.${ext}`
    })
    
    setIsLoadingFile(false)
    setIsModalOpen(true)
  }

  const handleSaveToLibrary = async (metadata) => {
    try {
      await window.nreader?.saveToLibrary?.({
        filePath: pendingFile.filePath,
        title: metadata.title,
        category: metadata.category,
        coverImage: metadata.coverImage
      })
      setPendingFile(null)
      setLibraryRefresh(prev => prev + 1)
      changeView('library')
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert('Erro ao salvar livro')
    }
  }

  const handleOpenFromLibrary = (bookData) => {
    const isMd = isMarkdownFile(bookData.fileName || '')
    const isPdf = bookData.isPdf ?? false

    const nextBook = {
      title: bookData.title,
      filePath: bookData.fileName,
      content: bookData.content,
      isPdf,
      libraryId: bookData.id
    }

    setBook(nextBook)
    setIsMarkdown(isMd && !isPdf)
    setCurrentPage(0)
    changeView('reader')
    persist({ book: nextBook, currentPage: 0 })
  }

  const handleOpenRecentBook = async (recentBook) => {
    try {
      if (book?.filePath === recentBook.filePath) {
        const restoredPage = Math.max(0, recentBook.lastPage ?? 0)
        setCurrentPage(restoredPage)
        changeView('reader')
        persist({ currentPage: restoredPage })
        return
      }

      let targetBookId = recentBook.libraryId
      if (!targetBookId) {
        const libraryBooks = await window.nreader?.listLibrary?.()
        const match = (libraryBooks || []).find(
          (item) => item.fileName === recentBook.filePath || item.title === recentBook.title
        )
        targetBookId = match?.id
      }

      if (!targetBookId) {
        alert('Não foi possível localizar esse livro na estante para continuar a leitura.')
        return
      }

      const bookData = await window.nreader?.openFromLibrary?.(targetBookId)
      if (!bookData) return

      handleOpenFromLibrary(bookData)
      const restoredPage = Math.max(0, recentBook.lastPage ?? 0)
      setCurrentPage(restoredPage)
      persist({ currentPage: restoredPage })
    } catch (err) {
      console.error('Erro ao abrir livro recente:', err)
      alert('Erro ao abrir o livro recente')
    }
  }

  const currentRecentBook = book
    ? recentBooks.find(
        (item) =>
          item.filePath === book.filePath ||
          item.libraryId === book.libraryId ||
          item.title === book.title
      )
    : null
  const isCurrentBookCompleted = (currentRecentBook?.percentage ?? 0) >= 100
  const shouldShowRating = isCurrentBookCompleted || pageCount === 1

  const handleRestartReading = () => {
    setCurrentPage(0)
    persist({ currentPage: 0 })
    if (book) {
      updateRecentBooks(book, 0, pageCount)
    }
  }

  const handleCurrentBookRatingChange = async (newRating) => {
    setCurrentBookRating(newRating)
    if (book?.libraryId) {
      await window.nreader?.saveToLibrary?.({
        id: book.libraryId,
        rating: newRating
      })
      // Atualizar o livro no estado
      setBook(prevBook => ({
        ...prevBook,
        rating: newRating
      }))
    }
  }

  const finishAndGoToLibrary = useCallback(() => {
    setShowFinishModal(false)
    setLibraryRefresh(prev => prev + 1)
    changeView('library')
  }, [changeView])

  const handleFinishRatingChange = async (newRating) => {
    await handleCurrentBookRatingChange(newRating)
    finishAndGoToLibrary()
  }

  const rootClassName = theme === 'dark' ? 'app dark' : 'app'
  const isLastPage = safePage >= pageCount - 1
  const nextLabel = isLastPage ? t.finish : t.next

  return (
    <div className={rootClassName}>
      {showSplash && (
        <div className={`splash-overlay ${isSplashVisible ? 'show' : ''} ${isSplashFading ? 'fade-out' : ''}`}>
          <img src="images/n-reader-splash.png" alt="Splash Nreader" className="splash-image" />
        </div>
      )}

      <aside className={`sidebar ${isSidebarHidden ? 'hidden' : ''}`}>
        <div className="sidebar-brand">
          <img src="images/n-reader-logo.png" alt={appName} className="sidebar-logo" />
        </div>

        {view !== 'home' && (
          <button onClick={() => {
            changeView('home', () => setBook(null))
          }}>
            {t.backToHome}
          </button>
        )}

        {view !== 'library' && (
          <button onClick={() => {
            setLibraryRefresh(prev => prev + 1)
            changeView('library')
          }}>
            {t.viewLibrary}
          </button>
        )}

        <div
          className={`add-book-dropzone ${isDraggingAddBook ? 'dragging' : ''}`}
          onDragEnter={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDraggingAddBook(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (e.currentTarget === e.target) {
              setIsDraggingAddBook(false)
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDraggingAddBook(false)
            openBookForLibrary()
          }}
          onClick={openBookForLibrary}
        >
          <span className="add-book-icon">📂</span>
          <span>{isOpening ? t.opening : t.addBook}</span>
          <span className="add-book-hint">{t.dragOrClick}</span>
        </div>

        <div className="section">
          <label htmlFor="theme">{t.theme}</label>
          <select id="theme" value={theme} onChange={(event) => onChangeTheme(event.target.value)}>
            <option value="light">{t.light}</option>
            <option value="dark">{t.dark}</option>
          </select>
        </div>

        <div className="section">
          <label htmlFor="fontSize">{t.font}: {fontSize}px</label>
          <input
            id="fontSize"
            type="range"
            min="8"
            max="30"
            value={fontSize}
            onChange={(event) => onChangeFontSize(event.target.value)}
          />
        </div>

        {recentBooks.length > 0 && (
          <div className="section recent-books-section">
            <label>{t.recentBooks}</label>
            <div className="recent-books-list">
              {recentBooks.map((recentBook, index) => {
                const isCompleted = (recentBook.percentage ?? 0) >= 100
                return (
                <div
                  key={`${recentBook.libraryId ?? recentBook.filePath}-${index}`}
                  className={`recent-book-item ${isCompleted ? 'completed' : ''}`}
                  onClick={() => handleOpenRecentBook(recentBook)}
                  title={`${recentBook.title} - ${recentBook.percentage}${t.completed}`}
                >
                  <div className="recent-book-info">
                    <span className="recent-book-title truncate">{recentBook.title}</span>
                    <span className="recent-book-progress">{recentBook.percentage}%</span>
                  </div>
                  <div className="recent-book-progress-bar">
                    <div 
                      className="recent-book-progress-fill"
                      style={{ width: `${recentBook.percentage}%` }}
                    />
                  </div>
                  {isCompleted && <span className="completion-check">✓</span>}
                </div>
              )})}
            </div>
          </div>
        )}

        <button className="settings-button" onClick={() => setShowSettings(true)}>
          {t.settings}
        </button>
      </aside>

      <main className={`reader ${viewTransitionClass} ${isSidebarHidden ? 'sidebar-hidden' : ''} ${isFullscreen ? 'fullscreen' : ''}`.trim()}>
        {isLoadingFile ? (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>{t.loadingFile}</p>
          </div>
        ) : view === 'library' ? (
          <Library
            onOpenBook={handleOpenFromLibrary}
            onBack={() => changeView('home')}
            recentBooks={recentBooks}
            categories={categories}
            language={language}
            refreshKey={libraryRefresh}
          />
        ) : view === 'home' ? (
          <div
            className={`drop-zone ${isDragging ? 'dragging' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="drop-content">
              <div className="drop-icon">📚</div>
              <h2>{t.dragBookHere}</h2>
              <p className="muted">{t.supportedFormats}</p>
            </div>
          </div>
        ) : book ? (
          <>
            <article ref={pageRef} className="page" style={{ fontSize: `${fontSize}px` }}>
              <div className="page-overlay-buttons">
                <button 
                  className="overlay-button toggle-sidebar" 
                  title={isSidebarHidden ? 'Mostrar sidebar' : 'Esconder sidebar'}
                  onClick={() => setIsSidebarHidden(!isSidebarHidden)}
                >
                  {isSidebarHidden ? '☰' : '✕'}
                </button>
                <button 
                  className="overlay-button fullscreen-btn" 
                  title={isFullscreen ? 'Sair de fullscreen' : 'Fullscreen'}
                  onClick={() => {
                    setIsFullscreen(!isFullscreen)
                    if (!isFullscreen) {
                      setIsSidebarHidden(true)
                    }
                  }}
                >
                  {isFullscreen ? '⛶' : '⛶'}
                </button>
              </div>
              {book?.isPdf ? (
                <PdfPage
                  base64Content={book.content}
                  pageNum={safePage + 1}
                  fontScale={Math.max(0.5, Math.min(fontSize / 20, 1.8))}
                />
              ) : isMarkdown ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                  img: ({node, ...props}) => (
                    <img {...props} style={{ maxWidth: '100%', height: 'auto' }} />
                  )
                }}>
                  {pages[safePage]}
                </ReactMarkdown>
              ) : (
                pages[safePage]
              )}
              <div className="page-number-display">{safePage + 1} / {pageCount}</div>
            </article>

            <footer className="controls">
              <div className="controls-main">
                <button onClick={goToPrevious} disabled={safePage <= 0}>
                  {t.previous}
                </button>
                {shouldShowRating && (
                  <div className="completed-reading-section">
                    <button className="restart-reading" onClick={handleRestartReading}>
                      {t.readFromStart}
                    </button>
                    <div className="reading-rating">
                      <span className="rating-label">{t.rateReading}</span>
                      <StarRating value={currentBookRating} onChange={handleCurrentBookRatingChange} />
                    </div>
                  </div>
                )}
                <button onClick={goToNext}>
                  {nextLabel}
                </button>
              </div>
            </footer>
          </>
        ) : null}
      </main>

      {showFinishModal && (
        <div className="modal-overlay" onClick={finishAndGoToLibrary}>
          <div className="finish-reading-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t.ratingModalTitle}</h3>
            <p className="muted">{t.rateReading}</p>
            <div className="finish-rating-stars">
              <StarRating value={currentBookRating} onChange={handleFinishRatingChange} />
            </div>
            <div className="finish-modal-actions">
              <button className="action-btn secondary" onClick={finishAndGoToLibrary}>{t.close}</button>
              <button className="action-btn primary" onClick={finishAndGoToLibrary}>{t.viewLibrary}</button>
            </div>
          </div>
        </div>
      )}

      <BookModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setPendingFile(null)
        }}
        onSave={handleSaveToLibrary}
        initialData={pendingFile}
        categories={categories}
        onAddCategory={handleAddCategory}
        language={language}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        language={language}
        onLanguageChange={handleLanguageChange}
      />
    </div>
  )
}
