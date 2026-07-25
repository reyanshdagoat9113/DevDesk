import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/renderer'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['apps/renderer/**/*.test.tsx'],
    setupFiles: ['./vitest.renderer.setup.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
})
