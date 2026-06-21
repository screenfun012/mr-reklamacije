import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: [
      'src/**/__tests__/**/*.integration.test.ts',
      'src/**/__tests__/**/*.http.integration.test.ts',
      'src/**/__tests__/**/*.http.test.ts',
    ],
    passWithNoTests: true,
    testTimeout: 30_000,
  },
})
