const { contextBridge } = require('electron');
const { ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nreader', {
  getAppName: () => 'Nreader',
  openBook: () => ipcRenderer.invoke('books:open'),
  saveToLibrary: (data) => ipcRenderer.invoke('library:save', data),
  listLibrary: () => ipcRenderer.invoke('library:list'),
  openFromLibrary: (bookId) => ipcRenderer.invoke('library:open', bookId),
  uploadCover: () => ipcRenderer.invoke('library:uploadCover'),
  deleteFromLibrary: (bookId) => ipcRenderer.invoke('library:delete', bookId),
  clearLibrary: () => ipcRenderer.invoke('library:clear'),
  openLibraryFolder: () => ipcRenderer.invoke('library:openFolder'),
  quitApp: () => ipcRenderer.invoke('app:quit')
});
