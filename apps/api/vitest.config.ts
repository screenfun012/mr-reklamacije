import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.integration.test.ts'],
    passWithNoTests: true,
    testTimeout: 30_000,
  },
})
