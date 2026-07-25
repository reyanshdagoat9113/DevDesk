export default {
  root: '.',
  test: {
    environment: 'node',
    include: [
      'apps/desktop/**/*.test.ts',
    ],
    exclude: [
      'apps/desktop/engine/engine-ipc.integration.test.ts',
    ],
    testTimeout: 120000,
    hookTimeout: 120000,
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage/desktop',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      include: ['apps/desktop/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        '**/dist/**',
        '**/node_modules/**',
        'apps/desktop/engine/engine-ipc.integration.test.ts',
      ],
      // Measured baseline after modernization waves; non-decreasing ratchet.
      thresholds: {
        lines: 30,
        functions: 50,
        branches: 50,
        statements: 30,
      },
    },
  },
}
