import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Default to Node for server tests
    environmentMatchGlobs: [
      ['client/**', 'jsdom'], // Use jsdom for client tests
      ['tests/**/*.{tsx,jsx}', 'jsdom'], // Use jsdom for React tests
    ],
    setupFiles: ['./tests/vitest-setup.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '#shared': path.resolve(__dirname, './shared'),
      '#server': path.resolve(__dirname, './server'),
    },
  },
});
