import dotenv from 'dotenv';

// Load .env file for tests
dotenv.config();

// Set default test environment variables if not present
process.env.APP_BASE_URL = process.env.APP_BASE_URL || 'https://thottopilot.com';
process.env.DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
