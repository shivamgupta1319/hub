import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: { resolve: { alias: shared } },
  preload: {
    resolve: { alias: shared },
    build: {
      // Sandboxed preloads can't load extra chunks, so each entry must be self-contained.
      isolatedEntries: true,
      externalizeDeps: false,
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts'), site: resolve('src/preload/site.ts') }
      }
    }
  },
  renderer: {
    resolve: { alias: shared },
    plugins: [react()]
  }
})
