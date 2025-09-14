import dotenv from 'dotenv';
import { beforeEach } from 'vitest';

// Load .env.test file specifically for vitest tests
dotenv.config({ path: '.env.test' });

// Set default test environment variables if not present
process.env.APP_BASE_URL = process.env.APP_BASE_URL || 'https://thottopilot.com';
process.env.DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';

// Clean up between tests
beforeEach(() => {
  // Reset any global state here if needed
});