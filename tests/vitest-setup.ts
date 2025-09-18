import dotenv from 'dotenv';
import { beforeEach, beforeAll, afterAll } from 'vitest';
import { db } from '../server/db';

// Load .env.test file specifically for vitest tests
dotenv.config({ path: '.env.test' });

// Set default test environment variables if not present
process.env.APP_BASE_URL = process.env.APP_BASE_URL || 'https://thottopilot.com';
process.env.DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
// Set up test environment variables
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';
process.env.NODE_ENV = 'test';

// Clean up between tests
beforeEach(() => {
  // Reset any global state here if needed
});

beforeAll(async () => {
  // Any global test setup can go here
  console.log('🧪 Setting up test environment...');
});

afterAll(async () => {
  // Clean up test environment
  console.log('🧪 Cleaning up test environment...');
  // Don't close the db connection as it might be used by other tests
});