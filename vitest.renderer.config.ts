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
    include: ['apps/renderer/**/*.{test.ts,test.tsx}'],
    setupFiles: ['./vitest.renderer.setup.ts'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage/renderer',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      include: ['apps/renderer/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        '**/dist/**',
        '**/node_modules/**',
        'apps/renderer/app/components/ui/**',
        'apps/renderer/main.tsx',
        'apps/renderer/vite-env.d.ts',
        'apps/renderer/test/**',
      ],
      // Measured corrected baseline; UI primitives excluded (covered through consumers).
      // `App.bootstrap.test.tsx` now mounts App, so the whole shell dependency tree is
      // instrumented: statements/branches ratcheted up sharply, while the function
      // denominator grew (many real, still-uncovered handlers are now visible).
      // See docs/test-review-ledger.md for the recorded threshold decision.
      thresholds: {
        lines: 30,
        functions: 12,
        branches: 55,
        statements: 30,
      },
    },
  },
})
