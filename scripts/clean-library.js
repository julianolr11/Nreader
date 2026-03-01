const fs = require('fs');
const path = require('path');
const os = require('os');

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const libraryPath = path.join(appData, 'nreader', 'Estante');

try {
  fs.rmSync(libraryPath, { recursive: true, force: true });
  console.log('Estante limpa (dev prestart)');
} catch (err) {
  console.error('Falha ao limpar estante:', err.message);
}
