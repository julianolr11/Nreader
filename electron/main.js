const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt', '.md'])

function isAllowedFile(filePath) {
  if (!path.isAbsolute(filePath)) return false
  const ext = path.extname(filePath).toLowerCase()
  return ALLOWED_EXTENSIONS.has(ext)
}

const isDev = process.env.NODE_ENV === 'development' || !!process.env.ELECTRON_DEV

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a2e',
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Documents', extensions: ['pdf', 'txt', 'md'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'Text Files', extensions: ['txt', 'md'] },
    ],
  })
  if (result.canceled) return []
  return result.filePaths.map((filePath) => ({
    path: filePath,
    name: path.basename(filePath),
    ext: path.extname(filePath).toLowerCase().replace('.', ''),
  }))
})

ipcMain.handle('read-text-file', async (event, filePath) => {
  try {
    if (!isAllowedFile(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch (err) {
    return null
  }
})

ipcMain.handle('read-pdf-file', async (event, filePath) => {
  try {
    if (!isAllowedFile(filePath)) return null
    const data = fs.readFileSync(filePath)
    return data.buffer
  } catch (err) {
    return null
  }
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
