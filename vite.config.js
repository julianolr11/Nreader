import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const copyPdfWorker = {
  name: 'copy-pdf-worker',
  writeBundle: () => {
    const src = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
    const dest = path.resolve(__dirname, 'dist/pdf.worker.min.js')
    fs.copyFileSync(src, dest)
  }
}

export default defineConfig({
  plugins: [react(), copyPdfWorker],
  base: './',
  build: {
    outDir: 'dist'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
})
