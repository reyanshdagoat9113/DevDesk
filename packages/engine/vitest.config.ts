import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: '.',
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/dist/**',
        '**/node_modules/**',
      ],
      thresholds: {
        lines: 55,
        functions: 45,
        branches: 45,
        statements: 55,
      },
    },
  },
})
