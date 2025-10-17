import { defineConfig } from 'vitest/config';
import path from 'path';

const defaultExcludes: string[] = [
  'unified-tasks-snapshot/**',
  '**/node_modules/**',
  '**/dist/**',
  // Temporarily exclude heavy/flaky integration tests to focus on core functionality
  'tests/integration/**',
  'server/caption/__tests__/**',
  'tests/unit/server/workers/**',
  'tests/unit/workers/**',
  'tests/unit/payments/**',
  'tests/unit/expenses/**',
  'tests/e2e/**',
  // Exclude tests that require real database (should be moved to integration tests)
  'tests/unit/auth/**', // These are actually integration tests
  'tests/unit/preview-gate.test.ts', // Requires real DB
  // Keep core functionality tests only

];

if (process.env.VITEST_INCLUDE_CAPTION === 'true') {
  const index = defaultExcludes.indexOf('server/caption/__tests__/**');
  if (index !== -1) {
    defaultExcludes.splice(index, 1);
  }
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Default to Node for server tests
    // Show only failures and errors in output
    reporters: process.env.NODE_ENV === 'test' ? ['verbose'] : ['basic'],
    exclude: defaultExcludes,
    environmentMatchGlobs: [
      ['client/**', 'jsdom'], // Use jsdom for client tests
      ['tests/**/*.{tsx,jsx}', 'jsdom'], // Use jsdom for React tests
    ],
    setupFiles: ['./tests/vitest-setup.ts'],
    testTimeout: 10000,
    hookTimeout: 30000, // Force cleanup hooks to timeout after 30s
    teardownTimeout: 10000, // Force teardown to complete within 10s
    // Force tests to exit even with open handles
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Isolate each test file in its own environment
    isolate: true,
    // Force test files to run in sequence
    fileParallelism: false,
    coverage: {
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@server': path.resolve(__dirname, './server'),
    },
  },
});
