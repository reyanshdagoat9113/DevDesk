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
  },
}
