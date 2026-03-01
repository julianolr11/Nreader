const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');

const isDev = !app.isPackaged;
const devServerURL = 'http://localhost:5174';

const resolveIconPath = () => {
  const candidates = [
    path.join(__dirname, 'dist', 'images', 'n-ico.ico'),
    path.join(__dirname, 'public', 'images', 'n-ico.ico')
  ];
  return candidates.find(fsSync.existsSync);
};

const LIBRARY_PATH = path.join(app.getPath('userData'), 'Estante');
const METADATA_FILE = path.join(LIBRARY_PATH, 'metadata.json');

function createWindow() {
  const iconPath = resolveIconPath();

  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    backgroundColor: '#000000',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Oculta completamente a barra de menu (File/Edit/View/Help)
  win.setMenuBarVisibility(false)
  win.removeMenu()

  // Mostrar janela apenas quando estiver pronta
  win.once('ready-to-show', () => {
    win.show();
  });

  if (isDev) {
    win.loadURL(devServerURL);
    win.webContents.openDevTools();

    // Se o servidor de dev não estiver rodando (ex.: npm start), faz fallback para build
    const fallbackToDist = () => {
      win.loadFile(path.join(__dirname, 'dist', 'index.html'));
    };

    win.webContents.once('did-fail-load', fallbackToDist);
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

ipcMain.handle('books:open', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Abrir livro',
    properties: ['openFile'],
    filters: [
      { name: 'Livros suportados', extensions: ['txt', 'md', 'pdf'] },
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'Texto e Markdown', extensions: ['txt', 'md'] },
      { name: 'Todos os arquivos', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.pdf') {
    const buffer = await fs.readFile(filePath);
    const base64 = buffer.toString('base64');
    return {
      canceled: false,
      filePath,
      title: path.basename(filePath),
      content: base64,
      isPdf: true
    };
  } else {
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      canceled: false,
      filePath,
      title: path.basename(filePath),
      content,
      isPdf: false
    };
  }
});

// Garante que a pasta Estante existe
async function ensureLibraryFolder() {
  try {
    await fs.mkdir(LIBRARY_PATH, { recursive: true });
    if (!fsSync.existsSync(METADATA_FILE)) {
      await fs.writeFile(METADATA_FILE, JSON.stringify({ books: [] }, null, 2));
    }
  } catch (err) {
    console.error('Erro ao criar pasta Estante:', err);
  }
}

// Carrega metadados
async function loadMetadata() {
  try {
    const data = await fs.readFile(METADATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { books: [] };
  }
}

// Salva metadados
async function saveMetadata(metadata) {
  await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

async function clearLibrary() {
  try {
    await fs.rm(LIBRARY_PATH, { recursive: true, force: true });
  } catch (err) {
    console.error('Erro ao limpar estante:', err);
  }
  await ensureLibraryFolder();
}

// Handler para salvar livro na estante
ipcMain.handle('library:save', async (event, bookData) => {
  await ensureLibraryFolder();
  const metadata = await loadMetadata();
  
  // Se tem ID, é uma atualização de livro existente
  if (bookData.id) {
    const bookIndex = metadata.books.findIndex(b => b.id === bookData.id);
    if (bookIndex !== -1) {
      // Atualiza apenas os campos fornecidos, mantendo o resto
      metadata.books[bookIndex] = {
        ...metadata.books[bookIndex],
        ...bookData
      };
      await saveMetadata(metadata);
      return metadata.books[bookIndex];
    }
    throw new Error('Livro não encontrado para atualização');
  }
  
  // Se não tem ID, é um novo livro
  const { filePath, title, category, coverImage } = bookData;
  const ext = path.extname(filePath);
  const fileName = `${Date.now()}${ext}`;
  const destPath = path.join(LIBRARY_PATH, fileName);
  
  // Copia o arquivo para a estante
  await fs.copyFile(filePath, destPath);
  
  const bookEntry = {
    id: Date.now(),
    fileName,
    originalPath: filePath,
    title: title || path.basename(filePath),
    category: category || null,
    coverImage: coverImage || null,
    addedAt: new Date().toISOString(),
    extension: ext,
    rating: 0
  };
  
  metadata.books.push(bookEntry);
  await saveMetadata(metadata);
  
  return bookEntry;
});

// Handler para limpar toda a estante
ipcMain.handle('library:clear', async () => {
  await clearLibrary();
  return true;
});

// Handler para listar livros
ipcMain.handle('library:list', async () => {
  await ensureLibraryFolder();
  const metadata = await loadMetadata();
  return metadata.books;
});

// Handler para abrir livro da estante
ipcMain.handle('library:open', async (event, bookId) => {
  const metadata = await loadMetadata();
  const book = metadata.books.find(b => b.id === bookId);
  
  if (!book) {
    throw new Error('Livro não encontrado');
  }
  
  const filePath = path.join(LIBRARY_PATH, book.fileName);
  const extension = path.extname(book.fileName).toLowerCase();
  
  if (extension === '.pdf') {
    const buffer = await fs.readFile(filePath);
    const base64 = buffer.toString('base64');
    return {
      ...book,
      content: base64,
      isPdf: true
    };
  } else {
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      ...book,
      content,
      isPdf: false
    };
  }
});

// Handler para upload de imagem de capa
ipcMain.handle('library:uploadCover', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Selecionar capa',
    properties: ['openFile'],
    filters: [
      { name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
    ]
  });
  
  if (result.canceled) return null;
  
  const buffer = await fs.readFile(result.filePaths[0]);
  return `data:image/${path.extname(result.filePaths[0]).slice(1)};base64,${buffer.toString('base64')}`;
});

// Handler para excluir livro da estante
ipcMain.handle('library:delete', async (event, bookId) => {
  await ensureLibraryFolder();
  const metadata = await loadMetadata();
  const index = metadata.books.findIndex((b) => b.id === bookId);
  if (index === -1) return false;

  const [book] = metadata.books.splice(index, 1);
  await saveMetadata(metadata);

  if (book?.fileName) {
    const filePath = path.join(LIBRARY_PATH, book.fileName);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.error('Erro ao excluir arquivo do livro:', err);
    }
  }

  return true;
});

// Abrir pasta da estante no explorador
ipcMain.handle('library:openFolder', async () => {
  await ensureLibraryFolder();
  await shell.openPath(LIBRARY_PATH);
  return true;
});

app.whenReady().then(() => {
  ensureLibraryFolder();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Encerrar aplicativo sob demanda
ipcMain.handle('app:quit', () => {
  app.quit();
  return true;
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
