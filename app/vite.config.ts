import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// Los labs de Java/Python viven en ../labs y se importan como texto (?raw):
// una sola fuente de verdad para el código que se ve en la app y el que corres localmente.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@labs': fileURLToPath(new URL('../labs', import.meta.url)),
    },
  },
  server: { fs: { allow: ['..'] } },
})
