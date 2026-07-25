export default {
  root: '.',
  test: {
    environment: 'node',
    include: ['apps/desktop/engine/engine-ipc.integration.test.ts'],
    testTimeout: 120000,
    hookTimeout: 120000,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage/engine-ipc',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      include: ['apps/desktop/engine/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/dist/**',
        '**/node_modules/**',
      ],
    },
  },
}
