import type { PlaywrightStubConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5000';

const config: PlaywrightStubConfig = {
  testDir: './tests/e2e',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    extraHTTPHeaders: {
      'x-e2e-suite': 'full-journey',
    },
  },
};

export default config;