import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(root, './src'),
      shared: path.resolve(root, '../../packages/shared/src'),
      'client-api-sdk': path.resolve(root, '../../packages/client-api-sdk/src'),
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist/legacy/build/pdf.mjs'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    env: {
      VITE_API_URL: '',
    },
  },
})
