import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    minify: false,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-b2.js`,
        chunkFileNames: `assets/[name]-[hash]-b2.js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      }
    }
  }
})
