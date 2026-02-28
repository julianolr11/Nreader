const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  readTextFile: (filePath) => ipcRenderer.invoke('read-text-file', filePath),
  readPdfFile: (filePath) => ipcRenderer.invoke('read-pdf-file', filePath),
})
