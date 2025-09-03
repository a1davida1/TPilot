#!/usr/bin/env node

/**
 * Production server entry point
 * This file provides a CommonJS wrapper to run the TypeScript server in production
 */

// Load environment variables
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_OPTIONS = '--max-old-space-size=4096';
}

// Register tsx to handle TypeScript files
require('tsx/cjs');

// Load and run the main server
require('./server/index.ts');